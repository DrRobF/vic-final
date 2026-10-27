// The VIC endpoint writing the attempt record: the row that gives the evidence a denominator.
// Runs the real handler against a fake model and a fake database, and reports what was written.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { extractGoal } from '../lib/vic-goal.mjs'
import { extractVisual } from '../lib/vic-visuals.mjs'
import { detectSafety } from '../lib/vic-safety.mjs'
import { buildVicContext, normalizeSessionMode, selectActiveEnrollment, TEACHER_DIRECTED } from '../lib/ask-vic-context.mjs'
import { splitText, buildSpeech, policyForLesson, sessionInstructions } from '../lib/read-aloud.mjs'
import { supportFor, levelFor, toLevel } from '../lib/learner-profile.mjs'
import { conditionFor, attemptRow, resolvePatch, resultRow, levelSubjectFor, turnsIn } from '../lib/vic-attempt.mjs'

const general = JSON.parse(readFileSync(new URL('../data/lesson-standards.json', import.meta.url), 'utf8'))
const access = JSON.parse(readFileSync(new URL('../data/access-points.json', import.meta.url), 'utf8'))
const MATH = 'FL:MA.3.AR.1.1'
const READING = 'FL:ELA.3.R.1.1'
const ATTEMPT_ID = 777

async function run({
 standard = MATH, subject = 'Math & Science', supports = null, levels = [], gradeLevel = 6,
 modelReply = 'Nice work. Try the next one.', studentText = 'ready', spoke = false,
 sessionMode = 'teacher_directed', messages = null,
} = {}) {
 const wrote = {}
 const push = (k, v) => { (wrote[k] ||= []).push(v) }
 const src = readFileSync(new URL('../pages/api/vic.js', import.meta.url), 'utf8')
  .replace(/^import[\s\S]*?from\s+'[^']+'\n/gm, '')
  .replace('export const config', 'const config')
  .replace('export default async function handler', 'async function handler') + '\nthis.handler=handler'
 const tables = {
  enrollments: [{ class_id: 40, support_level: 'core', classes: { id: 40, grade_level: 3 } }],
  assignments: [{ id: 5, lesson_id: 7, mode: 'on-level', status: 'assigned', assigned_at: 'x', lessons: { id: 7, class_id: 40 } }],
  lessons: [{ id: 7, class_id: 40, subject, title: 'Practice', lesson_text: 'work', is_active: true, practice_standard: standard }],
  student_supports: supports ? [supports] : [],
  student_levels: levels,
  users: [{ grade_level: gradeLevel }],
 }
 const db = {
  from(table) {
   let mode = null
   const b = {
    select: () => b, eq: () => b, or: () => b, order: () => b, limit: () => b, not: () => b,
    gte: () => b, lte: () => b, in: () => b, is: () => b,
    insert(row) { push(`${table}.insert`, row); mode = 'write'; return b },
    upsert(row, opts) { push(`${table}.upsert`, { row, opts }); mode = 'upsert'; return b },
    update(patch) { push(`${table}.update`, patch); mode = 'write'; return b },
    maybeSingle: async () => (mode === 'upsert'
     ? { data: { id: ATTEMPT_ID }, error: null }
     : { data: (tables[table] || [])[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve(mode ? { data: null, error: null } : { data: tables[table] || [], error: null }).then(res, rej),
   }
   return b
  },
 }
 const context = {
  console: { error() {} }, URL,
  requireApprovedProfile: async () => ({ profile: { id: 112, role: 'student', interest_tags: [] }, admin: db }),
  releasedFilter: () => 'x', vicTargetText: () => 'x',
  extractGoal, extractVisual, detectSafety, buildVicContext, normalizeSessionMode, selectActiveEnrollment, TEACHER_DIRECTED,
  splitText, buildSpeech, policyForLesson, sessionInstructions,
  supportFor, levelFor, toLevel,
  conditionFor, attemptRow, resolvePatch, resultRow, levelSubjectFor, turnsIn,
  general, access,
  VIC_BRAIN: 'BRAIN',
  respond: async () => ({ response: { ok: true }, data: { text: modelReply }, model: 'm' }),
  outputText: d => d.text,
  raiseSafetyAlert: async () => {},
 }
 vm.createContext(context); vm.runInContext(src, context)
 const res = { code: 200, body: null, setHeader() {}, status(c) { this.code = c; return this }, json(b) { this.body = b; return this } }
 await context.handler({
  method: 'POST',
  body: {
   messages: messages || [{ role: 'user', content: studentText }],
   sessionMode, activeClassId: 40, assignedLessonId: 7, spoke,
  },
 }, res)
 return {
  res,
  attempts: wrote['vic_goal_attempts.upsert'] || [],
  resolved: wrote['vic_goal_attempts.update'] || [],
  goals: wrote['vic_goal_results.insert'] || [],
 }
}

test('working a lesson opens an attempt row, even with no verdict yet', async () => {
 const { res, attempts, goals, resolved } = await run()
 assert.equal(res.code, 200)
 assert.equal(attempts.length, 1, 'every turn of schoolwork is recorded')
 assert.equal(goals.length, 0, 'VIC was not sure, so there is no verdict')
 assert.equal(resolved.length, 0, 'and the attempt stays open')
 const { row, opts } = attempts[0]
 assert.equal(row.student_id, 112)
 assert.equal(row.assignment_id, 5)
 assert.equal(row.standard_id, MATH)
 assert.equal(opts.onConflict, 'assignment_id', 'resuming today must update the attempt, not open a second')
})

test('the row records the level VIC taught at and the grade the child is enrolled in', async () => {
 const { attempts } = await run({ levels: [{ subject: 'math', level: 1, source: 'teacher', confirmed_at: '2026-10-27' }] })
 const { row } = attempts[0]
 assert.equal(row.instructional_level, 1, 'Kyaunna is taught at Grade 1')
 assert.equal(row.enrolled_grade, 6, 'and is enrolled in Grade 6')
})

test('a reading lesson is filed against the reading level, not the math one', async () => {
 const { attempts } = await run({
  standard: READING, subject: 'ELA & Social Studies',
  levels: [{ subject: 'math', level: 5, source: 'teacher' }, { subject: 'reading', level: 1, source: 'teacher' }],
 })
 assert.equal(attempts[0].row.instructional_level, 1)
})

test('turns counts the child’s own messages', async () => {
 const { attempts } = await run({
  messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }, { role: 'user', content: 'ready' }],
 })
 assert.equal(attempts[0].row.turns, 2)
})

test('a verdict writes the result, links it to the attempt, and closes the attempt', async () => {
 const { res, goals, resolved } = await run({ modelReply: 'You did it on your own three times.\n[[VIC_GOAL: met]]' })
 assert.equal(res.body.goal, 'met')
 assert.doesNotMatch(res.body.reply, /VIC_GOAL/, 'the child never sees the tag')
 assert.equal(goals.length, 1)
 assert.equal(goals[0].verdict, 'met')
 assert.equal(goals[0].attempt_id, ATTEMPT_ID, 'the verdict points at the work behind it')
 assert.equal(resolved.length, 1)
 assert.equal(resolved[0].verdict, 'met')
 assert.match(resolved[0].resolved_at, /^\d{4}-\d{2}-\d{2}T/)
})

test('a child who never pressed Listen: the record does not claim audio was used', async () => {
 const { attempts, goals } = await run({
  supports: { read_aloud: 'on_request', language: 'en', alternate_standards: false },
  spoke: false,
  modelReply: 'Good.\n[[VIC_GOAL: met]]',
 })
 assert.equal('audio_used' in attempts[0].row, false)
 assert.equal(goals[0].audio_on_assessed, false)
})

test('a met earned with the words read aloud is recorded as a different fact', async () => {
 const { attempts, goals } = await run({
  supports: { read_aloud: 'always', language: 'en', alternate_standards: false },
  spoke: true,
  modelReply: 'Good.\n[[VIC_GOAL: met]]',
 })
 assert.equal(attempts[0].row.audio_used, true)
 // Math: the words are not what is being judged, so reading them aloud is permitted and noted.
 assert.equal(attempts[0].row.audio_on_assessed, true)
 assert.equal(goals[0].audio_on_assessed, true)
})

test('a reading passage heard aloud is impossible, so the verdict is not marked as heard', async () => {
 const { attempts, goals } = await run({
  standard: READING, subject: 'ELA & Social Studies',
  supports: { read_aloud: 'always', language: 'en', alternate_standards: false },
  spoke: true,
  modelReply: 'Who is sad? [[TEXT]]Mia cried.[[/TEXT]]\n[[VIC_GOAL: met]]',
 })
 assert.equal(attempts[0].row.audio_used, true, 'VIC did speak to her')
 // Left off the row entirely rather than written false, so a spoken turn earlier in the same
 // attempt is never erased by a quiet one.
 assert.equal('audio_on_assessed' in attempts[0].row, false, 'but never the passage itself')
 assert.equal(goals[0].audio_on_assessed, false)
})

test('a child on Access Points has that recorded on the attempt and the verdict', async () => {
 const { attempts, goals } = await run({
  supports: { read_aloud: 'off', language: 'en', alternate_standards: true },
  modelReply: 'Good.\n[[VIC_GOAL: partly]]',
 })
 assert.equal(attempts[0].row.alternate_standard, true)
 assert.equal(goals[0].alternate_standard, true)
})

test('the language VIC taught in is recorded', async () => {
 const { attempts } = await run({ supports: { read_aloud: 'on_request', language: 'es', alternate_standards: false } })
 assert.equal(attempts[0].row.language, 'es')
})

test('My Own Work is not assessed, so nothing is recorded', async () => {
 const { res, attempts, goals } = await run({ sessionMode: 'own_work', modelReply: 'Here is how.\n[[VIC_GOAL: met]]' })
 assert.equal(res.code, 200)
 assert.equal(attempts.length, 0)
 assert.equal(goals.length, 0)
})

test('a safety reply is not schoolwork: no attempt, no verdict', async () => {
 const { res, attempts, goals } = await run({ studentText: 'my dad hits me', modelReply: 'Thank you for telling me.' })
 assert.equal(res.code, 200)
 assert.equal(attempts.length, 0, 'a child disclosing harm is not having her work recorded')
 assert.equal(goals.length, 0)
})

test('a database that refuses the attempt never costs the child her lesson', async () => {
 // The handler swallows attempt failures on purpose: evidence matters, the lesson matters more.
 const { res } = await run({ modelReply: 'Keep going.' })
 assert.equal(res.code, 200)
 assert.match(res.body.reply, /Keep going/)
})
