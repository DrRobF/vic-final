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

test('a start time gives leeway: 7:24 is on time when on-time means 7:30, whatever the sheet says', () => {
 const att = [{ staff_key: 'karen green', staff_name: 'Karen Green', day: '2026-10-14', clock_in: '07:24', status: 'Late', late_minutes: 9 },
  { staff_key: 'dawn white', staff_name: 'Dawn White', day: '2026-10-14', clock_in: '07:41', status: 'Late', late_minutes: 26 }]
 const pic = staffPicture({ staff, attendance: att, absences: [], today: '2026-10-14', settings: { onTime: '07:30' } })
 const by = Object.fromEntries(pic.people.map(p => [p.name, p]))
 assert.equal(by['Karen Green'].today.kind, 'in')
 assert.equal(by['Dawn White'].today.kind, 'late'); assert.equal(by['Dawn White'].today.minutes, 11)
})
test('a personal schedule wins over the school time; hourly hours add up by week; odd rows are flagged', () => {
 const gloria = { id: 'g', display_name: 'Gloria Finch', role: 'support', pay_type: 'hourly', shift_start: '07:30', shift_end: '15:30' }
 const values = [['Date', 'Teacher', 'Clock In', 'Clock Out'],
  ['2026-10-13', 'Gloria Finch', '2026-10-13 07:31:43', '2026-10-13 15:43:58'],
  ['2026-10-14', 'Gloria Finch', '2026-10-14 07:20:00', '2026-10-14 15:00:00'],
  ['2026-10-12', 'Gloria Finch', '2026-10-12 07:25:00', '2026-10-12 07:10:00']]
 const { rows } = parseAttendance(values, { date: 'Date', name: 'Teacher', clockIn: 'Clock In', clockOut: 'Clock Out' })
 assert.match(rows.find(r => r.day === '2026-10-12').flag, /Row 4: Clock-out is before clock-in/)
 const pic = staffPicture({ staff: [gloria, staff[0]], attendance: rows, absences: [], today: '2026-10-15', settings: { onTime: '08:00' } })
 const g = pic.people[0]
 assert.equal(g.lateCount, 1, '7:31 is late for a 7:30 shift even though the school time is 8:00')
 assert.equal(g.earlyCount, 1, 'left at 3:00 on a 3:30 shift')
 assert.equal(g.hours.thisWeek, 15.87)
 assert.equal(g.flags.length, 1)
})
test('sick and personal days used and left, from the absence form', () => {
 const s = [{ id: 's', display_name: 'Sandra Morgan', role: 'teacher', pay_type: 'salaried', sick_days: 10, personal_days: 3 }]
 const abs = [{ staff_key: 'sandra morgan', staff_name: 'Sandra Morgan', start_date: '2026-10-12', end_date: '2026-10-13', absence_type: 'Sick Day', portion: 'Whole Day' },
  { staff_key: 'sandra morgan', staff_name: 'Sandra Morgan', start_date: '2026-10-09', end_date: '2026-10-09', absence_type: 'Personal Day', portion: 'Half Day PM' }]
 const att = ['2026-10-09', '2026-10-12', '2026-10-13'].flatMap(d => [{ staff_key: 'x', staff_name: 'X', day: d, clock_in: '07:00' }, { staff_key: 'y', staff_name: 'Y', day: d, clock_in: '07:00' }])
 const p = staffPicture({ staff: s, attendance: att, absences: abs, today: '2026-10-14' }).people[0]
 assert.deepEqual([p.leave.sick, p.leave.personal, p.leave.paidUsed, p.leave.paidLeft], [2, 0.5, 2.5, 7.5], 'one pool of 10 paid days: sick and personal both count')
})

test('staff lists written "Last, First" match check-in names written "First Last"', () => {
 assert.equal(nameKey('Anderson, Andeen'), 'andeen anderson')
 assert.equal(nameKey('Dawkins,Dale'), 'dale dawkins')
 const pic = staffPicture({ staff: [{ id: 'a', display_name: 'Anderson, Andeen', role: 'teacher' }, { id: 'b', display_name: 'Dawkins,Dale', role: 'teacher' }], attendance: [{ staff_key: 'andeen anderson', staff_name: 'Andeen Anderson', day: '2026-10-14', clock_in: '06:44' }, { staff_key: 'dale dawkins', staff_name: 'Dale Dawkins', day: '2026-10-14', clock_in: '07:24' }], absences: [], today: '2026-10-14' })
 assert.deepEqual(pic.unmatched, [])
 assert.equal(pic.people[0].today.kind, 'in')
})

test('flexible staff are never late or absent; part-timers only count on their work days', () => {
 const days = ['2026-10-12', '2026-10-13', '2026-10-14'] // Mon Tue Wed
 const others = days.flatMap(d => [{ staff_key: 'x', staff_name: 'X', day: d, clock_in: '07:00' }, { staff_key: 'y', staff_name: 'Y', day: d, clock_in: '07:00' }])
 const staff2 = [
  { id: 'm', display_name: 'Mary Pennamon', pay_type: 'hourly', flexible: true },
  { id: 'b', display_name: 'Barbara Andrews', pay_type: 'hourly', work_days: [1, 3] },
 ]
 const att = [...others, { staff_key: 'mary pennamon', staff_name: 'Mary Pennamon', day: '2026-10-13', clock_in: '10:15', clock_out: '16:00' }, { staff_key: 'barbara andrews', staff_name: 'Barbara Andrews', day: '2026-10-12', clock_in: '09:00' }]
 const pic = staffPicture({ staff: staff2, attendance: att, absences: [], today: '2026-10-14', settings: { onTime: '07:30' } })
 const [m, b] = pic.people
 assert.equal(m.lateCount, 0); assert.equal(m.absences, 0); assert.equal(m.today.kind, 'off')
 assert.equal(b.absences, 1, 'missed Wednesday only; Tuesday is not her day')
 assert.equal(b.today.kind, 'absent_no_form')
})

test('reminders greet "Last, First" names by first name', () => {
 assert.match(reminderDraft({ name: 'Green, Karen', noFormDays: [], missingOut: [] }, 'X', 'no_form').body, /^Hi Karen,/)
 assert.match(reminderDraft({ name: 'Karen Green', noFormDays: [], missingOut: [] }, 'X', 'no_form').body, /^Hi Karen,/)
})

test('a name marked "ignore" disappears from the unmatched list', () => {
 const pic = staffPicture({ staff, attendance: [{ staff_key: 'savion banuchi', staff_name: 'Savion Banuchi', day: '2026-10-14', clock_in: '07:00' }], absences: [], today: '2026-10-14', aliases: { 'savion banuchi': 'ignore' } })
 assert.deepEqual(pic.unmatched, [])
})
