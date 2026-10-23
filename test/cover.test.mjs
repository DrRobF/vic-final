import test from 'node:test'
import assert from 'node:assert/strict'
import { newCoverCode, tidyCoverCode, COVER_CODE, coverGrantInput, grantUsable, COVER_REFUSALS } from '../lib/cover.mjs'

test('Codes avoid letters and digits that look alike on a printed slip',() => {
 for (let i = 0; i < 400; i++) {
  const c = newCoverCode()
  assert.match(c, COVER_CODE)
  assert.equal(/[IO01]/.test(c), false, `confusable character in ${c}`)
 }
})
test('Codes are not predictable',() => {
 assert.ok(new Set(Array.from({ length: 200 }, newCoverCode)).size > 195)
})
test('A code typed by hand survives spaces, dashes and lower case',() => {
 assert.equal(tidyCoverCode(' abcd-2345 '), 'ABCD2345')
 assert.equal(tidyCoverCode('abcd 2345'), 'ABCD2345')
 assert.equal(tidyCoverCode('ABCD2345EXTRA'), 'ABCD2345')
 for (const junk of [undefined, null, 42, {}]) assert.equal(tidyCoverCode(junk), '')
})

test('A slip needs a day, at least one class, and a name on it',() => {
 const ok = { day: '2026-10-26', classIds: [36, 37], coveringName: 'Amber Manuel' }
 assert.deepEqual(coverGrantInput(ok), { day: '2026-10-26', classIds: [36, 37], coveringName: 'Amber Manuel', note: '' })
 assert.throws(() => coverGrantInput({ ...ok, day: 'Monday' }), /Choose the day/)
 assert.throws(() => coverGrantInput({ ...ok, classIds: [] }), /at least one class/)
 assert.throws(() => coverGrantInput({ ...ok, coveringName: ' ' }), /who is covering/)
 assert.throws(() => coverGrantInput({ ...ok, classIds: Array.from({ length: 41 }, (_, i) => i + 1) }), /too many classes/)
})
test('Duplicate and junk class ids are dropped rather than trusted',() => {
 assert.deepEqual(coverGrantInput({ day: '2026-10-26', classIds: [36, 36, '37', 0, -1, null, 'x'], coveringName: 'Sub' }).classIds, [36, 37])
})

test('A grant works only on its own day',() => {
 const g = { day: '2026-10-26', revoked_at: null }
 assert.equal(grantUsable(g, '2026-10-26').ok, true)
 assert.equal(grantUsable(g, '2026-10-27').reason, 'expired')
 assert.equal(grantUsable(g, '2026-10-25').reason, 'early')
})
test('A revoked grant stops working even on its own day',() => {
 assert.equal(grantUsable({ day: '2026-10-26', revoked_at: '2026-10-26T08:00:00Z' }, '2026-10-26').reason, 'revoked')
})
test('An unknown code and a revoked one are refused in the same words',() => {
 // Otherwise the page tells a stranger which codes exist.
 assert.equal(COVER_REFUSALS.notfound, COVER_REFUSALS.revoked)
 assert.equal(grantUsable(null, '2026-10-26').reason, 'notfound')
})
