import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
 supportFor, levelFor, levelSummary, trackFor, attemptSupport, toLevel, toGrade, DEFAULT_SUPPORTS,
 standardsFor,
} from '../lib/learner-profile.mjs'

const catalogue = JSON.parse(readFileSync(new URL('../data/lesson-standards.json', import.meta.url), 'utf8'))
const byId = new Map(catalogue.map(s => [s.id, s]))
const std = id => { const s = byId.get(id); assert.ok(s, `missing standard ${id}`); return s }

const reader = { read_aloud: 'on_request', language: 'en', alternate_standards: false }
const always = { read_aloud: 'always', language: 'en', alternate_standards: false }

test('the whole point: a weak reader gets the math problem read, and the reading passage not', () => {
 // Same child, same switch, opposite answers -- decided by the standard, not the child.
 const math = supportFor(std('CCSS:5.NF.A.1'), reader)
 const comprehension = supportFor(std('CCSS:RL.5.1'), reader)
 assert.equal(math.speakAssessed, true)
 assert.equal(comprehension.speakAssessed, false)
})

test('scaffolding is never gated, even where nothing in the task may be read', () => {
 // A child who cannot decode the directions fails for a reason that is not the standard.
 for (const id of ['CCSS:RF.3.3', 'CCSS:RL.5.1', 'CCSS:5.NF.A.1']) {
  assert.equal(supportFor(std(id), reader).speakScaffold, true, `${id} should still read directions`)
 }
})

test('a listening standard is spoken even for a child with read-aloud switched off', () => {
 const s = supportFor(std('CCSS:SL.4.2'), DEFAULT_SUPPORTS)
 assert.equal(s.mustSpeak, true)
 assert.equal(s.speakAssessed, true)
 assert.equal(s.autoSpeak, true)
})

test('read-aloud off means off everywhere a standard does not require audio', () => {
 const s = supportFor(std('CCSS:5.NF.A.1'), DEFAULT_SUPPORTS)
 assert.equal(s.speakAssessed, false)
 assert.equal(s.speakScaffold, false)
})

test("'always' auto-speaks without being asked", () => {
 assert.equal(supportFor(std('CCSS:5.NF.A.1'), always).autoSpeak, true)
 assert.equal(supportFor(std('CCSS:5.NF.A.1'), reader).autoSpeak, false)
})

test('Spanish translates a math problem but never the English text under study', () => {
 const es = { ...reader, language: 'es' }
 assert.equal(supportFor(std('CCSS:5.NF.A.1'), es).translateAssessed, true)
 assert.equal(supportFor(std('CCSS:RL.5.1'), es).translateAssessed, false)
 // Explanation and encouragement are translated in both cases.
 assert.equal(supportFor(std('CCSS:RL.5.1'), es).translateScaffold, true)
})

test('an unknown or untagged standard fails closed, not open', () => {
 const s = supportFor({ id: 'X', subject: 'reading' }, reader)
 assert.equal(s.speakAssessed, false)
 assert.equal(s.translateAssessed, false)
})

test('every standard in the catalogue is tagged with a known policy', () => {
 const audio = new Set(['free', 'stem_only', 'none', 'required'])
 const translate = new Set(['free', 'scaffold_only'])
 const bad = catalogue.filter(s => !audio.has(s.audio) || !translate.has(s.translate))
 assert.deepEqual(bad.map(s => s.id), [])
})

test('no comprehension or decoding standard above grade 1 is readable aloud', () => {
 // The failure that would matter: VIC reads the passage and the verdict means nothing.
 const g = s => (s.grade === 'K' ? 0 : Number(s.grade))
 const leaked = catalogue.filter(s =>
  s.subject !== 'math' && g(s) >= 2 && s.audio === 'free' &&
  (/^(RL|RI)\./.test(s.code) || /^ELA\.\d+\.(R|F)\./.test(s.code) || /^CC\.1\.(1|2|3)\./.test(s.code)))
 assert.deepEqual(leaked.map(s => s.id), [])
})

