import { serviceDb } from '../../../lib/service-db'
import { normalizeInviteCode } from '../../../lib/hiring.mjs'
import {
 BUCKET, allowedUpload, uploadPath, verifiedPath, makeSessionToken, sessionExpiry,
 RECORDING_NOTICE, VIDEO_LIMIT_SECONDS, MAX_VIDEO_BYTES, MAX_RESUME_BYTES,
} from '../../../lib/hiring-media.mjs'

// The candidate's side of the screening interview. Nobody is signed in here: an invited candidate
// types the code from their email, and that code is the only thing standing in front of their
// application, so it is single-use and it expires.
//
// Every byte of video goes straight from the browser to storage through a signed URL. This endpoint
// only ever handles small JSON, which is why the body limit below is tiny -- a five-minute
// recording could not pass through a serverless function even if we wanted it to.

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

const COOKIE = 'askvic_hiring_session'
const no = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra })

function setSessionCookie(req, res, token, maxAgeSeconds) {
 const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? ' Secure;' : ''
 res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly;${secure} SameSite=Strict; Max-Age=${maxAgeSeconds}`)
}

function readSessionToken(req) {
 const raw = req.headers.cookie || ''
 const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([0-9a-f]{64})(?:;|$)`))
 return match?.[1] || null
}

// The candidate behind the cookie, or null. Expiry is checked here and not trusted to the cookie's
// own Max-Age, which the browser owns and we do not.
async function currentCandidate(db, req) {
 const token = readSessionToken(req)
 if (!token) return null
 const { data } = await db.from('ap_hiring_candidates')
  .select('id, school_id, posting_id, name, email, stage, session_expires_at, recording_notice_accepted_at, commute_sustainable, submitted_at')
  .eq('session_token', token).maybeSingle()
 if (!data?.id) return null
 if (data.session_expires_at && Date.parse(data.session_expires_at) <= Date.now()) return null
 return data
}

// What the candidate is asked, in order, with the look-fors stripped out. The look-fors are the
// panel's scoring guide; showing them to a candidate would just be handing out the answer key.
async function questionsFor(db, postingId) {
 const { data } = await db.from('ap_hiring_questions')
  .select('id, stage, ordinal, prompt, domain')
  .eq('posting_id', postingId).in('stage', ['video', 'written'])
  .order('stage').order('ordinal')
 return (data || []).map(q => ({ id: q.id, stage: q.stage, ordinal: q.ordinal, prompt: q.prompt, domain: q.domain }))
}

async function responsesFor(db, candidateId) {
 const { data } = await db.from('ap_hiring_responses')
  .select('question_id, stage, video_path, video_seconds, text_response, submitted_at')
  .eq('candidate_id', candidateId)
 return data || []
}

