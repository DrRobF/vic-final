import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import {
 candidateInput, makeInviteCode, seedQuestions, rankCandidates, STAGE_TOTALS,
} from '../../../lib/hiring.mjs'
import { BUCKET, disposalDate } from '../../../lib/hiring-media.mjs'

// The panel's side of hiring: invite candidates, review what they sent, score it against the rubric.
//
// Two rules are enforced here rather than left to the screen, because a screen can be rewritten by
// someone who does not know why it was built that way.
//
// ONE: a scorer's row is keyed by (response, scorer) and a save only ever touches the caller's own
// row. Three people scoring independently and then summing is the entire reason for a panel; one
// shared editable score is the loudest person in the room with extra steps.
//
// TWO: marketing_opt_in is never selected, never returned, and never sortable. A principal who owns
// the software a candidate had to use already holds all the power in the room, and that column
// exists so the ask is honest -- not so the answer can be acted on while deciding who gets a job.

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } }

const no = (res, status, error) => res.status(status).json({ error })
const UUID = /^[0-9a-f-]{36}$/i
const PLAYBACK_SECONDS = 60 * 60

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) {
  res.setHeader('Allow', 'GET, POST')
  return no(res, 405, 'Method not allowed.')
 }
 try {
  const auth = await requirePrincipal(req)
  if (auth.error) return no(res, auth.status, auth.error)
  const schoolId = req.method === 'GET' ? req.query.schoolId : req.body?.schoolId

  // No school named on a GET: hand back the schools this leader belongs to, the same way the
  // walkthroughs workspace does, so the page can open without knowing one yet.
  if (req.method === 'GET' && !schoolId) {
   const { data, error } = await auth.admin.from('ap_memberships')
    .select('school_id,role,ap_schools(name)').eq('auth_user_id', auth.user.id)
   if (error) throw error
   return res.json({ schools: (data || []).map(m => ({ id: m.school_id, name: m.ap_schools?.name || 'My school', role: m.role })) })
  }

  const school = await requireSchool(auth, schoolId)
  if (school.error) return no(res, school.status, school.error)
  const db = auth.admin

  if (req.method === 'GET') {
   const candidateId = String(req.query.candidateId || '')
   if (candidateId) return await review(db, auth, school, candidateId, res)
   return await overview(db, school, res)
  }

  const action = String(req.body?.action || '')

  if (action === 'create-posting') {
   const title = String(req.body?.title || '').trim().slice(0, 160)
   if (title.length < 2) return no(res, 400, 'Give the position a title.')
   const { data: posting, error } = await db.from('ap_hiring_postings').insert({
    school_id: school.schoolId, title,
    grade_band: String(req.body?.gradeBand || '').trim().slice(0, 60),
    subject: String(req.body?.subject || '').trim().slice(0, 80),
    created_by: auth.user.id,
   }).select('id').single()
   if (error) throw error
   // Questions are copied onto the posting rather than shared, so editing the wording for an aide
   // posting next spring cannot change the rubric a teaching candidate was already scored against.
   const seeded = seedQuestions(posting.id, school.schoolId)
   const { error: qError } = await db.from('ap_hiring_questions').insert(seeded)
   if (qError) throw qError
   return res.json({ postingId: posting.id, questions: seeded.length })
  }

  if (action === 'invite') {
   const postingId = String(req.body?.postingId || '')
   if (!UUID.test(postingId)) return no(res, 400, 'Choose a position.')
   const { data: posting } = await db.from('ap_hiring_postings')
    .select('id, status').eq('id', postingId).eq('school_id', school.schoolId).maybeSingle()
   if (!posting?.id) return no(res, 404, 'That position does not belong to this school.')
   if (['closed', 'filled'].includes(posting.status)) return no(res, 409, 'That position is closed. Reopen it before inviting anyone else.')

   let input
   try { input = candidateInput(req.body) } catch (e) { return no(res, 400, e.message) }

   const days = Number(req.body?.days)
   const validDays = Number.isFinite(days) && days >= 1 && days <= 60 ? Math.round(days) : 14
   // One retry, because a duplicate code is possible and astronomically unlikely, and a candidate
   // who cannot be invited because of a coin flip is a bad afternoon for somebody.
   let created = null
   for (let attempt = 0; attempt < 2 && !created; attempt++) {
    const { data, error } = await db.from('ap_hiring_candidates').insert({
     school_id: school.schoolId, posting_id: postingId,
     name: input.name, email: input.email, phone: input.phone, cert_areas: input.certAreas,
     invite_code: makeInviteCode(),
     invite_expires_at: new Date(Date.now() + validDays * 86400000).toISOString(),
     delete_after: disposalDate(),
     created_by: auth.user.id,
    }).select('id, invite_code, invite_expires_at').single()
    if (!error) { created = data; break }
    if (!/duplicate key|unique/i.test(error.message || '')) throw error
   }
   if (!created) return no(res, 503, 'Could not create that invitation. Please try again.')
   return res.json({ candidateId: created.id, code: created.invite_code, expiresAt: created.invite_expires_at })
  }

  if (action === 'score') {
   const responseId = String(req.body?.responseId || '')
   if (!UUID.test(responseId)) return no(res, 400, 'Choose an answer to score.')
   const { data: response } = await db.from('ap_hiring_responses')
    .select('id, candidate_id, question_id, school_id').eq('id', responseId).eq('school_id', school.schoolId).maybeSingle()
   if (!response?.id) return no(res, 404, 'That answer does not belong to this school.')
   const { data: question } = await db.from('ap_hiring_questions')
    .select('max_content, max_fit, max_writing').eq('id', response.question_id).maybeSingle()
   if (!question) return no(res, 404, 'That question no longer exists.')

   const dims = {}
   for (const [key, max, label] of [['content', question.max_content, 'content'], ['fit', question.max_fit, 'fit'], ['writing', question.max_writing, 'writing']]) {
    const value = Number(req.body?.[key] ?? 0)
    if (!Number.isInteger(value) || value < 0 || value > max) return no(res, 400, `Score ${label} from 0 to ${max}.`)
    dims[key] = value
   }
   const note = String(req.body?.note || '').trim().slice(0, 2000)

   // onConflict on (response_id, scorer_user_id): this updates the caller's own row and cannot
   // touch another panel member's.
   const { error } = await db.from('ap_hiring_scores').upsert({
    school_id: school.schoolId, candidate_id: response.candidate_id, response_id: responseId,
    scorer_user_id: auth.user.id, scorer_name: auth.profile?.name || '',
    ...dims, note, voice_mismatch: req.body?.voiceMismatch === true,
    updated_at: new Date().toISOString(),
   }, { onConflict: 'response_id,scorer_user_id' })
   if (error) throw error
   return res.json({ saved: true })
  }

  if (action === 'stage') {
   const candidateId = String(req.body?.candidateId || '')
   const stage = String(req.body?.stage || '')
   const allowed = ['invited', 'screening_submitted', 'interview', 'demo', 'references', 'offer', 'hired', 'declined', 'withdrawn']
   if (!UUID.test(candidateId) || !allowed.includes(stage)) return no(res, 400, 'Choose a candidate and a stage.')
   const decided = ['hired', 'declined', 'withdrawn'].includes(stage) ? new Date().toISOString() : null
   const { error } = await db.from('ap_hiring_candidates')
    .update({ stage, ...(decided ? { decided_at: decided } : {}) })
    .eq('id', candidateId).eq('school_id', school.schoolId)
   if (error) throw error
   return res.json({ saved: true })
  }

  return no(res, 400, 'Unknown action.')
 } catch (error) {
  console.error('Hiring admin request failed', error instanceof Error ? error.name : 'Error')
  return no(res, 503, 'Could not complete that just now. Please try again.')
 }
}