test('math is readable and translatable in every state and grade', () => {
 const wrong = catalogue.filter(s => s.subject === 'math' && (s.audio !== 'free' || s.translate !== 'free'))
 assert.deepEqual(wrong.map(s => s.id), [])
})

test('instructional level overrides the enrolled grade in both directions', () => {
 // Kyaunna: enrolled 6, working at 1.
 const behind = levelFor([{ subject: 'reading', level: 1, source: 'iep', confirmed_at: '2026-10-27' }], 'reading', 6)
 assert.equal(behind.level, 1)
 assert.equal(behind.offset, -5)
 // The other 6th grader, past the curriculum. Same field, opposite direction.
 const ahead = levelFor([{ subject: 'math', level: 8, source: 'teacher', confirmed_at: '2026-10-27' }], 'math', 6)
 assert.equal(ahead.level, 8)
 assert.equal(ahead.offset, 2)
})

test('with no level set, the enrolled grade is used and nothing breaks', () => {
 const l = levelFor([], 'math', 4)
 assert.equal(l.level, 4)
 assert.equal(l.source, 'enrolled')
 assert.equal(levelFor([], 'math', null).level, null)
})

test('a level VIC proposed but no adult confirmed is marked unconfirmed', () => {
 const l = levelFor([{ subject: 'math', level: 2, source: 'placement', confirmed_at: null }], 'math', 6)
 assert.equal(l.confirmed, false)
 assert.equal(l.source, 'placement')
})

test('teacher-facing level summary says how far from the enrolled grade', () => {
 assert.equal(levelSummary(1, 6), 'Grade 1 — 5 years below enrolled grade')
 assert.equal(levelSummary(8, 6), 'Grade 8 — 2 years ahead of enrolled grade')
 assert.equal(levelSummary(4, 4), 'Grade 4')
 assert.equal(levelSummary(0, 2), 'Kindergarten — 2 years below enrolled grade')
})

test('alternate standards refuse to fall back to the general catalogue', () => {
 // The dangerous failure is the silent one: a child whose IEP says Access Points quietly
 // getting 6th grade general standards, and the screen looking fine.
 const t = trackFor({ ...DEFAULT_SUPPORTS, alternate_standards: true }, catalogue)
 assert.equal(t.track, 'access')
 assert.equal(t.available, false)
 assert.match(t.reason, /Access Points/)
 // And once they are imported, it opens.
 const withAccess = trackFor({ ...DEFAULT_SUPPORTS, alternate_standards: true }, [{ track: 'access' }])
 assert.equal(withAccess.available, true)
})

test('general track is unaffected', () => {
 assert.deepEqual(trackFor(DEFAULT_SUPPORTS, catalogue), { track: 'general', available: true })
})

test('the attempt stamp separates permission from what actually happened', () => {
 const s = supportFor(std('CCSS:5.NF.A.1'), reader)
 // Allowed to speak the problem, but the child never pressed the button.
 assert.equal(attemptSupport(s, { spokeScaffold: true, spokeAssessed: false }).audio_on_assessed, false)
 assert.equal(attemptSupport(s, { spokeScaffold: true, spokeAssessed: false }).audio_used, true)
 assert.equal(attemptSupport(s, { spokeAssessed: true }).audio_on_assessed, true)
})

test('a runtime cannot stamp audio_on_assessed where the standard forbids it', () => {
 const s = supportFor(std('CCSS:RL.5.1'), reader)
 assert.equal(attemptSupport(s, { spokeAssessed: true }).audio_on_assessed, false)
})

test('grade and level convert both ways, K included', () => {
 assert.equal(toLevel('K'), 0); assert.equal(toLevel('6'), 6); assert.equal(toLevel(null), null)
 assert.equal(toGrade(0), 'K'); assert.equal(toGrade(6), '6')
})

// ---------------------------------------------------------------------------
// Access Points: the alternate catalogue, and the ways it must not leak.
// ---------------------------------------------------------------------------
const access = JSON.parse(readFileSync(new URL('../data/access-points.json', import.meta.url), 'utf8'))

