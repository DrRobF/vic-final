import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
 DEFAULT_VIDEO_QUESTIONS, DEFAULT_WRITTEN_QUESTIONS, DEFAULT_INTERVIEW_QUESTIONS,
 SCREENER_LINES, SCREENER_MAX, STAGE_TOTALS, GRAND_TOTAL,
 DEMO_RUBRIC, PLAN_RUBRIC,
 makeInviteCode, normalizeInviteCode, candidateInput, screenerTotal, rankCandidates, seedQuestions,
 LADDER, STOPPED_STAGES, ladderState, ROUNDS,
} from '../lib/hiring.mjs'

test('every question carries both look-fors, because a blank one means three scorers invent three bars', () => {
 for (const q of [...DEFAULT_VIDEO_QUESTIONS, ...DEFAULT_WRITTEN_QUESTIONS]) {
  assert.ok(q.look_for_strong.length > 40, `question ${q.ordinal} has no strong look-for`)
  assert.ok(q.look_for_weak.length > 40, `question ${q.ordinal} has no weak look-for`)
 }
})

test('writing can never outweigh what a candidate actually said', () => {
 for (const q of [...DEFAULT_VIDEO_QUESTIONS, ...DEFAULT_WRITTEN_QUESTIONS, ...DEFAULT_INTERVIEW_QUESTIONS]) {
  const content = q.max_content ?? 5
  const writing = q.max_writing ?? 0
  assert.ok(writing < content, `question ${q.ordinal} lets presentation beat judgment`)
 }
})

test('content and fit are weighted equally — they are different questions, not a main and a tiebreak', () => {
 for (const q of [...DEFAULT_VIDEO_QUESTIONS, ...DEFAULT_WRITTEN_QUESTIONS, ...DEFAULT_INTERVIEW_QUESTIONS]) {
  assert.equal(q.max_content ?? 5, q.max_fit ?? 5, `question ${q.ordinal} weights content and fit differently`)
 }
})

test('only written questions carry a writing score', () => {
 for (const q of [...DEFAULT_VIDEO_QUESTIONS, ...DEFAULT_INTERVIEW_QUESTIONS]) assert.equal(q.max_writing ?? 0, 0)
 for (const q of DEFAULT_WRITTEN_QUESTIONS) assert.ok((q.max_writing ?? 0) > 0)
})

test('GPA tiers are mutually exclusive and take the best selected tier', () => {
 assert.equal(screenerTotal({ gpa_35: true }), 3)
 assert.equal(screenerTotal({ gpa_25: true, gpa_30: true, gpa_35: true }), 3)
 assert.equal(screenerTotal({ gpa_35: true, experience: true, longevity: true }), 7)
})

test('screener total is bounded by its own lines', () => {
 const everything = Object.fromEntries(SCREENER_LINES.map(l => [l.key, true]))
 assert.equal(screenerTotal(everything), SCREENER_MAX)
 assert.equal(screenerTotal({}), 0)
 assert.equal(screenerTotal(null), 0)
})

test('no screener line scores a protected characteristic or where somebody lives', () => {
 const banned = /\b(commute|distance|address|miles|age|married|marital|children|kids|citizen|citizenship|born|nationality|accent|race|religion|disability|pregnan\w*)\b/i
 for (const line of SCREENER_LINES) assert.ok(!banned.test(line.label), `screener line scores ${line.label}`)
})

test('stage totals are derived from the rubrics, so the grand total cannot drift', () => {
 assert.equal(STAGE_TOTALS.video, 50)
 assert.equal(STAGE_TOTALS.written, 65)
 assert.equal(STAGE_TOTALS.interview, 100)
 assert.equal(STAGE_TOTALS.demo, DEMO_RUBRIC.reduce((a, r) => a + r.max, 0))
 assert.equal(STAGE_TOTALS.plan, PLAN_RUBRIC.reduce((a, r) => a + r.max, 0))
 assert.equal(GRAND_TOTAL, Object.values(STAGE_TOTALS).reduce((a, b) => a + b, 0))
})

test('invite codes are readable aloud and survive a retyped, lowercased, space-mangled copy', () => {
 const code = makeInviteCode()
 assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
 assert.equal(normalizeInviteCode(code.toLowerCase().replace(/-/g, ' ')), code)
 assert.equal(normalizeInviteCode('too-short'), '')
 assert.equal(normalizeInviteCode(null), '')
 // Characters a candidate would have to ask about are not in the alphabet at all.
 for (const c of code.replace(/-/g, '')) assert.ok(!'OI01Ll'.includes(c), `code contains ambiguous ${c}`)
})

test('invite codes do not repeat across a run', () => {
 const seen = new Set()
 for (let i = 0; i < 2000; i++) seen.add(makeInviteCode())
 assert.equal(seen.size, 2000)
})