async function overview(db, school, res) {
 const { data: postings, error } = await db.from('ap_hiring_postings')
  .select('id, title, grade_band, subject, status, created_at')
  .eq('school_id', school.schoolId).order('created_at', { ascending: false }).limit(100)
 if (error) throw error

 const { data: candidates } = await db.from('ap_hiring_candidates')
  .select('id, posting_id, name, email, stage, submitted_at, created_at, delete_after')
  .eq('school_id', school.schoolId).order('created_at', { ascending: false }).limit(500)

 const { data: scores } = await db.from('ap_hiring_scores')
  .select('candidate_id, scorer_user_id, content, fit, writing, ap_hiring_responses(stage)')
  .eq('school_id', school.schoolId).limit(20000)

 const byCandidate = new Map()
 for (const s of scores || []) {
  if (!byCandidate.has(s.candidate_id)) byCandidate.set(s.candidate_id, { total: 0, video: 0, written: 0, scorers: new Set() })
  const entry = byCandidate.get(s.candidate_id)
  const points = (s.content || 0) + (s.fit || 0) + (s.writing || 0)
  entry.total += points
  const stage = s.ap_hiring_responses?.stage
  if (stage === 'video') entry.video += points
  else if (stage === 'written') entry.written += points
  entry.scorers.add(s.scorer_user_id)
 }

 const rows = (candidates || []).map(c => {
  const entry = byCandidate.get(c.id)
  return {
   id: c.id, postingId: c.posting_id, name: c.name, email: c.email, stage: c.stage,
   submittedAt: c.submitted_at, deleteAfter: c.delete_after,
   total: entry?.total || 0,
   video: entry?.video || 0,
   written: entry?.written || 0,
   scorers: entry?.scorers.size || 0,
  }
 })

 return res.json({
  postings: postings || [],
  // Ranked, but a candidate nobody has scored yet is flagged rather than quietly ranked last: an
  // unscored answer is a missing scorer, not a zero.
  candidates: rankCandidates(rows),
  stageTotals: STAGE_TOTALS,
 })
}