test('every access point is tagged, related to a real benchmark, and marked access track', () => {
 const audio = new Set(['free', 'stem_only', 'none', 'required'])
 const bad = access.filter(s => s.track !== 'access' || !audio.has(s.audio) || !s.related_to || !s.text)
 assert.deepEqual(bad.map(s => s.id), [])
 // Within the grades the general catalogue covers, every related_to resolves.
 const g = s => (s.grade === 'K' ? 0 : Number(s.grade))
 const dangling = access.filter(s => g(s) <= 8 && !byId.has(s.related_to))
 assert.deepEqual(dangling.slice(0, 5).map(s => `${s.id} -> ${s.related_to}`), [])
})

test('the general catalogue stops at grade 8 while the site claims 3-12', () => {
 // Not an import bug -- a real gap. The Access Points run to grade 12 and the general
 // B.E.S.T. catalogue does not, so every unresolved reference is above grade 8 and there
 // are no grade 9-12 standards of any kind to teach from. This test exists to fail the day
 // someone imports them, as a reminder to re-check the links.
 assert.equal(catalogue.some(s => Number(s.grade) > 8), false)
 const g = s => (s.grade === 'K' ? 0 : Number(s.grade))
 assert.ok(access.filter(s => !byId.has(s.related_to)).every(s => g(s) > 8))
})

test('access points are not in the general catalogue and cannot be served by grade filters', () => {
 // The invisible failure this guards against: an Access Point reaching a typical student
 // because it matched state + subject + grade.
 assert.equal(catalogue.some(s => s.track === 'access' || /\.AP\./.test(s.code)), false)
})

test('a child on access points gets access points, not grade-level standards', () => {
 const iep = { read_aloud: 'always', language: 'en', alternate_standards: true }
 const got = standardsFor({ supports: iep, general: catalogue, access, subject: 'reading', level: 1 })
 assert.equal(got.track, 'access')
 assert.equal(got.available, true)
 assert.ok(got.standards.length > 0)
 assert.ok(got.standards.every(s => s.track === 'access' && s.grade === '1'))
})

test('a typical child never receives an access point', () => {
 const got = standardsFor({ supports: DEFAULT_SUPPORTS, general: catalogue, access, subject: 'reading', level: 5 })
 assert.equal(got.track, 'general')
 assert.ok(got.standards.length > 0)
 assert.equal(got.standards.some(s => s.track === 'access'), false)
})

test('access points still refuse rather than fall back when the catalogue is empty', () => {
 const iep = { ...DEFAULT_SUPPORTS, alternate_standards: true }
 const got = standardsFor({ supports: iep, general: catalogue, access: [], subject: 'math', level: 6 })
 assert.equal(got.available, false)
 assert.deepEqual(got.standards, [])
})

test('the construct rule holds inside the access catalogue too', () => {
 // An access point for decoding still measures decoding.
 const decoding = access.filter(s => /^ELA\.\d*K?\.F\./.test(s.code) && s.audio === 'free')
 assert.deepEqual(decoding.map(s => s.id), [])
 const math = access.filter(s => s.subject === 'math' && s.audio !== 'free')
 assert.deepEqual(math.map(s => s.id), [])
})

test('Kyaunna: enrolled grade 6, access points, reading at level 1', () => {
 // The whole chain, as it will actually run for her.
 const supports = { read_aloud: 'always', language: 'en', alternate_standards: true }
 const level = levelFor([{ subject: 'reading', level: 1, source: 'iep', confirmed_at: '2026-10-27' }], 'reading', 6)
 const got = standardsFor({ supports, general: catalogue, access, subject: 'reading', level: level.level })
 assert.equal(level.offset, -5)
 assert.ok(got.standards.length > 0, 'she must have something to work on')
 // And what a teacher sees versus what she sees.
 assert.equal(levelSummary(level.level, 6), 'Grade 1 — 5 years below enrolled grade')
})
