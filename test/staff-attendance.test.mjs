import test from 'node:test'
import assert from 'node:assert/strict'
import { guessMapping, validateMapping, parseAttendance, parseAbsences, staffPicture, nameKey, parseDateTime, reminderDraft } from '../lib/staff-attendance.mjs'

const logHeaders = ['Date', 'Teacher', 'Slot', 'Code', 'Clock In', 'Clock Out', 'Hours', 'Status', 'Late Minutes', 'Early Minutes', 'Notes']
const formHeaders = ['Timestamp', 'First Name', 'Last Name', 'Date Submitted', 'Start Date of Absence', 'End Date of Absence ( if multiple days)', 'What type of absence is this?', 'Is this a whole day, half day, or custom time a', 'If custom hours when is the start and end time', 'Person asked to cover the class?', 'Typing my name is also my valid signature.', 'Days Charged']

test('column guesses fit a real check-in log and never pick the PIN column', () => {
 const m = guessMapping('attendance', logHeaders)
 assert.deepEqual(m, { date: 'Date', name: 'Teacher', clockIn: 'Clock In', clockOut: 'Clock Out', status: 'Status', lateMinutes: 'Late Minutes', earlyMinutes: 'Early Minutes' })
 assert.throws(() => validateMapping('attendance', { ...m, name: 'Code' }, logHeaders))
})
test('column guesses fit a Google Form absence sheet', () => {
 const m = guessMapping('absences', formHeaders)
 assert.equal(m.firstName, 'First Name'); assert.equal(m.lastName, 'Last Name')
 assert.equal(m.start, 'Start Date of Absence'); assert.equal(m.end, 'End Date of Absence ( if multiple days)')
 assert.equal(m.type, 'What type of absence is this?'); assert.equal(m.coverage, 'Person asked to cover the class?')
 assert.ok(validateMapping('absences', m, formHeaders))
})
test('names and dates are read forgivingly; typo years are flagged', () => {
 assert.equal(nameKey('Dwn White (Dr Furman)'), 'dwn white')
 assert.equal(nameKey('  karen  GREEN '), 'karen green')
 assert.deepEqual(parseDateTime('2026-09-30 07:05:06'), { date: '2026-09-30', time: '07:05' })
 assert.equal(parseDateTime('9/4/2026').date, '2026-09-04')
 assert.ok(parseDateTime('10/14/0026').problem)
})

const staff = [
 { id: 'a', display_name: 'Karen Green', role: 'teacher', pay_type: 'salaried', email: 'k@x.org' },
 { id: 'b', display_name: 'Dawn White', role: 'teacher', pay_type: 'hourly', email: '' },
 { id: 'c', display_name: 'Sandra Morgan', role: 'teacher', pay_type: 'salaried' },
 { id: 'd', display_name: 'Julie Murphy', role: 'teacher', pay_type: 'salaried' },
]
const log = [logHeaders,
 ['2026-10-12', 'Karen Green', '3', '1111', '2026-10-12 07:05:06', '2026-10-12 15:44:20', '8.6', 'On time', '0', '0'],
 ['2026-10-12', 'Dawn White', '13', '2222', '2026-10-12 07:04:52', '', '8', 'Missing out', '0', '0'],
 ['2026-10-12', 'Julie Murphy', '11', '3333', '2026-10-12 07:06:51', '2026-10-12 15:38:10', '8.5', 'On time', '0', '0'],
 ['2026-10-13', 'Karen Green', '3', '1111', '2026-10-13 07:31:43', '2026-10-13 15:44:20', '8.2', 'Late', '11', '0'],
 ['2026-10-13', 'Dawn White', '13', '2222', '2026-10-13 07:01:00', '2026-10-13 15:01:00', '8', 'On time', '0', '0'],
 ['2026-10-14', 'Karen Green', '3', '1111', '2026-10-14 07:01:24', '', '', 'Missing out', '0', '0'],
 ['2026-10-14', 'Dawn White', '13', '2222', '2026-10-14 07:16:40', '', '', 'On time', '0', '0'],
 ['2026-10-14', 'Mystery Person', '99', '9999', '2026-10-14 07:00:00', '', '', 'On time', '0', '0'],
]
const form = [formHeaders,
 ['10/13/2026 6:34', 'Sandra', 'Morgan', '10/13/2026', '10/13/2026', '10/14/2026', 'Sick Day', 'Whole Day', '', 'Ms. Mack', 'Sandra Morgan', '2'],
 ['10/12/2026 6:00', 'sandra', 'morgan', '10/12/2026', '10/12/2026', '', 'Personal Day', 'Whole Day', '', 'No', 'Sandra Morgan', '1'],
]

test('the staff picture: today, absences with and without a form, late, missing clock-out for hourly only', () => {
 const att = parseAttendance(log, guessMapping('attendance', logHeaders)).rows
 const abs = parseAbsences(form, guessMapping('absences', formHeaders)).rows
 const pic = staffPicture({ staff, attendance: att, absences: abs, today: '2026-10-14' })
 const by = Object.fromEntries(pic.people.map(p => [p.name, p]))
 assert.equal(pic.todayIsSchoolDay, true)
 assert.equal(by['Karen Green'].today.kind, 'in')
 assert.equal(by['Karen Green'].lateCount, 1)
 assert.deepEqual(by['Karen Green'].missingOut, [], 'salaried staff are never flagged for clock-out')
 assert.deepEqual(by['Dawn White'].missingOut, ['2026-10-12'], 'hourly staff are flagged, but not for today')
 assert.equal(by['Sandra Morgan'].today.kind, 'absent_form')
 assert.equal(by['Sandra Morgan'].today.type, 'Sick Day')
 assert.equal(by['Sandra Morgan'].absences, 3)
 assert.deepEqual(by['Sandra Morgan'].noFormDays, [])
 assert.equal(by['Julie Murphy'].today.kind, 'absent_no_form')
 assert.deepEqual(by['Julie Murphy'].noFormDays, ['2026-10-13', '2026-10-14'])
 assert.deepEqual(pic.unmatched.map(u => u.name), ['Mystery Person'])
 assert.match(reminderDraft(by['Julie Murphy'], 'X', 'no_form').body, /Tuesday, October 13/)
})
test('a saved alias links a misspelled name to the right person', () => {
 const pic = staffPicture({ staff, attendance: [{ staff_key: 'dwn white', staff_name: 'Dwn White', day: '2026-10-14', clock_in: '07:00' }], absences: [], today: '2026-10-14', aliases: { 'dwn white': 'b' } })
 assert.equal(pic.people.find(p => p.id === 'b').today.kind, 'in')
})
