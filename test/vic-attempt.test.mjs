// The denominator: what an attempt row says, and the two flags that must never go backwards.
import test from 'node:test'
import assert from 'node:assert/strict'
import { supportFor } from '../lib/learner-profile.mjs'
import { conditionFor, attemptRow, resolvePatch, resultRow, levelSubjectFor, turnsIn } from '../lib/vic-attempt.mjs'

const reader = { read_aloud: 'on_request', language: 'en', alternate_standards: false }
const base = { studentId: 112, classId: 40, lessonId: 7, assignmentId: 5, standardId: 'FL:ELA.3.R.1.1' }

test('a child who never pressed the button: audio_used stays false', () => {
 const c = conditionFor({ support: supportFor({ audio: 'stem_only', translate: 'scaffold_only' }, reader), spoke: false })
 assert.equal(c.audio_used, false)
 assert.equal(c.audio_on_assessed, false)
 assert.equal(c.audio_policy, 'stem_only')
})

test('spoke on a reading skill: used, but not on the assessed passage', () => {
 const c = conditionFor({ support: supportFor({ audio: 'stem_only', translate: 'scaffold_only' }, reader), spoke: true })
 assert.equal(c.audio_used, true)
 // The passage is held back on a reading skill, so hearing VIC does not change what 'met' means.
 assert.equal(c.audio_on_assessed, false)
})

test('spoke where the words may be read aloud: the verdict is marked as heard', () => {
 const c = conditionFor({ support: supportFor({ audio: 'free', translate: 'scaffold_only' }, reader), spoke: true })
 assert.equal(c.audio_on_assessed, true)
})

test('a listening standard is spoken whether the child asked or not', () => {
 const c = conditionFor({ support: supportFor({ audio: 'required', translate: 'scaffold_only' }, { read_aloud: 'off', language: 'en' }), spoke: true })
 assert.equal(c.audio_on_assessed, true)
})

test('alternate standards are carried onto the condition', () => {
 const c = conditionFor({ support: supportFor({ audio: 'free', translate: 'free' }, reader), alternateStandard: true })
 assert.equal(c.alternate_standard, true)
})

test('the row carries the child, the standard, the level and the grade', () => {
 const row = attemptRow({ ...base, condition: conditionFor({ support: supportFor({ audio: 'stem_only' }, reader) }), level: 1, enrolledGrade: 6, turns: 4 })
 assert.equal(row.student_id, 112)
 assert.equal(row.assignment_id, 5)
 assert.equal(row.standard_id, 'FL:ELA.3.R.1.1')
 assert.equal(row.instructional_level, 1)
 assert.equal(row.enrolled_grade, 6)
 assert.equal(row.turns, 4)
 assert.match(row.last_seen_at, /^\d{4}-\d{2}-\d{2}T/)
})

test('started_at is never sent, so the moment the child began is not moved on every turn', () => {
 const row = attemptRow({ ...base, condition: conditionFor({ support: supportFor({}, reader) }) })
 assert.equal('started_at' in row, false)
 assert.equal('resolved_at' in row, false)
 assert.equal('verdict' in row, false)
})

test('the audio flags are left out when false, so an earlier true is never erased', () => {
 const quiet = attemptRow({ ...base, condition: conditionFor({ support: supportFor({ audio: 'free' }, reader), spoke: false }) })
 assert.equal('audio_used' in quiet, false, 'a silent turn must not overwrite a spoken one')
 assert.equal('audio_on_assessed' in quiet, false)
 const spoken = attemptRow({ ...base, condition: conditionFor({ support: supportFor({ audio: 'free' }, reader), spoke: true }) })
 assert.equal(spoken.audio_used, true)
 assert.equal(spoken.audio_on_assessed, true)
})

test('K is level 0, and a level out of range is dropped rather than guessed', () => {
 assert.equal(attemptRow({ ...base, level: 0, enrolledGrade: 0 }).instructional_level, 0)
 assert.equal(attemptRow({ ...base, level: 14 }).instructional_level, null)
 assert.equal(attemptRow({ ...base, level: null }).instructional_level, null)
})

test('no assignment means no attempt row: My Own Work is not assessed', () => {
 assert.equal(attemptRow({ ...base, assignmentId: null }), null)
 assert.equal(attemptRow({ ...base, studentId: null }), null)
})

test('a verdict closes the attempt; anything else is refused', () => {
 const p = resolvePatch('met')
 assert.equal(p.verdict, 'met')
 assert.match(p.resolved_at, /^\d{4}-\d{2}-\d{2}T/)
 assert.equal(resolvePatch('maybe'), null)
 assert.equal(resolvePatch(null), null)
})

test('the verdict row links its attempt and carries the condition', () => {
 const condition = conditionFor({ support: supportFor({ audio: 'free', translate: 'scaffold_only' }, reader), spoke: true, alternateStandard: true })
 const row = resultRow({ ...base, verdict: 'met', practice: true, attemptId: 99, condition })
 assert.equal(row.verdict, 'met')
 assert.equal(row.practice, true)
 assert.equal(row.attempt_id, 99)
 assert.equal(row.audio_on_assessed, true, 'a met earned with the words read aloud is a different fact')
 assert.equal(row.alternate_standard, true)
 assert.equal(row.language, 'en')
})

test('a verdict row with no attempt still saves, with the link left empty', () => {
 const row = resultRow({ ...base, verdict: 'partly', attemptId: null, condition: {} })
 assert.equal(row.attempt_id, null)
 assert.equal(row.audio_on_assessed, false)
 assert.equal(resultRow({ ...base, verdict: 'nope' }), null)
})

test('lessons are filed under the level subject they belong to', () => {
 assert.equal(levelSubjectFor('Math & Science'), 'math')
 assert.equal(levelSubjectFor('ELA & Social Studies'), 'reading')
 assert.equal(levelSubjectFor(''), 'reading')
 assert.equal(levelSubjectFor(null), 'reading')
})

test('turns counts the child, not VIC', () => {
 assert.equal(turnsIn([{ role: 'user' }, { role: 'assistant' }, { role: 'user' }]), 2)
 assert.equal(turnsIn([]), 0)
 assert.equal(turnsIn(null), 0)
})
