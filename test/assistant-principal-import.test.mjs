import test from 'node:test'
import assert from 'node:assert/strict'
import { parseSetupCsv, readCsv } from '../lib/assistant-principal-import.mjs'

const header = 'type,name,role,email,applies_to,cadence,due_day,due_time\n'

test('imports a mixed CSV with quoted names and school-specific commitments', () => {
  const result = parseSetupCsv(header + 'staff,"Rivera, Alex",teacher,alex@example.org,,,,\ncommitment,Lesson plans,,,teachers,weekly,Monday,10:00\ncommitment,Clock in,,,all,daily,,07:15\n')
  assert.deepEqual(result.errors, [])
  assert.equal(result.staff[0].display_name, 'Rivera, Alex')
  assert.equal(result.commitments[0].due_weekday, 1)
  assert.equal(result.commitments[1].due_weekday, null)
})

test('flags duplicate and invalid rows before sending an import', () => {
  const result = parseSetupCsv(header + 'staff,Alex Rivera,teacher,,,,,\nstaff,alex rivera,teacher,,,,,\ncommitment,Grades,,,teachers,weekly,,10:00\n')
  assert.equal(result.staff.length, 1)
  assert.equal(result.errors.length, 2)
})

test('rejects malformed quotes and unrecognized headings', () => {
  assert.throws(() => readCsv('"unclosed'), /not closed/)
  assert.throws(() => parseSetupCsv('wrong,name\nstaff,Alex'), /template headings/)
})
