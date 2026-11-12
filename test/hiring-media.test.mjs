import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
 BUCKET, MAX_VIDEO_BYTES, MAX_RESUME_BYTES, VIDEO_LIMIT_SECONDS,
 candidatePrefix, uploadPath, verifiedPath, allowedUpload,
 makeSessionToken, sessionExpiry, disposalDate, RECORDING_NOTICE,
} from '../lib/hiring-media.mjs'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

test('upload paths land in the candidate own folder with a sane name', () => {
 const p = uploadPath(A, 'q2', 'video/webm', 'abcdef1234567890')
 assert.equal(p, `candidates/${A}/q2-abcdef1234567890.webm`)
 assert.ok(verifiedPath(A, 'q2', p))
 assert.equal(uploadPath(A, 'resume', 'application/pdf', 'abcdef1234567890'), `candidates/${A}/resume-abcdef1234567890.pdf`)
})

test('a path is refused for a different candidate, which is the whole point of the guard', () => {
 const p = uploadPath(A, 'q2', 'video/webm', 'abcdef1234567890')
 assert.ok(!verifiedPath(B, 'q2', p), 'candidate B could write into candidate A folder')
})

test('a path is refused when the claimed kind does not match the file', () => {
 const p = uploadPath(A, 'q2', 'video/webm', 'abcdef1234567890')
 assert.ok(!verifiedPath(A, 'q3', p))
 assert.ok(!verifiedPath(A, 'resume', p))
})

test('traversal, nesting and empty names are refused', () => {
 const prefix = candidatePrefix(A)
 for (const bad of [
  `${prefix}../${B}/q1-abcdef1234567890.webm`,
  `${prefix}nested/q1-abcdef1234567890.webm`,
  `${prefix}`,
  `${prefix}q1-abcdef1234567890.exe`,
  `${prefix}q1-short.webm`,
  `${prefix}q21-abcdef1234567890.webm`,
  `${prefix}q0-abcdef1234567890.webm`,
  `candidates/${B}/q1-abcdef1234567890.webm`,
  'q1-abcdef1234567890.webm',
 ]) {
  assert.ok(!verifiedPath(A, 'q1', bad), `accepted a bad path: ${bad}`)
 }
})

test('a non-uuid candidate id never produces or verifies a path', () => {
 assert.equal(uploadPath('../../etc', 'q1', 'video/webm', 'abcdef1234567890'), '')
 assert.ok(!verifiedPath('', 'q1', 'candidates//q1-abcdef1234567890.webm'))
})

test('unsupported types and oversize files are refused with something a candidate can act on', () => {
 assert.equal(uploadPath(A, 'q1', 'application/x-msdownload', 'abcdef1234567890'), '')
 assert.ok(allowedUpload('q1', 'video/mp4', 1024).ok)
 assert.ok(allowedUpload('q1', 'video/webm;codecs=vp9', 1024).ok, 'a codecs parameter is normal and must not be rejected')
 assert.ok(!allowedUpload('q1', 'video/avi', 1024).ok)
 assert.ok(!allowedUpload('q1', 'video/mp4', MAX_VIDEO_BYTES + 1).ok)
 assert.match(allowedUpload('q1', 'video/mp4', MAX_VIDEO_BYTES + 1).error, /90 MB/)
 assert.ok(allowedUpload('resume', 'application/pdf', 1024).ok)
 assert.ok(!allowedUpload('resume', 'application/pdf', MAX_RESUME_BYTES + 1).ok)
 assert.ok(!allowedUpload('resume', 'video/mp4', 1024).ok)
 assert.ok(!allowedUpload('q1', 'video/mp4', 0).ok)
 assert.ok(!allowedUpload('q1', 'video/mp4', NaN).ok)
})

test('session tokens are long, hex and not repeated', () => {
 const seen = new Set()
 for (let i = 0; i < 500; i++) {
  const t = makeSessionToken()
  assert.match(t, /^[0-9a-f]{64}$/)
  seen.add(t)
 }
 assert.equal(seen.size, 500)
})

test('sessions expire and video gets a disposal date, rather than living forever', () => {
 const now = Date.parse('2026-11-12T00:00:00Z')
 assert.equal(sessionExpiry(now), '2026-11-26T00:00:00.000Z')
 assert.equal(disposalDate(now), '2027-05-11')
 assert.ok(Date.parse(sessionExpiry(now)) > now)
})

test('the recording notice tells candidates what happens and offers a way out', () => {
 assert.match(RECORDING_NOTICE, /recorded/i)
 assert.match(RECORDING_NOTICE, /deleted/i)
 assert.match(RECORDING_NOTICE, /call the school office/i)
 assert.equal(BUCKET, 'hiring-media')
 assert.equal(VIDEO_LIMIT_SECONDS, 300)
})
