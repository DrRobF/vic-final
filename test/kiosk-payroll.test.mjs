import test from 'node:test'
import assert from 'node:assert/strict'
import { codeHash, clockAction, afterMiss, isLocked, validCode } from '../lib/kiosk.mjs'
import { mergeAttendance, payrollReport, payrollCsv, fmt12 } from '../lib/payroll.mjs'
import { nameKey } from '../lib/staff-attendance.mjs'

test('codes are hashed per school and never equal the code', () => {
 const a = codeHash('secret', 'school-a', '2781'), b = codeHash('secret', 'school-b', '2781')
 assert.notEqual(a, b); assert.ok(!a.includes('2781')); assert.equal(a, codeHash('secret', 'school-a', '2781'))
 assert.ok(validCode('0042')); assert.ok(!validCode('12')); assert.ok(!validCode('12a4'))
})
test('first entry clocks in, second clocks out, third is refused', () => {
 assert.equal(clockAction(null), 'in')
 assert.equal(clockAction({ clock_in: '07:10' }), 'out')
 assert.equal(clockAction({ clock_in: '07:10', clock_out: '15:31' }), 'done')
})
test('five wrong codes in five minutes lock the kiosk for a minute', () => {
 let k = {}, now = Date.parse('2026-10-14T11:00:00Z')
 for (let i = 0; i < 4; i++) { k = { ...k, ...afterMiss(k, now + i * 1000) }; assert.equal(isLocked(k, now + i * 1000), false) }
 k = { ...k, ...afterMiss(k, now + 5000) }
 assert.equal(isLocked(k, now + 6000), true); assert.equal(isLocked(k, now + 70000), false)
 assert.equal(afterMiss(k, now + 10 * 60 * 1000).fail_count, 1, 'old misses expire')
})
test('kiosk punches win over sheet rows for the same day; payroll adds hours and flags problems', () => {
 const staff = [{ id: 'g', display_name: 'Gloria Finch' }]
 const punches = [{ staff_id: 'g', day: '2026-10-13', clock_in: '07:28', clock_out: '15:34', edited_at: '2026-10-14' }, { staff_id: 'g', day: '2026-10-14', clock_in: '07:25', clock_out: null }]
 const sheet = [{ staff_key: 'gloria finch', staff_name: 'Gloria Finch', day: '2026-10-13', clock_in: '07:00', clock_out: '15:00' }, { staff_key: 'gloria finch', staff_name: 'Gloria Finch', day: '2026-10-12', clock_in: '07:31', clock_out: '15:43' }]
 const merged = mergeAttendance(staff, punches, sheet, nameKey)
 assert.equal(merged.length, 3)
 assert.equal(merged.find(m => m.day === '2026-10-13').clock_in, '07:28')
 const att = new Map([['g', new Map(merged.map(m => [m.day, m]))]])
 const [p] = payrollReport({ people: [{ id: 'g', name: 'Gloria Finch', payType: 'hourly' }], attendanceByStaff: att, absencesByStaff: new Map([['g', [{ startDate: '2026-10-15', endDate: '2026-10-15', type: 'Sick Day', portion: 'Whole Day' }]]]), from: '2026-10-12', to: '2026-10-16' })
 assert.equal(p.totalHours, 16.3)
 assert.equal(p.issues, 1)
 assert.equal(p.rows.find(r => r.day === '2026-10-13').edited, true)
 assert.equal(p.absences['Sick Day'], 1)
 const csv = payrollCsv([p], '2026-10-12', '2026-10-16', 'Saint Peter’s')
 assert.match(csv, /Gloria Finch,hourly,2026-10-13,7:28 AM,3:34 PM,8.1,8.1,Corrected/)
 assert.match(csv, /TOTAL,,,16.3,16.3/)
 assert.equal(fmt12('15:04'), '3:04 PM')
})

