import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { practiceOrder, practiceForRoom, learnerFor, startPractice } from '../lib/vic-practice.mjs'

const general = JSON.parse(readFileSync(new URL('../data/lesson-standards.json', import.meta.url), 'utf8'))
const access = JSON.parse(readFileSync(new URL('../data/access-points.json', import.meta.url), 'utf8'))
const catalogues = { general, access }

// A chainable stand-in for the Supabase builder: every filter returns itself, awaiting it
// resolves to the table's rows, and maybeSingle/single take the first.
function makeDb(tables = {}, log = {}) {
 return {
  from(table) {
   const rows = () => (typeof tables[table] === 'function' ? tables[table]() : tables[table] || [])
   const b = {
    select: () => b, eq: () => b, in: () => b, not: () => b, gte: () => b, lte: () => b,
    order: () => b, limit: () => b,
    insert(payload) { (log[table] ||= []).push(payload); return b },
    delete: () => b,
    maybeSingle: async () => ({ data: rows()[0] ?? null }),
    single: async () => ({ data: rows()[0] ?? null, error: null }),
    then: (res, rej) => Promise.resolve({ data: rows(), error: null }).then(res, rej),
   }
   return b
  },
 }
}

const learner = (level, supports = {}) => ({
 level, enrolled: 6, source: 'teacher', confirmed: true, offset: level - 6,
 supports: { read_aloud: 'off', language: 'en', alternate_standards: false, ...supports },
})

test('a grade 6 child working at level 1 gets level 1 standards, not grade 6', () => {
 // Kyaunna, exactly as her rows now stand in the database.
 return practiceOrder(makeDb({ lesson_weeks: [] }), {
  subject: 'reading', learner: learner(1), enrollments: [], catalogues,
 }).then(got => {
  assert.ok(!got.error, got.error)
  assert.ok(got.order.length > 0)
  const grades = new Set(got.order.map(id => general.find(s => s.id === id)?.grade))
  assert.deepEqual([...grades], ['1'])
 })
})

test('a grade 6 child working ahead gets the higher level', async () => {
 const got = await practiceOrder(makeDb({ lesson_weeks: [] }), {
  subject: 'math', learner: learner(8), enrollments: [], catalogues,
 })
 const grades = new Set(got.order.map(id => general.find(s => s.id === id)?.grade))
 assert.deepEqual([...grades], ['8'])
})

test('what the teacher planned comes before the rest of the level', async () => {
 const planned = general.find(s => s.state === 'FL' && s.subject === 'math' && s.grade === '4')
 const db = makeDb({ lesson_weeks: [{ week_of: '2026-10-26', grade: '4', subject: 'math', days: [{ standardIds: [planned.id] }] }] })
 const enrollments = [{ classes: { class_name: 'Math & Science', grade_level: 4, users: { auth_user_id: 'u1' } } }]
 const got = await practiceOrder(db, { subject: 'math', learner: learner(4), enrollments, catalogues })
 assert.equal(got.order[0], planned.id)
})

test('a child on access points gets access points only', async () => {
 const got = await practiceOrder(makeDb({ lesson_weeks: [] }), {
  subject: 'reading', learner: learner(1, { alternate_standards: true }), enrollments: [], catalogues,
 })
 assert.equal(got.track, 'access')
 assert.ok(got.order.length > 0)
 assert.ok(got.order.every(id => access.some(s => s.id === id)))
})

test('access points refuse rather than silently handing over grade-level work', async () => {
 const got = await practiceOrder(makeDb({ lesson_weeks: [] }), {
  subject: 'reading', learner: learner(1, { alternate_standards: true }), enrollments: [],
  catalogues: { general, access: [] },
 })
 assert.ok(got.error)
 assert.equal(got.order, undefined)
})

test('a child with no grade and no level is refused, not given a random standard', async () => {
 const got = await practiceOrder(makeDb({ lesson_weeks: [] }), {
  subject: 'math', learner: { ...learner(1), level: null }, enrollments: [], catalogues,
 })
 assert.match(got.error, /no grade or level/i)
})

test('the level comes from student_levels and falls back to the enrolled grade', async () => {
 const withLevel = await learnerFor(makeDb({
  users: [{ grade_level: 6 }],
  student_levels: [{ subject: 'reading', level: 1, source: 'iep', confirmed_at: '2026-10-27' }],
  student_supports: [{ read_aloud: 'always', language: 'en', alternate_standards: false }],
 }), 112, 'reading')
 assert.equal(withLevel.level, 1)
 assert.equal(withLevel.enrolled, 6)
 assert.equal(withLevel.supports.read_aloud, 'always')

 const without = await learnerFor(makeDb({ users: [{ grade_level: 4 }], student_levels: [], student_supports: [] }), 7, 'math')
 assert.equal(without.level, 4)
 assert.equal(without.source, 'enrolled')
})

test('one child failing does not stop the rest of the room', async () => {
 // The aide presses this at 8:05 with eleven children waiting. A single bad row must not
 // turn into an error page for everyone.
 const log = {}
 const db = makeDb({
  users: [{ grade_level: 4 }],
  student_levels: [], student_supports: [], lesson_weeks: [], vic_goal_results: [], assignments: [],
  enrollments: [{ class_id: 40, support_level: 'core', classes: { id: 40, class_name: 'VIC & IXL', grade_level: 4, teacher_id: 9, users: { auth_user_id: 'u1' } } }],
  lessons: [{ id: 555 }],
 }, log)
 const students = [
  { id: 1, name: 'A', classIds: [40], vicClassId: 40 },
  { id: 2, name: 'B', classIds: [], vicClassId: null },   // not in any class in this room
  { id: 3, name: 'C', classIds: [40], vicClassId: 40 },
 ]
 const out = await practiceForRoom(db, { students, subject: 'math', catalogues })
 assert.equal(out.started, 2)
 assert.equal(out.skipped.length, 1)
 assert.equal(out.skipped[0].name, 'B')
})

test('a child already working on a skill today is resumed, not handed a second one', async () => {
 const db = makeDb({
  enrollments: [{ class_id: 40, support_level: 'core', classes: { id: 40, class_name: 'VIC & IXL', grade_level: 4, teacher_id: 9, users: {} } }],
  assignments: [{ id: 77, lesson_id: 501, lessons: { id: 501, class_id: 40, practice_standard: 'FL:MA.4.AR.1.1' } }],
  vic_goal_results: [],
 })
 const out = await startPractice(db, { studentId: 1, classId: 40, subject: 'math', catalogues })
 assert.equal(out.resumed, true)
 assert.equal(out.lessonId, 501)
})
