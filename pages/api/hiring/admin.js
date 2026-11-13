import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import {
 candidateInput, makeInviteCode, seedQuestions, rankCandidates, STAGE_TOTALS,
 ROUNDS, roundByKey, roundTotal, roundMax, packet, ladderState, questionEdit,
} from '../../../lib/hiring.mjs'
import { BUCKET, disposalDate } from '../../../lib/hiring-media.mjs'
import { videoPaths, mayDeleteMedia, disposalSummary } from '../../../lib/hiring-retention.mjs'
import {
 inviteMessage, sendInvite, checkTemplate, DEFAULT_INVITE_SUBJECT, DEFAULT_INVITE_BODY, DEFAULT_INVITE_HOURS, INVITE_PLACEHOLDERS,
} from '../../../lib/hiring-invite.mjs'

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

  // Filling a position archives it. Candidates for a job that closed in August are history, not a
  // worklist, and a screen that keeps showing them is a screen a principal stops reading.
  //
  // Nothing is deleted by archiving. The position and its candidates move out of the way and stay
  // openable, because the scored record of a decision is exactly what you want a year later.
  if (action === 'close-posting') {
   const postingId = String(req.body?.postingId || '')
   const status = String(req.body?.status || '')
   if (!UUID.test(postingId) || !['open', 'closed', 'filled'].includes(status)) return no(res, 400, 'Choose a position and a status.')
   const { data, error } = await db.from('ap_hiring_postings')
    .update({ status }).eq('id', postingId).eq('school_id', school.schoolId).select('id, title').maybeSingle()
   if (error) throw error
   if (!data?.id) return no(res, 404, 'That position does not belong to this school.')

   // Offered alongside, never implied by archiving: a position being filled is the moment a school
   // knows it is finished with the video of everyone who did not get the job.
   let deleted = 0
   if (req.body?.deleteRecordings === true && status !== 'open') {
    const { data: candidates } = await db.from('ap_hiring_candidates')
     .select('id, stage').eq('posting_id', postingId).eq('school_id', school.schoolId).is('media_deleted_at', null)
    const ids = (candidates || []).filter(c => c.stage !== 'hired').map(c => c.id)
    if (ids.length) {
     const { data: responses } = await db.from('ap_hiring_responses')
      .select('video_path').in('candidate_id', ids).neq('video_path', '')
     const paths = videoPaths(responses)
     if (paths.length) {
      const { error: removeError } = await db.storage.from(BUCKET).remove(paths)
      if (!removeError) deleted = paths.length
     }
     if (!paths.length || deleted) {
      await db.from('ap_hiring_responses').update({ video_path: '' }).in('candidate_id', ids).neq('video_path', '')
      await db.from('ap_hiring_candidates')
       .update({ media_deleted_at: new Date().toISOString(), media_deleted_by: auth.profile?.name || 'A panel member' })
       .in('id', ids)
     }
    }
   }
   return res.json({ status, title: data.title, deleted })
  }

  if (action === 'invite') {
   const postingId = String(req.body?.postingId || '')
   if (!UUID.test(postingId)) return no(res, 400, 'Choose a position.')
   const { data: posting } = await db.from('ap_hiring_postings')
    .select('id, status, title, invite_subject, invite_body, invite_hours').eq('id', postingId).eq('school_id', school.schoolId).maybeSingle()
   if (!posting?.id) return no(res, 404, 'That position does not belong to this school.')
   if (['closed', 'filled'].includes(posting.status)) return no(res, 409, 'That position is closed. Reopen it before inviting anyone else.')

   let input
   try { input = candidateInput(req.body) } catch (e) { return no(res, 400, e.message) }

   // How long they have to submit, which is also how long the code works: one number, so the date in
   // the email and the moment the code dies are the same thing. A position carries its own default.
   const asked = Number(req.body?.hours)
   const hours = Number.isInteger(asked) && asked >= 1 && asked <= 720 ? asked : (posting.invite_hours || DEFAULT_INVITE_HOURS)
   // One retry, because a duplicate code is possible and astronomically unlikely, and a candidate
   // who cannot be invited because of a coin flip is a bad afternoon for somebody.
   let created = null
   for (let attempt = 0; attempt < 2 && !created; attempt++) {
    const { data, error } = await db.from('ap_hiring_candidates').insert({
     school_id: school.schoolId, posting_id: postingId,
     name: input.name, email: input.email, phone: input.phone, cert_areas: input.certAreas,
     invite_code: makeInviteCode(),
     invite_expires_at: new Date(Date.now() + hours * 3600000).toISOString(),
     delete_after: disposalDate(),
     created_by: auth.user.id,
    }).select('id, invite_code, invite_expires_at').single()
    if (!error) { created = data; break }
    if (!/duplicate key|unique/i.test(error.message || '')) throw error
   }
   if (!created) return no(res, 503, 'Could not create that invitation. Please try again.')

   // Email the candidate their link and code. The code is also returned so the panel can send it by
   // hand if mail is not set up or the send fails; the invitation exists either way.
   const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0]
   const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0]
   const site = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.askvic.ai')
   const { data: schoolRow } = await db.from('ap_schools').select('name').eq('id', school.schoolId).maybeSingle()
   const message = inviteMessage({
    name: input.name, schoolName: schoolRow?.name, positionTitle: posting.title,
    code: created.invite_code, expiresAt: created.invite_expires_at, link: `${site}/hiring-screening`,
    senderName: auth.profile?.name,
    subject: posting.invite_subject, body: posting.invite_body,
   })
   const emailed = await sendInvite({ to: input.email, replyTo: auth.user?.email, ...message, key: `hiring-invite-${created.id}` })
   return res.json({ candidateId: created.id, code: created.invite_code, expiresAt: created.invite_expires_at, emailed })
  }

  // The invitation email for one position, and its default time to submit. Sending an empty subject
  // and message puts the position back on the standard wording.
  if (action === 'save-invite-template') {
   const postingId = String(req.body?.postingId || '')
   if (!UUID.test(postingId)) return no(res, 400, 'Choose a position.')
   const hours = Number(req.body?.hours)
   if (!Number.isInteger(hours) || hours < 1 || hours > 720) return no(res, 400, 'Time to submit must be between 1 and 720 hours.')
   const subject = String(req.body?.subject ?? '')
   const body = String(req.body?.body ?? '')
   const reset = !subject.trim() && !body.trim()
   if (!reset) {
    const check = checkTemplate(subject, body)
    if (!check.ok) return no(res, 400, check.error)
   }
   const { data, error } = await db.from('ap_hiring_postings')
    .update({ invite_subject: reset ? null : subject, invite_body: reset ? null : body, invite_hours: hours })
    .eq('id', postingId).eq('school_id', school.schoolId).select('id').maybeSingle()
   if (error) throw error
   if (!data?.id) return no(res, 404, 'That position does not belong to this school.')
   return res.json({ saved: true, reset })
  }

  // More time for one candidate. Same code, new deadline: a family emergency on Saturday should not
  // cost anyone the job, and it should not mean a second invitation either.
  if (action === 'extend-invite') {
   const candidateId = String(req.body?.candidateId || '')
   const hours = Number(req.body?.hours)
   if (!UUID.test(candidateId) || !Number.isInteger(hours) || hours < 1 || hours > 720) return no(res, 400, 'Choose a candidate and a number of hours.')
   const { data: c } = await db.from('ap_hiring_candidates')
    .select('id, submitted_at, session_token').eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
   if (!c?.id) return no(res, 404, 'That candidate does not belong to this school.')
   if (c.submitted_at) return no(res, 409, 'They have already submitted.')
   const until = new Date(Date.now() + hours * 3600000).toISOString()
   const { error } = await db.from('ap_hiring_candidates')
    .update({ invite_expires_at: until, ...(c.session_token ? { session_expires_at: until } : {}) })
    .eq('id', candidateId)
   if (error) throw error
   return res.json({ expiresAt: until })
  }

  // Editing a question on one position. Questions are copied per position, so this changes this
  // job's rubric and nothing else -- last spring's scored candidates keep the wording they were
  // actually asked.
  //
  // The guard that matters: a video or written question somebody has already answered. Rewording it
  // leaves a recording of one question filed under the text of another, which is how a panel ends up
  // scoring an answer against a bar the candidate never heard. The screen has to say so and pass
  // confirmed, rather than this happening quietly.
  if (action === 'save-question') {
   const questionId = String(req.body?.questionId || '')
   if (!UUID.test(questionId)) return no(res, 400, 'Choose a question.')
   const { data: question } = await db.from('ap_hiring_questions')
    .select('id, stage, posting_id').eq('id', questionId).eq('school_id', school.schoolId).maybeSingle()
   if (!question?.id) return no(res, 404, 'That question does not belong to this school.')

   let fields
   try { fields = questionEdit(req.body) } catch (e) { return no(res, 400, e.message) }

   if (question.stage !== 'interview' && req.body?.confirmed !== true) {
    const { count } = await db.from('ap_hiring_responses')
     .select('id', { count: 'exact', head: true }).eq('question_id', questionId)
    if (count) {
     return no(res, 409, `${count} ${count === 1 ? 'candidate has' : 'candidates have'} already answered this question as it is written. Changing it now means their recording is filed under wording they never heard.`)
    }
   }

   const { error } = await db.from('ap_hiring_questions').update(fields).eq('id', questionId)
   if (error) throw error
   return res.json({ saved: true })
  }

  // Delete one candidate's recordings now, rather than waiting out the retention period. Video is
  // nearly all the storage a school uses here, and a principal who has finished with three
  // candidates should not have to carry six months of their video.
  //
  // The recordings only. Scores, notes, written answers and the resume stay, because they are the
  // record of how the decision was made and an employer may be required to keep them.
  if (action === 'delete-media') {
   const candidateId = String(req.body?.candidateId || '')
   if (!UUID.test(candidateId)) return no(res, 400, 'Choose a candidate.')
   const { data: candidate } = await db.from('ap_hiring_candidates')
    .select('id, name, stage, media_deleted_at').eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
   if (!candidate?.id) return no(res, 404, 'That candidate does not belong to this school.')

   const { data: responses } = await db.from('ap_hiring_responses')
    .select('id, video_path').eq('candidate_id', candidateId).neq('video_path', '')
   const paths = videoPaths(responses)
   const { count: scorerCount } = await db.from('ap_hiring_scores')
    .select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId)

   const allowed = mayDeleteMedia({ stage: candidate.stage, scorerCount: scorerCount || 0, hasVideo: paths.length > 0 })
   if (!allowed.ok) return no(res, 409, allowed.reason)

   const { error: removeError } = await db.storage.from(BUCKET).remove(paths)
   if (removeError) return no(res, 503, 'Those recordings could not be deleted just now. Please try again.')

   await db.from('ap_hiring_responses').update({ video_path: '' }).eq('candidate_id', candidateId).neq('video_path', '')
   const { error } = await db.from('ap_hiring_candidates')
    .update({ media_deleted_at: new Date().toISOString(), media_deleted_by: auth.profile?.name || 'A panel member' })
    .eq('id', candidateId)
   if (error) throw error
   return res.json({ deleted: paths.length, summary: disposalSummary({ candidates: 1, files: paths.length, failed: 0 }) })
  }

  if (action === 'score') {
   let responseId = String(req.body?.responseId || '')
   // An in-person question has no recording or text, so there is no response row until somebody
   // scores it. The first scorer's save creates it (same candidate and question, one row), and a
   // second scorer arriving at the same moment lands on the same row.
   if (!UUID.test(responseId) && UUID.test(String(req.body?.candidateId || '')) && UUID.test(String(req.body?.questionId || ''))) {
    const { data: cand } = await db.from('ap_hiring_candidates')
     .select('id, posting_id').eq('id', req.body.candidateId).eq('school_id', school.schoolId).maybeSingle()
    const { data: q } = cand?.id ? await db.from('ap_hiring_questions')
     .select('id, stage').eq('id', req.body.questionId).eq('posting_id', cand.posting_id).maybeSingle() : { data: null }
    if (!q?.id || q.stage !== 'interview') return no(res, 400, 'Only in-person questions can be scored before an answer exists.')
    const { data: made, error: madeError } = await db.from('ap_hiring_responses').upsert({
     school_id: school.schoolId, candidate_id: cand.id, question_id: q.id, stage: 'interview',
    }, { onConflict: 'candidate_id,question_id', ignoreDuplicates: true }).select('id').maybeSingle()
    if (madeError) throw madeError
    const { data: found } = made?.id ? { data: made } : await db.from('ap_hiring_responses')
     .select('id').eq('candidate_id', cand.id).eq('question_id', q.id).maybeSingle()
    responseId = found?.id || ''
   }
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

  // The optional rounds either side of the recorded interview: the resume screen and the teaching
  // demonstration. Saved per scorer, like every other score here, so a second panel member scoring
  // the demo never overwrites the first.
  if (action === 'round-score') {
   const candidateId = String(req.body?.candidateId || '')
   const round = String(req.body?.round || '')
   const spec = roundByKey(round)
   if (!UUID.test(candidateId)) return no(res, 400, 'Choose a candidate.')
   if (!spec?.lines) return no(res, 400, 'That is not a round you can score this way.')

   const { data: candidate } = await db.from('ap_hiring_candidates')
    .select('id').eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
   if (!candidate?.id) return no(res, 404, 'That candidate does not belong to this school.')

   // Only keys the rubric defines survive, and each is clamped to its own maximum. A stale or
   // hand-edited payload cannot inflate a total.
   const points = {}
   for (const line of spec.lines) {
    const raw = req.body?.points?.[line.key]
    if (spec.kind === 'checklist') { if (raw === true) points[line.key] = true; continue }
    const value = Number(raw)
    if (Number.isFinite(value) && value > 0) points[line.key] = Math.min(Math.round(value), line.max)
   }
   const total = roundTotal(round, points)
   const { error } = await db.from('ap_hiring_round_scores').upsert({
    school_id: school.schoolId, candidate_id: candidateId,
    scorer_user_id: auth.user.id, scorer_name: auth.profile?.name || '',
    round, points, total, skipped: false,
    note: String(req.body?.note || '').trim().slice(0, 4000),
    updated_at: new Date().toISOString(),
   }, { onConflict: 'candidate_id,scorer_user_id,round' })
   if (error) throw error
   return res.json({ saved: true, total, max: roundMax(round) })
  }

  // "We did not do this round" is recorded, not deleted. A deleted row reads as "nobody has got to
  // this yet", which is the opposite fact: a skipped round should stop holding the ladder open,
  // and an unscored one should keep the candidate waiting.
  if (action === 'round-clear') {
   const candidateId = String(req.body?.candidateId || '')
   const round = String(req.body?.round || '')
   if (!UUID.test(candidateId) || !roundByKey(round)?.lines) return no(res, 400, 'Choose a candidate and a round.')
   const { data: candidate } = await db.from('ap_hiring_candidates')
    .select('id').eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
   if (!candidate?.id) return no(res, 404, 'That candidate does not belong to this school.')
   const { error } = await db.from('ap_hiring_round_scores').upsert({
    school_id: school.schoolId, candidate_id: candidateId,
    scorer_user_id: auth.user.id, scorer_name: auth.profile?.name || '',
    round, points: {}, total: 0, skipped: true, note: '',
    updated_at: new Date().toISOString(),
   }, { onConflict: 'candidate_id,scorer_user_id,round' })
   if (error) throw error
   return res.json({ skipped: true })
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
  .select('id, title, grade_band, subject, status, created_at, invite_subject, invite_body, invite_hours')
  .eq('school_id', school.schoolId).order('created_at', { ascending: false }).limit(100)
 if (error) throw error

 const { data: candidates } = await db.from('ap_hiring_candidates')
  .select('id, posting_id, name, email, stage, submitted_at, created_at, delete_after, media_deleted_at')
  .eq('school_id', school.schoolId).order('created_at', { ascending: false }).limit(500)

 const { data: scores } = await db.from('ap_hiring_scores')
  .select('candidate_id, scorer_user_id, content, fit, writing, ap_hiring_responses(stage)')
  .eq('school_id', school.schoolId).limit(20000)

 const byCandidate = new Map()
 for (const s of scores || []) {
  if (!byCandidate.has(s.candidate_id)) byCandidate.set(s.candidate_id, { total: 0, video: 0, written: 0, scorers: new Set() })
  const entry = byCandidate.get(s.candidate_id)
  const points = (s.content || 0) + (s.fit || 0) + (s.writing || 0)
  const stage = s.ap_hiring_responses?.stage
  // The list's total is the screening total (video plus written). In-person points live in their
  // own round on the packet, so they are not folded in here.
  if (stage === 'video') { entry.video += points; entry.total += points }
  else if (stage === 'written') { entry.written += points; entry.total += points }
  else continue
  entry.scorers.add(s.scorer_user_id)
 }

 // Archived means the position is filled or closed, rather than a second flag on every candidate
 // that could drift away from it.
 const archivedPostings = new Set((postings || []).filter(p => ['filled', 'closed'].includes(p.status)).map(p => p.id))

 const rows = (candidates || []).map(c => {
  const entry = byCandidate.get(c.id)
  return {
   id: c.id, postingId: c.posting_id, name: c.name, email: c.email, stage: c.stage,
   archived: archivedPostings.has(c.posting_id),
   submittedAt: c.submitted_at, deleteAfter: c.delete_after, mediaDeletedAt: c.media_deleted_at,
   total: entry?.total || 0,
   video: entry?.video || 0,
   written: entry?.written || 0,
   scorers: entry?.scorers.size || 0,
  }
 })

 return res.json({
  postings: (postings || []).map(p => ({
   id: p.id, title: p.title, gradeBand: p.grade_band, subject: p.subject, status: p.status, createdAt: p.created_at,
   inviteSubject: p.invite_subject || DEFAULT_INVITE_SUBJECT,
   inviteBody: p.invite_body || DEFAULT_INVITE_BODY,
   inviteHours: p.invite_hours || DEFAULT_INVITE_HOURS,
   inviteCustom: Boolean(p.invite_subject || p.invite_body),
  })),
  inviteHelp: { placeholders: INVITE_PLACEHOLDERS, defaultSubject: DEFAULT_INVITE_SUBJECT, defaultBody: DEFAULT_INVITE_BODY, defaultHours: DEFAULT_INVITE_HOURS },
  // Ranked, but a candidate nobody has scored yet is flagged rather than quietly ranked last: an
  // unscored answer is a missing scorer, not a zero.
  candidates: rankCandidates(rows),
  stageTotals: STAGE_TOTALS,
 })
}

async function review(db, auth, school, candidateId, res) {
 if (!UUID.test(candidateId)) return no(res, 400, 'Choose a candidate.')
 const { data: candidate } = await db.from('ap_hiring_candidates')
  .select('id, posting_id, name, email, phone, cert_areas, stage, submitted_at, commute_sustainable, delete_after, invite_code, invite_expires_at, resume_path, resume_name, media_deleted_at, media_deleted_by')
  .eq('id', candidateId).eq('school_id', school.schoolId).maybeSingle()
 if (!candidate?.id) return no(res, 404, 'That candidate does not belong to this school.')

 const [{ data: questions }, { data: responses }, { data: scores }, { data: roundRows }] = await Promise.all([
  db.from('ap_hiring_questions')
   .select('id, stage, ordinal, prompt, domain, look_for_strong, look_for_weak, max_content, max_fit, max_writing')
   .eq('posting_id', candidate.posting_id).order('stage').order('ordinal'),
  db.from('ap_hiring_responses')
   .select('id, question_id, stage, video_path, video_seconds, text_response, submitted_at')
   .eq('candidate_id', candidateId),
  db.from('ap_hiring_scores')
   .select('response_id, scorer_user_id, scorer_name, content, fit, writing, note, voice_mismatch')
   .eq('candidate_id', candidateId),
  db.from('ap_hiring_round_scores')
   .select('round, scorer_user_id, scorer_name, points, total, note, skipped')
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

 // The resume opens the same way the recordings do: a short-lived signed link, never a public URL.
 let resumeUrl = null
 if (candidate.resume_path) {
  const { data: r } = await db.storage.from(BUCKET).createSignedUrl(candidate.resume_path, PLAYBACK_SECONDS)
  resumeUrl = r?.signedUrl || null
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
 const interviewBy = new Map()
 for (const s of scores || []) {
  // In-person scores are tracked apart from the screening scorers so someone who has only scored
  // the in-person round does not appear in, or light, the video and written results.
  if (responseStage.get(s.response_id) === 'interview') {
   const cur = interviewBy.get(s.scorer_user_id) || { name: s.scorer_name || 'Panel member', isMe: s.scorer_user_id === mine, points: 0, scored: 0 }
   cur.points += (s.content || 0) + (s.fit || 0) + (s.writing || 0)
   cur.scored += 1
   interviewBy.set(s.scorer_user_id, cur)
   continue
  }
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
  maxVideo: maxFor('video'), maxWritten: maxFor('written'), maxInterview: maxFor('interview'),
  interview: [...interviewBy.values()].map(r => ({ name: r.name, isMe: r.isMe, points: r.points, scored: r.scored })),
  interviewQuestions: (questions || []).filter(q => q.stage === 'interview').length,
  maxTotal: maxFor('video') + maxFor('written'),
  answers: answerCount('video') + answerCount('written'),
  scorers: scorerRows,
  // The panel number is the sum of every member's scores, which is how the ranking works: highest
  // combined total advances, and nobody holds a veto.
  panel: scorerRows.reduce((a, r) => ({ video: a.video + r.video, written: a.written + r.written, total: a.total + r.total }), { video: 0, written: 0, total: 0 }),
 }

 // The packet: every round this candidate has actually been through, with its own total, and one
 // combined figure at the end. Rounds nobody scored are marked skipped and are left out of both
 // sides of that figure, so a candidate who did four rounds is not judged against one who did six.
 const roundsByKey = new Map()
 for (const r of roundRows || []) {
  if (!roundsByKey.has(r.round)) roundsByKey.set(r.round, { total: 0, scorers: new Set(), entries: [], skipped: true })
  const entry = roundsByKey.get(r.round)
  if (r.skipped) continue
  entry.skipped = false
  entry.total += Number(r.total) || 0
  entry.scorers.add(r.scorer_user_id)
  entry.entries.push({
   name: r.scorer_name || 'Panel member', isMe: r.scorer_user_id === mine,
   points: r.points || {}, total: Number(r.total) || 0, note: r.note || '',
  })
 }

 const packetRows = ROUNDS.map(round => {
  if (round.key === 'interview') {
   // Lit only for scorers who have scored every in-person question. The interview happens live and a
   // scorer is saved question by question, so one score in must not light the rung or put half a
   // total in the packet.
   const expected = (questions || []).filter(q => q.stage === 'interview').length
   const interviewRows = [...interviewBy.values()]
   const complete = interviewRows.filter(r => expected > 0 && r.scored >= expected)
   if (!complete.length) return { key: 'interview', scored: false }
   return { key: 'interview', scored: true, total: complete.reduce((a, r) => a + r.points, 0), max: totals.maxInterview * complete.length, scorers: complete.length }
  }
  if (round.key === 'video' || round.key === 'written') {
   const max = round.key === 'video' ? totals.maxVideo : totals.maxWritten
   const earned = round.key === 'video' ? totals.panel.video : totals.panel.written
   const scorers = totals.scorers.length
   if (!scorers) return { key: round.key, scored: false }
   return { key: round.key, scored: true, total: earned, max: max * scorers, scorers }
  }
  const entry = roundsByKey.get(round.key)
  if (!entry) return { key: round.key, scored: false }
  if (entry.skipped) return { key: round.key, scored: false, skipped: true }
  return { key: round.key, scored: true, total: entry.total, max: roundMax(round.key) * entry.scorers.size, scorers: entry.scorers.size }
 })

 return res.json({
  totals,
  packet: packet(packetRows),
  ladder: ladderState(packetRows, candidate.stage),
  rounds: ROUNDS.filter(r => r.lines).map(r => ({
   key: r.key, label: r.label, blurb: r.blurb, kind: r.kind, optional: r.optional,
   max: roundMax(r.key), lines: r.lines,
   skipped: roundsByKey.get(r.key)?.skipped === true,
   mine: (roundsByKey.get(r.key)?.entries || []).find(e => e.isMe) || null,
   others: (roundsByKey.get(r.key)?.entries || []).filter(e => !e.isMe),
  })),
  candidate: {
   id: candidate.id, name: candidate.name, email: candidate.email, phone: candidate.phone,
   certAreas: candidate.cert_areas, stage: candidate.stage, submittedAt: candidate.submitted_at,
   commuteSustainable: candidate.commute_sustainable, deleteAfter: candidate.delete_after,
   inviteCode: candidate.invite_code, inviteExpiresAt: candidate.invite_expires_at,
   resumeUrl, resumeName: candidate.resume_name || (candidate.resume_path ? 'Resume' : ''),
   mediaDeletedAt: candidate.media_deleted_at, mediaDeletedBy: candidate.media_deleted_by,
   hasVideo: (responses || []).some(r => r.video_path),
  },
  items,
 })
}
