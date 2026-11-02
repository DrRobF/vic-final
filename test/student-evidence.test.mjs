// The two signals, and the rule they replaced.
//
// The guard that matters most is "browsing is not struggling": the Oct 27 plan flagged a
// child on unresolved attempts, and against real rows that rule is 41% children who opened
// a skill and left. Several tests below fail under that rule and pass under this one, which
// is the only reason to have written a new one.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
 effortOf, withinWindow, workingNotLanding, notEngaging, standardsRollup, evidence, standardLine,
 BROWSE_TURNS, WORK_TURNS, BROWSE_FLAG,
} from '../lib/student-evidence.mjs'

const NOW = Date.parse('2026-11-02T14:00:00Z')
const ago = days => new Date(NOW - days * 86400000).toISOString()

// One attempt row, shaped like vic_goal_attempts.
const row = (o = {}) => ({
 student_id: 1, class_id: 36, standard_id: 'FL:MA.3.AR.1.1', turns: 0,
 verdict: null, resolved_at: null, started_at: ago(1), last_seen_at: ago(1),
 audio_on_assessed: false, alternate_standard: false, ...o,
})
const opts = { now: NOW }

test('effort is judged on turns, and the ambiguous band is its own thing', () => {
 assert.equal(effortOf(row({ turns: 0 })), 'browsed')
 assert.equal(effortOf(row({ turns: BROWSE_TURNS })), 'browsed')
 assert.equal(effortOf(row({ turns: BROWSE_TURNS + 1 })), 'some')
 assert.equal(effortOf(row({ turns: WORK_TURNS - 1 })), 'some')
 assert.equal(effortOf(row({ turns: WORK_TURNS })), 'worked')
})

test('a child who opens skills and leaves is NOT struggling — fails under the unresolved-attempts rule', () => {
 // Five standards, every one opened and abandoned. The old rule calls this five red flags.
 const attempts = ['a', 'b', 'c', 'd', 'e'].map((s, i) => row({ standard_id: `S:${s}`, turns: i % 3 }))
 assert.deepEqual(workingNotLanding(attempts, opts), [])
})

test('a child who worked and did not get there IS struggling', () => {
 const found = workingNotLanding([row({ turns: 15 })], opts)
 assert.equal(found.length, 1)
 assert.equal(found[0].studentId, 1)
 assert.equal(found[0].turns, 15)
 assert.equal(found[0].repeated, false)
})

test('two short attempts at one standard are not struggle — repetition alone does not qualify', () => {
 // The trap: "tried twice, never met" looks like struggle and is two doors opening.
 const attempts = [row({ turns: 2, started_at: ago(3), last_seen_at: ago(3) }), row({ turns: 1 })]
 assert.deepEqual(workingNotLanding(attempts, opts), [])
})

test('VIC saying partly or not_yet is struggle on its own, however short', () => {
 // VIC's own verdict outranks any turn count we could pick.
 for (const verdict of ['partly', 'not_yet']) {
  const found = workingNotLanding([row({ turns: 2, verdict, resolved_at: ago(1) })], opts)
  assert.equal(found.length, 1, verdict)
  assert.equal(found[0].toldNotYet, true)
 }
})

test('met takes a standard off the struggling list no matter how long it took', () => {
 const attempts = [row({ turns: 40, verdict: 'met', resolved_at: ago(1) })]
 assert.deepEqual(workingNotLanding(attempts, opts), [])
})

test('a met earned on an earlier try clears a later unresolved attempt at the same standard', () => {
 const attempts = [
  row({ turns: 20, verdict: 'met', resolved_at: ago(5), started_at: ago(5), last_seen_at: ago(5) }),
  row({ turns: 12 }),
 ]
 assert.deepEqual(workingNotLanding(attempts, opts), [])
})

test('a repeated attempt is ranked above a single long one', () => {
 const attempts = [
  row({ standard_id: 'S:long', turns: 30 }),
  row({ standard_id: 'S:twice', turns: 12, started_at: ago(4), last_seen_at: ago(4) }),
  row({ standard_id: 'S:twice', turns: 6 }),
 ]
 const found = workingNotLanding(attempts, opts)
 assert.equal(found[0].standardId, 'S:twice')
 assert.equal(found[0].repeated, true)
 assert.equal(found[0].tries, 2)
})

test('the support condition travels with the finding, so a met with audio is not read as a cold met', () => {
 const found = workingNotLanding([row({ turns: 12, audio_on_assessed: true, alternate_standard: true })], opts)
 assert.equal(found[0].audioOnAssessed, true)
 assert.equal(found[0].alternateStandard, true)
})

