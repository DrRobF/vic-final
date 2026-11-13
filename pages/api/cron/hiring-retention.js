import { serviceDb } from '../../../lib/service-db'
import { BUCKET } from '../../../lib/hiring-media.mjs'
import { dueForDisposal, videoPaths, disposalSummary, RETENTION_DAYS } from '../../../lib/hiring-retention.mjs'

// The daily job that keeps the promise on the recording notice: video answers are deleted within
// 180 days. Runs from Vercel cron (see vercel.json).
//
// Fails closed. Without CRON_SECRET set this endpoint deletes nothing at all, because an unsecured
// URL that erases applicant video is worse than a job that has not been switched on yet -- and a
// job that silently does nothing is worse than both, so it says which of the two it is.
//
// Only recordings are removed. Scores, notes, written answers and the resume stay: they are the
// record of how a decision was made, and a stamp on the candidate row shows the video is gone.

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 const secret = process.env.CRON_SECRET
 if (!secret) {
  console.error('Hiring retention job is not configured: CRON_SECRET is not set, so nothing was deleted.')
  return res.status(503).json({ error: 'This job is not configured. Set CRON_SECRET to switch it on.' })
 }
 if (req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Not authorised.' })

 const db = serviceDb()
 if (!db) return res.status(503).json({ error: 'Storage is unavailable; nothing was deleted.' })

 try {
  // A page at a time, oldest first, so one very large day cannot run past the function's time limit
  // and leave the rest untouched for good: whatever is missed is simply due again tomorrow.
  const { data: candidates, error } = await db.from('ap_hiring_candidates')
   .select('id, delete_after, media_deleted_at')
   .is('media_deleted_at', null).not('delete_after', 'is', null)
   .order('delete_after', { ascending: true }).limit(200)
  if (error) throw error

  const due = dueForDisposal(candidates)
  let files = 0
  let failed = 0
  const cleared = []

  for (const candidate of due) {
   const { data: responses } = await db.from('ap_hiring_responses')
    .select('id, video_path').eq('candidate_id', candidate.id).neq('video_path', '')
   const paths = videoPaths(responses)

   if (paths.length) {
    const { error: removeError } = await db.storage.from(BUCKET).remove(paths)
    if (removeError) { failed += paths.length; continue }
    files += paths.length
   }

   // The path is cleared only once the object is gone, so a row never claims a recording exists
   // when it does not, nor the reverse -- the reverse is what orphans files nobody can find.
   await db.from('ap_hiring_responses').update({ video_path: '', video_bytes: null }).eq('candidate_id', candidate.id).neq('video_path', '')
   cleared.push(candidate.id)
  }

  if (cleared.length) {
   await db.from('ap_hiring_candidates')
    .update({ media_deleted_at: new Date().toISOString(), media_deleted_by: 'retention job' })
    .in('id', cleared)
  }

  const summary = disposalSummary({ candidates: cleared.length, files, failed })
  console.log(`Hiring retention (${RETENTION_DAYS} days): ${summary}`)
  return res.json({ candidates: cleared.length, files, failed, summary })
 } catch (e) {
  console.error('Hiring retention job failed', e instanceof Error ? e.name : 'Error')
  return res.status(503).json({ error: 'The retention job could not finish. It will run again tomorrow.' })
 }
}