async function review(db, auth, school, candidateId, res) {
 if (!UUID.test(candidateId)) return no(res, 400, 'Choose a candidate.')
 const { data: candidate } = await db.from('ap_hiring_candidates')
  .select('id, posting_id, name, email, phone, cert_areas, stage, submitted_at, commute_sustainable, delete_after, invite_code, invite_expires_at')
  .eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
 if (!candidate?.id) return no(res, 404, 'That candidate does not belong to this school.')

 const [{ data: questions }, { data: responses }, { data: scores }] = await Promise.all([
  db.from('ap_hiring_questions')
   .select('id, stage, ordinal, prompt, domain, look_for_strong, look_for_weak, max_content, max_fit, max_writing')
   .eq('posting_id', candidate.posting_id).order('stage').order('ordinal'),
  db.from('ap_hiring_responses')
   .select('id, question_id, stage, video_path, video_seconds, text_response, submitted_at')
   .eq('candidate_id', candidateId),
  db.from('ap_hiring_scores')
   .select('response_id, scorer_user_id, scorer_name, content, fit, writing, note, voice_mismatch')
   .eq('candidate_id', candidateId),
 ])

 const responseByQuestion = new Map((responses || []).map(r => [r.question_id, r]))

 // Playback links are signed and short-lived. Applicant video is never served from a public URL.
 const paths = (responses || []).map(r => r.video_path).filter(Boolean)
 const signed = new Map()
 if (paths.length) {
  const { data: urls } = await db.storage.from(BUCKET).createSignedUrls(paths, PLAYBACK_SECONDS)
  for (const u of urls || []) if (u?.path && u?.signedUrl) signed.set(u.path, u.signedUrl)
 }

 const mine = auth.user.id
 const items = (questions || []).map(q => {
  const response = responseByQuestion.get(q.id)
  const all = (scores || []).filter(s => s.response_id === response?.id)
  const own = all.find(s => s.scorer_user_id === mine) || null
  return {
   questionId: q.id, stage: q.stage, ordinal: q.ordinal, prompt: q.prompt, domain: q.domain,
   lookForStrong: q.look_for_strong, lookForWeak: q.look_for_weak,
   maxContent: q.max_content, maxFit: q.max_fit, maxWriting: q.max_writing,
   responseId: response?.id || null,
   videoUrl: response?.video_path ? signed.get(response.video_path) || null : null,
   seconds: response?.video_seconds ?? null,
   text: response?.text_response || '',
   myScore: own ? { content: own.content, fit: own.fit, writing: own.writing, note: own.note, voiceMismatch: own.voice_mismatch } : null,
   // Other panel members' numbers are shown only once this scorer has saved their own, so that a
   // panel scores independently rather than anchoring on whoever went first.
   others: own
    ? all.filter(s => s.scorer_user_id !== mine)
       .map(s => ({ name: s.scorer_name || 'Panel member', content: s.content, fit: s.fit, writing: s.writing, note: s.note, voiceMismatch: s.voice_mismatch }))
    : [],
   otherScorerCount: all.filter(s => s.scorer_user_id !== mine).length,
  }
 })

 // The results view. A single scorer sees their own video, written and total straight away; once
 // more than one person has scored, the panel's combined numbers sit beside them. Scored out of is
 // always shown, because a total means nothing without knowing how much of the interview it covers.
 const maxFor = stage => (questions || []).filter(q => q.stage === stage)
  .reduce((a, q) => a + q.max_content + q.max_fit + q.max_writing, 0)
 const answerCount = stage => (responses || []).filter(r => r.stage === stage).length
 const responseStage = new Map((responses || []).map(r => [r.id, r.stage]))

 const perScorer = new Map()
 for (const s of scores || []) {
  if (!perScorer.has(s.scorer_user_id)) {
   perScorer.set(s.scorer_user_id, { name: s.scorer_name || 'Panel member', isMe: s.scorer_user_id === mine, video: 0, written: 0, total: 0, answersScored: 0 })
  }
  const entry = perScorer.get(s.scorer_user_id)
  const points = (s.content || 0) + (s.fit || 0) + (s.writing || 0)
  const stage = responseStage.get(s.response_id)
  if (stage === 'video') entry.video += points
  else if (stage === 'written') entry.written += points
  entry.total += points
  entry.answersScored += 1
 }
 const scorerRows = [...perScorer.values()].sort((a, b) => (b.isMe ? 1 : 0) - (a.isMe ? 1 : 0))
 const totals = {
  maxVideo: maxFor('video'), maxWritten: maxFor('written'),
  maxTotal: maxFor('video') + maxFor('written'),
  answers: answerCount('video') + answerCount('written'),
  scorers: scorerRows,
  // The panel number is the sum of every member's scores, which is how the ranking works: highest
  // combined total advances, and nobody holds a veto.
  panel: scorerRows.reduce((a, r) => ({ video: a.video + r.video, written: a.written + r.written, total: a.total + r.total }), { video: 0, written: 0, total: 0 }),
 }

 return res.json({
  totals,
  candidate: {
   id: candidate.id, name: candidate.name, email: candidate.email, phone: candidate.phone,
   certAreas: candidate.cert_areas, stage: candidate.stage, submittedAt: candidate.submitted_at,
   commuteSustainable: candidate.commute_sustainable, deleteAfter: candidate.delete_after,
   inviteCode: candidate.invite_code, inviteExpiresAt: candidate.invite_expires_at,
  },
  items,
 })
}
