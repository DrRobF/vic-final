// Keeping the promise on the recording notice: video answers are deleted within 180 days.
//
// One rule, so it can be explained to a candidate in a sentence and to a board in two: the
// recordings go, the written record stays. Scores, notes, written answers, resume and dates are how
// a hiring decision can be shown to have been made fairly -- and an employer may be required to
// keep them. The video is the part that was only ever needed while the panel was watching it.
//
// Deletion also happens on request, long before the deadline. A principal who has finished with
// three candidates should not be made to carry their video for six months, and video is almost all
// of the storage a school will ever use here.

import { RETENTION_DAYS } from './hiring-media.mjs'

export { RETENTION_DAYS }

// Which candidates are past their disposal date and still hold video. Dates are compared as plain
// days because delete_after is a date, not a moment: "today" is the whole of today everywhere.
export function dueForDisposal(candidates, now = new Date()) {
 const today = new Date(now).toISOString().slice(0, 10)
 return (candidates || []).filter(c => {
  if (!c?.delete_after) return false
  if (c.media_deleted_at) return false
  return String(c.delete_after).slice(0, 10) <= today
 })
}

// The video objects belonging to these responses, deduplicated, with anything that is not a storage
// path dropped. Never the resume: that is the application record, not a recording.
export function videoPaths(responses) {
 const paths = new Set()
 for (const r of responses || []) {
  const path = String(r?.video_path || '').trim()
  if (path && path.startsWith('candidates/')) paths.add(path)
 }
 return [...paths]
}

// Whether a candidate's recordings may be deleted on request, and why not when they may not.
//
// The one case this refuses is a candidate still in play whose video the panel has not finished
// scoring. Deleting then does not save a decision, it removes the evidence the next scorer needed.
// Everything else -- stopped, withdrawn, hired, or simply scored by everyone who is going to score
// it -- is the principal's call to make.
export const LIVE_STAGES = ['invited', 'screening_submitted']

export function mayDeleteMedia({ stage, scorerCount, hasVideo }) {
 if (!hasVideo) return { ok: false, reason: 'There are no recordings left to delete for this candidate.' }
 if (LIVE_STAGES.includes(stage) && !scorerCount) {
  return { ok: false, reason: 'Nobody has scored this interview yet. Score it, or stop the candidate first -- deleting now would leave the panel nothing to score.' }
 }
 return { ok: true }
}

// A plain-language summary for the screen and for the cron log.
export function disposalSummary({ candidates, files, failed }) {
 if (!candidates) return 'Nothing was due for disposal.'
 const c = `${candidates} ${candidates === 1 ? 'candidate' : 'candidates'}`
 const f = `${files} ${files === 1 ? 'recording' : 'recordings'}`
 return failed
  ? `Deleted ${f} for ${c}. ${failed} could not be deleted and will be retried tomorrow.`
  : `Deleted ${f} for ${c}.`
}