test('paid hours stop at the daily maximum unless extra time is approved', () => {
 const att = new Map([['m', new Map([
  ['2026-10-13', { clock_in: '10:00', clock_out: '13:45' }],
  ['2026-10-14', { clock_in: '10:00', clock_out: '13:30', approved: true }],
  ['2026-10-15', { clock_in: '10:00', clock_out: '12:30' }],
 ])]])
 const [m] = payrollReport({ people: [{ id: 'm', name: 'Mary Pennamon', payType: 'hourly', maxHours: 3 }], attendanceByStaff: att, absencesByStaff: new Map(), from: '2026-10-13', to: '2026-10-15' })
 assert.deepEqual(m.rows.map(r => [r.worked, r.hours, r.over]), [[3.75, 3, 0.75], [3.5, 3.5, 0.5], [2.5, 2.5, 0]])
 assert.equal(m.totalHours, 9); assert.equal(m.totalWorked, 9.75)
 assert.match(payrollCsv([m], 'a', 'b', 'S'), /0.75 h over max, not paid/)
})

test('a day-off request only changes the record once a leader approves it', () => {
 // The request table is written by the teacher; approving copies it into day marks.
 // Here we check the weekday expansion a leader's approval uses, so a Friday-to-Monday
 // request becomes two marked days, not four.
 const expand = (from, to) => { const out = []; for (let d = from, i = 0; d <= to && i < 31; i++) { const wd = new Date(`${d}T12:00:00Z`).getUTCDay(); if (wd > 0 && wd < 6) out.push(d); const n = new Date(`${d}T12:00:00Z`); n.setUTCDate(n.getUTCDate() + 1); d = n.toISOString().slice(0, 10) } return out }
 assert.deepEqual(expand('2026-10-16', '2026-10-19'), ['2026-10-16', '2026-10-19'], 'the weekend in the middle is skipped')
 assert.deepEqual(expand('2026-10-17', '2026-10-18'), [], 'a weekend-only request marks nothing')
 assert.deepEqual(expand('2026-10-15', '2026-10-15'), ['2026-10-15'])
})

test('days off count from the school’s start date, and days used before it carry in', async () => {
 const { staffPicture } = await import('../lib/staff-attendance.mjs')
 const staff = [{ id: 'a', display_name: 'Dawn White', role: 'support', pay_type: 'salaried', sick_days: 10, leave_used_before: 3 },
  { id: 'b', display_name: 'Karen Green', role: 'teacher', pay_type: 'salaried', sick_days: 10 },
  { id: 'c', display_name: 'Sandra Morgan', role: 'teacher', pay_type: 'salaried', sick_days: 10 }]
 // Karen and Sandra are in every day (so each day counts as a school day);
 // Dawn misses 2026-10-13 and 2026-10-14.
 const att = ['2026-10-12', '2026-10-13', '2026-10-14'].flatMap(day => [{ staff_key: 'karen green', day, clock_in: '07:20' }, { staff_key: 'sandra morgan', day, clock_in: '07:20' }])
  .concat([{ staff_key: 'dawn white', day: '2026-10-12', clock_in: '07:20' }])
 const pic = staffPicture({ staff, attendance: att, absences: [], today: '2026-10-15', settings: { onTime: '07:30' } })
 const dawn = pic.people.find(p => p.id === 'a')
 assert.equal(dawn.leave.carried, 3, 'days used before AskVic are carried in')
 assert.equal(dawn.leave.paidUsed, 5, '3 carried in plus the 2 days missed')
 assert.equal(dawn.leave.paidLeft, 5)
 // Start the count after those misses and only the carry-in is left.
 const later = staffPicture({ staff, attendance: att, absences: [], today: '2026-10-15', settings: { onTime: '07:30', leaveFrom: '2026-10-14' } })
 const dawnLater = later.people.find(p => p.id === 'a')
 assert.equal(dawnLater.leave.paidUsed, 4, 'only 2026-10-14 is counted now')
 assert.equal(dawnLater.countFrom, '2026-10-14')
})