test('a candidate needs a name and a real email address', () => {
 assert.throws(() => candidateInput({ name: 'A', email: 'teacher@example.com' }), /name/i)
 assert.throws(() => candidateInput({ name: 'Jane Doe', email: 'nope' }), /email/i)
 const ok = candidateInput({ name: '  Jane Doe ', email: ' Jane@Example.COM ', phone: '772-562-1963' })
 assert.equal(ok.name, 'Jane Doe')
 assert.equal(ok.email, 'jane@example.com')
})

test('ranking sums highest first and keeps an unscored candidate visible rather than buried as a zero', () => {
 const ranked = rankCandidates([
  { name: 'Lower', total: 180, scorers: 3 },
  { name: 'Higher', total: 201, scorers: 3 },
  { name: 'Unscored', total: 0, scorers: 0 },
 ])
 assert.deepEqual(ranked.map(r => r.name), ['Higher', 'Lower', 'Unscored'])
 assert.equal(ranked[2].scorers, 0)
 assert.deepEqual(rankCandidates(null), [])
})

test('seeding a posting produces all three stages with unique ordinals per stage', () => {
 const rows = seedQuestions('posting-1', 'school-1')
 assert.equal(rows.length, DEFAULT_VIDEO_QUESTIONS.length + DEFAULT_WRITTEN_QUESTIONS.length + DEFAULT_INTERVIEW_QUESTIONS.length)
 for (const stage of ['video', 'written', 'interview']) {
  const ordinals = rows.filter(r => r.stage === stage).map(r => r.ordinal)
  assert.equal(new Set(ordinals).size, ordinals.length, `${stage} has duplicate ordinals`)
 }
 assert.ok(rows.every(r => r.posting_id === 'posting-1' && r.school_id === 'school-1'))
})

test('a rung lights when its round is scored, and the ladder is not complete until none are waiting', () => {
 const partial = ladderState([{ key: 'video', scored: true, total: 40, max: 50 }], 'interview')
 assert.equal(partial.lit, 1)
 assert.equal(partial.complete, false)
 assert.equal(partial.next.key, 'screener')

 const full = LADDER.map(l => ({ key: l.key, scored: true, total: 1, max: 2 }))
 assert.equal(ladderState(full, 'interview').complete, true)
})

test('a deliberately skipped round stops being a gate', () => {
 // Not every position gets a demo lesson. A candidate must not sit one rung short forever
 // because their school does not run that round.
 const state = ladderState([
  { key: 'screener', skipped: true },
  { key: 'video', scored: true, total: 40, max: 50 },
  { key: 'written', scored: true, total: 38, max: 50 },
  { key: 'interview', scored: true, total: 80, max: 100 },
  { key: 'demo', skipped: true },
  { key: 'plan', skipped: true },
 ], 'interview')
 assert.equal(state.complete, true)
 assert.equal(state.lit, 3)
 assert.equal(state.skipped, 3)
 assert.equal(state.next, null)
})

test('a ladder with nothing scored is never complete, however much was skipped', () => {
 const allSkipped = LADDER.map(l => ({ key: l.key, skipped: true }))
 assert.equal(ladderState(allSkipped, 'interview').complete, false)
 assert.equal(ladderState([], 'interview').complete, false)
})

test('stopping a candidate is a stage, not a missing score', () => {
 for (const stage of STOPPED_STAGES) assert.equal(ladderState([], stage).stopped, true)
 assert.equal(ladderState([], 'interview').stopped, false)
 assert.equal(ladderState([], 'hired').hired, true)
})

test('the in-person interview is a rung on the ladder, between written and the performance round', () => {
 const keys = LADDER.map(l => l.key)
 assert.deepEqual(keys, ['screener', 'video', 'written', 'interview', 'demo', 'plan'])
 assert.ok(ROUNDS.some(r => r.key === 'interview' && r.kind === 'answers' && !r.optional), 'in-person is a required round scored per answer')
 assert.deepEqual(ROUNDS.map(r => r.key), keys, 'every ladder rung is a round and every round is a rung')
})

test('the in-person interview is worth 100 and the ten questions add up to it', () => {
 assert.equal(STAGE_TOTALS.interview, 100)
 assert.equal(DEFAULT_INTERVIEW_QUESTIONS.length, 10)
})

test('a ladder missing only the in-person round is not complete', () => {
 const rows = LADDER.filter(l => l.key !== 'interview').map(l => ({ key: l.key, scored: true, total: 1, max: 2 }))
 const state = ladderState(rows, 'interview')
 assert.equal(state.complete, false)
 assert.equal(state.next.key, 'interview')
})
