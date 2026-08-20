import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { pickLatestAssignment } from '../lib/assignment-resolution.js'

const MATH = 10
const READING = 11
const ALIJAH = 21

function assignmentsForClass(assignments, lessons, studentId, classId) {
  const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]))
  return assignments
    .filter((assignment) => assignment.student_id === studentId && assignment.status === 'assigned')
    .filter((assignment) => lessonById.get(assignment.lesson_id)?.class_id === classId)
}

test('fractions persists through the real lesson-owned class relationship and replaces visibly', () => {
  const lessons = [{ id: 90, class_id: MATH, title: 'counting to 10' }]
  const assignments = [{ id: 100, lesson_id: 90, student_id: ALIJAH, mode: 'on-level', status: 'assigned', assigned_at: '2026-08-19T00:00:00Z' }]

  // Opening and refreshing the portal are reads and leave the prior assignment intact.
  assignmentsForClass(assignments, lessons, ALIJAH, MATH)
  assignmentsForClass(assignments, lessons, ALIJAH, MATH)
  assert.equal(assignments.length, 1)

  lessons.push({ id: 91, class_id: MATH, title: 'fractions' })
  assignments.push({ id: 101, lesson_id: 91, student_id: ALIJAH, mode: 'on-level', status: 'assigned', assigned_at: '2026-08-20T00:00:00Z' })

  assert.equal(lessons.find((lesson) => lesson.id === 91)?.class_id, MATH)
  assert.equal(assignments.find((assignment) => assignment.id === 101)?.student_id, ALIJAH)
  const mathRows = assignmentsForClass(assignments, lessons, ALIJAH, MATH)
  assert.equal(mathRows.length, 2)
  assert.equal(pickLatestAssignment(mathRows)?.lesson_id, 91)
  assert.equal(assignmentsForClass(assignments, lessons, ALIJAH, READING).length, 0)
  assert.equal(assignments.length, 2)
})

test('write and read endpoints use only columns from the real schema', async () => {
  const writeSource = await readFile(new URL('../pages/api/teacher/assign-lesson.js', import.meta.url), 'utf8')
  const readSource = await readFile(new URL('../pages/api/student/latest-assignment.js', import.meta.url), 'utf8')
  assert.match(writeSource, /class_id: classId/)
  assert.doesNotMatch(writeSource, /lesson_id: lesson\.id,\s*student_id: studentId,\s*class_id:/)
  assert.match(writeSource, /assignments[^]*select\('id, lesson_id, student_id'\)/)
  assert.match(readSource, /lessons!inner\(id, class_id/)
  assert.match(readSource, /eq\('lessons\.class_id', activeClassId\)/)
  const assignmentQuery = readSource.slice(readSource.indexOf("from('assignments')"))
  assert.doesNotMatch(assignmentQuery, /eq\('class_id', activeClassId\)/)
})
