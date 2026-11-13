import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
 dueForDisposal, videoPaths, mayDeleteMedia, disposalSummary, LIVE_STAGES, RETENTION_DAYS,
} from '../lib/hiring-retention.mjs'
import { RECORDING_NOTICE, disposalDate } from '../lib/hiring-media.mjs'

const now = new Date('2026-11-13T12:00:00Z')

test('a candidate is due on their disposal date, not a day late', () => {
 const due = dueForDisposal([
  { id: 'today', delete_after: '2026-11-13' },
  { id: 'past', delete_after: '2026-05-01' },
  { id: 'future', delete_after: '2027-01-01' },
 ], now)
 assert.deepEqual(due.map(c => c.id), ['today', 'past'])
})

test('a candidate whose recordings are already gone is never processed again', () => {
 const due = dueForDisposal([{ id: 'done', delete_after: '2026-01-01', media_deleted_at: '2026-07-01T00:00:00Z' }], now)
 assert.deepEqual(due, [])
})

test('a candidate with no disposal date is left alone rather than deleted', () => {
 assert.deepEqual(dueForDisposal([{ id: 'x', delete_after: null }], now), [])
 assert.deepEqual(dueForDisposal(null, now), [])
})

test('only real storage paths are deleted, and each one only once', () => {
 const paths = videoPaths([
  { video_path: 'candidates/abc/q1-aaaaaaaa.webm' },
  { video_path: 'candidates/abc/q1-aaaaaaaa.webm' },
  { video_path: '' },
  { video_path: null },
  { video_path: 'elsewhere/secret.webm' },
 ])
 assert.deepEqual(paths, ['candidates/abc/q1-aaaaaaaa.webm'])
})

test('deleting on request is refused while the panel still needs the recording', () => {
 for (const stage of LIVE_STAGES) {
  assert.equal(mayDeleteMedia({ stage, scorerCount: 0, hasVideo: true }).ok, false)
  assert.equal(mayDeleteMedia({ stage, scorerCount: 2, hasVideo: true }).ok, true, 'once scored, it is the principal\'s call')
 }
 for (const stage of ['declined', 'withdrawn', 'hired', 'interview']) {
  assert.equal(mayDeleteMedia({ stage, scorerCount: 0, hasVideo: true }).ok, true)
 }
 assert.equal(mayDeleteMedia({ stage: 'declined', scorerCount: 1, hasVideo: false }).ok, false, 'nothing to delete')
})

test('the notice promises what the job actually does, within the same number of days', () => {
 assert.equal(RETENTION_DAYS, 180)
 assert.ok(RECORDING_NOTICE.includes(`${RETENTION_DAYS} days`), 'the notice must state the retention period the job enforces')
 // The date set at invite time has to fall inside the window the candidate was promised.
 const set = Date.parse(`${disposalDate(now.getTime())}T00:00:00Z`)
 assert.ok(set - now.getTime() <= RETENTION_DAYS * 86400000)
})

test('the summary counts in plain words and owns up to failures', () => {
 assert.equal(disposalSummary({ candidates: 0, files: 0, failed: 0 }), 'Nothing was due for disposal.')
 assert.equal(disposalSummary({ candidates: 1, files: 1, failed: 0 }), 'Deleted 1 recording for 1 candidate.')
 assert.equal(disposalSummary({ candidates: 3, files: 15, failed: 0 }), 'Deleted 15 recordings for 3 candidates.')
 assert.match(disposalSummary({ candidates: 2, files: 4, failed: 1 }), /1 could not be deleted and will be retried tomorrow/)
})
