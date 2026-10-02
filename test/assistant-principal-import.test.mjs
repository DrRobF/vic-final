import test from 'node:test'
import assert from 'node:assert/strict'
import { parseStaffCsv, parseCommitmentsCsv, readCsv } from '../lib/assistant-principal-import.mjs'

test('staff sheet accepts pasted names with commas and optional email', () => {
  const result = parseStaffCsv('Staff name,Role,Email (optional)\n"Rivera, Alex",teacher,alex@example.org\nMorgan Lee,office,\n')
  assert.deepEqual(result.errors, [])
  assert.equal(result.staff[0].display_name, 'Rivera, Alex')
  assert.equal(result.staff[1].email, null)
})

test('staff template keeps grade level separate from role and ignores its example row', () => {
  const result = parseStaffCsv('Staff name,Role,Grade or assignment (optional),Email (optional)\nEXAMPLE: Replace with staff name,Teacher,Grade 2,teacher@example.org\nAlex Rivera,Teacher,Grade 2,\n')
  assert.deepEqual(result.errors, [])
  assert.equal(result.staff.length, 1)
  assert.equal(result.staff[0].assignment, 'Grade 2')
})

test('commitments sheet accepts familiar labels and AM/PM time', () => {
  const result = parseCommitmentsCsv('Commitment,Applies to,Repeats,Due day,Due time\nLesson plans,Teachers,Weekly,Monday,10:00 AM\nClock in,All staff,Daily,,7:15 AM\n')
  assert.deepEqual(result.errors, [])
  assert.equal(result.commitments[0].due_weekday, 1)
  assert.equal(result.commitments[0].due_time, '10:00')
  assert.equal(result.commitments[1].due_weekday, null)
  assert.equal(result.commitments[1].due_time, '07:15')
})

test('the principal’s uploaded weekly and monthly rows import unchanged', () => {
  const csv = 'Commitment,Applies to,Repeats,Due day,Due time\r\nLesson Plans,Teacher,weekly,monday,10:00 AM\r\nGrades,Teacher,weekly,monday,3:30 PM\r\nParent Communication,Teacher,Monthly,First day of the Month,3:30 PM\r\n'
  const result = parseCommitmentsCsv(csv)
  assert.deepEqual(result.errors, [])
  assert.equal(result.commitments.length, 3)
  assert.deepEqual(result.commitments[2], { title: 'Parent Communication', applies_to: 'teachers', cadence: 'monthly', due_weekday: null, due_monthday: 1, due_time: '15:30' })
})

test('invalid rows stop an upload and identify their line', () => {
  const result = parseCommitmentsCsv('Commitment,Applies to,Repeats,Due day,Due time\nGrades,Teachers,Weekly,,10:00 AM\n')
  assert.match(result.errors[0], /Row 2/)
  assert.throws(() => parseStaffCsv('type,name,role,email\nstaff,Alex,teacher,'), /downloaded template/)
  assert.throws(() => readCsv('"unclosed'), /not closed/)
})
