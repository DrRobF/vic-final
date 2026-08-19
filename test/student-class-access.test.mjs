import assert from 'node:assert/strict'
import test from 'node:test'
import { canAccessStudentRecord, mapStudentEnrollments } from '../lib/student-class-access.mjs'

test('an imported student receives both assigned subject classes', () => {
  const classes = mapStudentEnrollments([
    { class_id: 10, support_level: 'core', classes: { id: 10, class_name: 'Math', grade_level: '6' } },
    { class_id: 11, support_level: 'core', classes: { id: 11, class_name: 'Reading ELA', grade_level: '6' } },
  ])
  assert.deepEqual(classes.map((item) => item.className), ['Math', 'Reading ELA'])
})

test('another student record is rejected', () => {
  const signedIn = { id: 83, role: 'student' }
  assert.equal(canAccessStudentRecord(signedIn, 83), true)
  assert.equal(canAccessStudentRecord(signedIn, 84), false)
})

test('an unenrolled student has no classes so the join fallback can render', () => {
  assert.deepEqual(mapStudentEnrollments([]), [])
})
