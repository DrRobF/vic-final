import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { buildAssignmentRows, validateAssignedStudents } from '../lib/lesson-assignment.mjs'
import { selectActiveAssignment } from '../lib/ask-vic-context.mjs'

const confirmedAssignmentColumns = ['id', 'lesson_id', 'student_id', 'mode', 'status', 'assigned_at']

test('new and replacement Math lessons use the confirmed schema and resolve through lessons.class_id', () => {
  const counting = { id: 1, lesson_id: 10, student_id: 7, mode: 'on-level', status: 'assigned', assigned_at: '2026-01-01', lessons: { id: 10, class_id: 20, title: 'counting-to-10' } }
  const first = { ...buildAssignmentRows(11, [{ studentId: 7, mode: 'on-level' }], '2026-02-01')[0], id: 2, lessons: { id: 11, class_id: 20, title: 'New Math' } }
  const replacement = { ...buildAssignmentRows(12, [{ studentId: 7, mode: 'on-level' }], '2026-03-01')[0], id: 3, lessons: { id: 12, class_id: 20, title: 'Replacement Math' } }
  for (const row of [first, replacement]) assert.deepEqual(Object.keys(row).filter((key) => key !== 'lessons' && key !== 'id').sort(), confirmedAssignmentColumns.filter((key) => key !== 'id').sort())
  assert.equal(selectActiveAssignment([replacement, first, counting], { class_id: 20, support_level: 'core' })?.lesson_id, 12)
  assert.equal(selectActiveAssignment([replacement, first, counting], { class_id: 21, support_level: 'core' }), null)
  assert.equal(counting.lessons.title, 'counting-to-10')
})

test('cross-class student validation rejects students outside the selected class', () => {
  assert.match(validateAssignedStudents([7, 8], [7]).error, /enrolled/i)
  assert.deepEqual(validateAssignedStudents([7], [7]), { studentIds: [7] })
})

test('assignment code never selects, filters, inserts, or migrates assignments.class_id', async () => {
  const files = []
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['.git', '.next', 'node_modules'].includes(entry.name)) continue
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(target)
      else if (/\.(js|mjs|sql)$/.test(entry.name) && entry.name !== 'lesson-assignment-hotfix.test.mjs') files.push(target)
    }
  }
  await walk(new URL('..', import.meta.url).pathname)
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  assert.doesNotMatch(source, /assignments\s*\.\s*class_id|alter table public\.assignments add column[^;]*class_id/i)
})

test('teacher assignment endpoint verifies ownership, enrollment, and cleans up a failed assignment', async () => {
  const source = await readFile(new URL('../pages/api/teacher/assign-lesson.js', import.meta.url), 'utf8')
  assert.match(source, /eq\('teacher_id', auth\.profile\.id\)/)
  assert.match(source, /validateAssignedStudents/)
  assert.match(source, /from\('lessons'\)\.delete\(\)/)
  assert.doesNotMatch(source, /from\('assignments'\)[\s\S]{0,250}class_id/)
})