test('three abandoned attempts flag engagement; two do not', () => {
 const two = [row({ standard_id: 'S:a', turns: 1 }), row({ standard_id: 'S:b', turns: 0 })]
 assert.deepEqual(notEngaging(two, opts), [])
 const three = [...two, row({ standard_id: 'S:c', turns: 2 })]
 const found = notEngaging(three, opts)
 assert.equal(found.length, 1)
 assert.equal(found[0].browsed, BROWSE_FLAG)
})

test('a child who works properly is not called disengaged', () => {
 const attempts = [row({ standard_id: 'S:a', turns: 14 }), row({ standard_id: 'S:b', turns: 22 }), row({ standard_id: 'S:c', turns: 11 })]
 assert.deepEqual(notEngaging(attempts, opts), [])
})

test('a short attempt that reached met is not counted as abandonment', () => {
 // A quick met is a child who already knew it, not a child who wandered off.
 const attempts = ['a', 'b', 'c'].map(s => row({ standard_id: `S:${s}`, turns: 2, verdict: 'met', resolved_at: ago(1) }))
 assert.deepEqual(notEngaging(attempts, opts), [])
})

test('the two signals are separate — the same child can be on one and not the other', () => {
 const attempts = [
  row({ standard_id: 'S:hard', turns: 18 }),
  row({ standard_id: 'S:a', turns: 1 }), row({ standard_id: 'S:b', turns: 0 }), row({ standard_id: 'S:c', turns: 1 }),
 ]
 const e = evidence(attempts, opts)
 assert.equal(e.struggling.length, 1)
 assert.equal(e.struggling[0].standardId, 'S:hard')
 assert.equal(e.disengaged.length, 1)
 assert.equal(e.disengaged[0].browsed, 3)
})

test('rows outside the window are ignored, and an undated row can never raise a flag', () => {
 const old = row({ turns: 30, started_at: ago(60), last_seen_at: ago(60) })
 assert.deepEqual(workingNotLanding([old], opts), [])
 const undated = row({ turns: 30, started_at: null, last_seen_at: null })
 assert.deepEqual(withinWindow([undated], opts), [])
 assert.deepEqual(workingNotLanding([undated], opts), [])
})

test('rows with no standard are skipped rather than grouped under null', () => {
 assert.deepEqual(workingNotLanding([row({ standard_id: null, turns: 30 })], opts), [])
 assert.deepEqual(standardsRollup([row({ standard_id: null, turns: 30 })], opts), [])
})

test('the standards rollup counts children once per standard and leads with where teaching is not working', () => {
 const attempts = [
  // Fractions: three children worked at it, none got there.
  row({ student_id: 1, standard_id: 'S:fractions', turns: 14 }),
  row({ student_id: 2, standard_id: 'S:fractions', turns: 18 }),
  row({ student_id: 3, standard_id: 'S:fractions', turns: 12 }),
  // Place value: two children, both got there.
  row({ student_id: 1, standard_id: 'S:place', turns: 10, verdict: 'met', resolved_at: ago(1) }),
  row({ student_id: 2, standard_id: 'S:place', turns: 9, verdict: 'met', resolved_at: ago(1) }),
 ]
 const rollup = standardsRollup(attempts, opts)
 assert.equal(rollup[0].standardId, 'S:fractions')
 assert.equal(rollup[0].children, 3)
 assert.equal(rollup[0].notLanded, 3)
 assert.equal(rollup[0].landed, 0)
 const place = rollup.find(r => r.standardId === 'S:place')
 assert.equal(place.landed, 2)
 assert.equal(place.notLanded, 0)
})

test('two attempts by one child at one standard count as one child, not two', () => {
 const attempts = [
  row({ student_id: 1, standard_id: 'S:x', turns: 8, started_at: ago(4), last_seen_at: ago(4) }),
  row({ student_id: 1, standard_id: 'S:x', turns: 8 }),
 ]
 assert.equal(standardsRollup(attempts, opts)[0].children, 1)
})

test('a child who only opened a standard is counted as started, neither landed nor not-landed', () => {
 const rollup = standardsRollup([row({ turns: 2 })], opts)
 assert.equal(rollup[0].started, 1)
 assert.equal(rollup[0].landed, 0)
 assert.equal(rollup[0].notLanded, 0)
})

test('the plain-language line never grades a child and never says "on level"', () => {
 const lines = [
  standardLine({ landed: 0, notLanded: 3, children: 3 }),
  standardLine({ landed: 2, notLanded: 0, children: 2 }),
  standardLine({ landed: 1, notLanded: 1, children: 2 }),
  standardLine({ landed: 0, notLanded: 0, children: 0 }),
 ]
 for (const line of lines) assert.ok(line.length, 'every case produces a line')
 for (const line of lines) assert.ok(!/on level|mastered|grade level/i.test(line), `no mastery claim in: ${line}`)
 assert.equal(standardLine(null), '')
})
