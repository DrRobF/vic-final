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
 assert.match(csv, /Gloria Finch,hourly,2026-10-13,7:28 AM,3:34 PM,8.1,Corrected/)
 assert.match(csv, /TOTAL,,,16.3/)
 assert.equal(fmt12('15:04'), '3:04 PM')
})