async function state(db, candidate) {
 const [questions, responses] = await Promise.all([
  questionsFor(db, candidate.posting_id),
  responsesFor(db, candidate.id),
 ])
 const done = new Map(responses.map(r => [r.question_id, r]))
 return {
  candidate: {
   name: candidate.name,
   email: candidate.email,
   consented: Boolean(candidate.recording_notice_accepted_at),
   commuteAnswered: Boolean(candidate.commute_sustainable),
   submitted: Boolean(candidate.submitted_at),
  },
  notice: RECORDING_NOTICE,
  limits: { videoSeconds: VIDEO_LIMIT_SECONDS, videoBytes: MAX_VIDEO_BYTES, resumeBytes: MAX_RESUME_BYTES },
  questions: questions.map(q => ({
   ...q,
   answered: done.has(q.id),
   seconds: done.get(q.id)?.video_seconds ?? null,
   words: q.stage === 'written' ? String(done.get(q.id)?.text_response || '').trim().split(/\s+/).filter(Boolean).length : null,
  })),
 }
}

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'private, no-store')
 if (!['GET', 'POST'].includes(req.method)) {
  res.setHeader('Allow', 'GET, POST')
  return no(res, 405, 'Method not allowed.')
 }
 const db = serviceDb()
 if (!db) return no(res, 503, 'The interview service is temporarily unavailable. Please call the school office.')

 try {
  if (req.method === 'GET') {
   const candidate = await currentCandidate(db, req)
   if (!candidate) return res.json({ session: false })
   return res.json({ session: true, ...(await state(db, candidate)) })
  }

  const action = String(req.body?.action || '')

  // Entering a code. Claimed once, by one person: a code that still works after it has been used
  // is a code that can be forwarded, and then two people record into one application.
  if (action === 'enter') {
   const code = normalizeInviteCode(req.body?.code)
   if (!code) return no(res, 400, 'Enter the twelve-character code from your invitation email.')
   const { data: candidate } = await db.from('ap_hiring_candidates')
    .select('id, posting_id, name, invite_expires_at, claimed_at, session_token, session_expires_at, submitted_at')
    .eq('invite_code', code).maybeSingle()
   if (!candidate?.id) return no(res, 403, 'That code was not recognised. Check it against your invitation email, or call the school office.')
   if (candidate.invite_expires_at && Date.parse(candidate.invite_expires_at) <= Date.now()) {
    return no(res, 403, 'That invitation has expired. Call the school office and we will send you a new one.')
   }
   // Already claimed, and the claiming session is still alive: this is somebody returning on a
   // different device or after clearing cookies, which is ordinary. Hand them a fresh session for
   // the same application rather than locking them out of their own interview.
   const token = makeSessionToken()
   const expires = sessionExpiry()
   const { error } = await db.from('ap_hiring_candidates')
    .update({ claimed_at: candidate.claimed_at || new Date().toISOString(), session_token: token, session_expires_at: expires })
    .eq('id', candidate.id)
   if (error) throw error
   setSessionCookie(req, res, token, 14 * 86400)
   const fresh = await currentCandidate(db, req) || { ...candidate, session_token: token }
   return res.json({ session: true, ...(await state(db, { ...fresh, id: candidate.id, posting_id: candidate.posting_id })) })
  }

  const candidate = await currentCandidate(db, req)
  if (!candidate) return no(res, 401, 'Your interview session has expired. Enter your code again, or call the school office.')
  if (candidate.submitted_at && action !== 'state') {
   return no(res, 409, 'Your interview has already been submitted. Call the school office if you need to change something.')
  }

  // The recording notice, and the commute question the candidate answers for themselves. Commute is
  // never scored -- a points system built on where people live tracks housing patterns.
  if (action === 'consent') {
   if (req.body?.consent !== true) return no(res, 400, 'Please confirm you have read the recording notice before you begin.')
   const commute = typeof req.body?.commute === 'string' ? req.body.commute.trim().slice(0, 600) : ''
   const { error } = await db.from('ap_hiring_candidates')
    .update({ recording_notice_accepted_at: new Date().toISOString(), commute_sustainable: commute })
    .eq('id', candidate.id)
   if (error) throw error
   return res.json({ session: true, ...(await state(db, { ...candidate, recording_notice_accepted_at: new Date().toISOString(), commute_sustainable: commute })) })
  }

  if (!candidate.recording_notice_accepted_at) {
   return no(res, 409, 'Read the recording notice and confirm it before uploading anything.')
  }

  // A signed URL to upload one file, for a path this server names. The candidate does not get to
  // choose the path: a candidate-supplied path is how one applicant overwrites another's video.
  if (action === 'upload-url') {
   const kind = String(req.body?.kind || '')
   const check = allowedUpload(kind, req.body?.contentType, req.body?.bytes)
   if (!check.ok) return no(res, 400, check.error)
   const unique = makeSessionToken().slice(0, 16)
   const path = uploadPath(candidate.id, kind, check.type, unique)
   if (!path || !verifiedPath(candidate.id, kind, path)) return no(res, 400, 'Could not prepare that upload. Please try again.')
   const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
   if (error || !data?.signedUrl) return no(res, 503, 'Could not start that upload. Please try again in a moment.')
   return res.json({ path, signedUrl: data.signedUrl, token: data.token, contentType: check.type })
  }

  // The browser confirms an upload finished. The file is checked against storage rather than taken
  // on trust: a confirm with no object behind it would show a principal an answer that is not there.
  if (action === 'file') {
   const kind = String(req.body?.kind || '')
   const path = String(req.body?.path || '')
   const questionId = String(req.body?.questionId || '')
   if (!verifiedPath(candidate.id, kind, path)) return no(res, 400, 'Unexpected file path.')
   if (!/^[0-9a-f-]{36}$/i.test(questionId)) return no(res, 400, 'Unknown question.')

   const { data: question } = await db.from('ap_hiring_questions')
    .select('id, stage, ordinal').eq('id', questionId).eq('posting_id', candidate.posting_id).maybeSingle()
   if (!question?.id || question.stage !== 'video') return no(res, 400, 'That is not a video question on this interview.')
   if (kind !== `q${question.ordinal}`) return no(res, 400, 'That file does not belong to that question.')

   const name = path.split('/').pop()
   const { data: listed } = await db.storage.from(BUCKET).list(`candidates/${candidate.id}`, { search: name, limit: 1 })
   const object = (listed || []).find(o => o.name === name)
   const size = object?.metadata?.size
   if (!object || !Number(size)) return no(res, 400, 'That upload did not finish. Please try recording that answer again.')
   const recheck = allowedUpload(kind, object.metadata?.mimetype, size)
   if (!recheck.ok) {
    await db.storage.from(BUCKET).remove([path]).catch(() => {})
    return no(res, 400, recheck.error)
   }

   const seconds = Number.isFinite(Number(req.body?.seconds)) ? Math.max(0, Math.min(7200, Math.round(Number(req.body.seconds)))) : null
   const { data: prior } = await db.from('ap_hiring_responses')
    .select('id, video_path').eq('candidate_id', candidate.id).eq('question_id', questionId).maybeSingle()

   const row = {
    school_id: candidate.school_id, candidate_id: candidate.id, question_id: questionId,
    stage: 'video', video_path: path, video_seconds: seconds, submitted_at: new Date().toISOString(),
   }
   const { error } = prior?.id
    ? await db.from('ap_hiring_responses').update(row).eq('id', prior.id)
    : await db.from('ap_hiring_responses').insert(row)
   if (error) throw error

   // Only once the new take is recorded does the old one go. A retake that deletes first and fails
   // second leaves the candidate with no answer and no way to tell.
   if (prior?.video_path && prior.video_path !== path) {
    await db.storage.from(BUCKET).remove([prior.video_path]).catch(() => {})
   }
   return res.json({ session: true, ...(await state(db, candidate)) })
  }

  if (action === 'written') {
   const questionId = String(req.body?.questionId || '')
   const text = typeof req.body?.text === 'string' ? req.body.text.trim() : ''
   if (!/^[0-9a-f-]{36}$/i.test(questionId)) return no(res, 400, 'Unknown question.')
   if (text.length < 20) return no(res, 400, 'Write a little more before saving this answer.')
   if (text.length > 20000) return no(res, 400, 'That answer is longer than this form can save. A single paragraph is what we are looking for.')
   const { data: question } = await db.from('ap_hiring_questions')
    .select('id, stage').eq('id', questionId).eq('posting_id', candidate.posting_id).maybeSingle()
   if (!question?.id || question.stage !== 'written') return no(res, 400, 'That is not a written question on this interview.')
   const { data: prior } = await db.from('ap_hiring_responses')
    .select('id').eq('candidate_id', candidate.id).eq('question_id', questionId).maybeSingle()
   const row = {
    school_id: candidate.school_id, candidate_id: candidate.id, question_id: questionId,
    stage: 'written', text_response: text, submitted_at: new Date().toISOString(),
   }
   const { error } = prior?.id
    ? await db.from('ap_hiring_responses').update(row).eq('id', prior.id)
    : await db.from('ap_hiring_responses').insert(row)
   if (error) throw error
   return res.json({ session: true, ...(await state(db, candidate)) })
  }

  if (action === 'submit') {
   const [questions, responses] = await Promise.all([
    questionsFor(db, candidate.posting_id),
    responsesFor(db, candidate.id),
   ])
   const answered = new Set(responses.map(r => r.question_id))
   const missing = questions.filter(q => !answered.has(q.id))
   if (missing.length) {
    return no(res, 400, `Finish every question before submitting. Still to do: ${missing.map(q => `${q.stage === 'video' ? 'video' : 'written'} ${q.ordinal}`).join(', ')}.`)
   }
   const now = new Date().toISOString()
   const { error } = await db.from('ap_hiring_candidates')
    .update({ submitted_at: now, stage: 'screening_submitted', session_token: null, session_expires_at: null })
    .eq('id', candidate.id).is('submitted_at', null)
   if (error) throw error
   setSessionCookie(req, res, '0'.repeat(64), 0)
   return res.json({ submitted: true, name: candidate.name })
  }

  if (action === 'state') return res.json({ session: true, ...(await state(db, candidate)) })
  return no(res, 400, 'Unknown action.')
 } catch (error) {
  console.error('Hiring screening request failed', error instanceof Error ? error.name : 'Error')
  return no(res, 503, 'We could not save that just now. Your recording stays on this device until you leave the page. Please try again, or call the school office.')
 }
}
