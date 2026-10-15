// Client-safe helpers shared by the attendance page, the payroll page and the API.
import { minutesBetween, rowFlag } from './staff-attendance.mjs'

export const fmt12 = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

// Kiosk punches are the source of truth; sheet rows fill in days with no punch (history before the switch).
// Sheet rows are re-keyed to the matched staff member (so "Dwn White" and "White, Dawn" become one person).
export function mergeAttendance(staff, punches, sheetRows, nameKey, match = () => null) {
 const keyOf = new Map(staff.map(s => [s.id, nameKey(s.display_name)]))
 const punched = new Set(punches.map(p => `${keyOf.get(p.staff_id)}|${p.day}`))
 sheetRows = sheetRows.map(r => { const s = match(r.staff_key); return s ? { ...r, staff_key: keyOf.get(s.id), staff_name: s.display_name } : r })
 const fromPunches = punches.filter(p => keyOf.has(p.staff_id)).map(p => ({ staff_key: keyOf.get(p.staff_id), staff_name: staff.find(s => s.id === p.staff_id).display_name, day: p.day, clock_in: p.clock_in, clock_out: p.clock_out, status: '', late_minutes: 0, flag: rowFlag({ clockIn: p.clock_in, clockOut: p.clock_out }), edited: !!p.edited_at }))
 return [...fromPunches, ...sheetRows.filter(r => !punched.has(`${r.staff_key}|${r.day}`))]
}

function daysBetween(from, to) { const out = []; let d = from; for (let i = 0; d <= to && i < 62; i++) { out.push(d); const n = new Date(`${d}T12:00:00Z`); n.setUTCDate(n.getUTCDate() + 1); d = n.toISOString().slice(0, 10) } return out }

// The pay-period report: hourly staff get every day's in/out/hours; salaried staff get days worked and leave taken.
export function payrollReport({ people, attendanceByStaff, absencesByStaff, from, to }) {
 const days = daysBetween(from, to)
 return people.map(p => {
  const att = attendanceByStaff.get(p.id) || new Map(), abs = absencesByStaff.get(p.id) || []
  const rows = days.map(d => {
   const a = att.get(d)
   const minutes = a?.clock_in && a?.clock_out && !a.flag ? Math.max(0, minutesBetween(a.clock_in, a.clock_out) || 0) : 0
   const form = abs.find(x => x.startDate && d >= x.startDate && d <= (x.endDate || x.startDate))
   return a?.clock_in || form ? { day: d, in: a?.clock_in || '', out: a?.clock_out || '', hours: Math.round(minutes / 60 * 100) / 100, flag: a?.flag || (a?.clock_in && !a?.clock_out ? 'Missing clock-out' : ''), edited: !!a?.edited, absence: !a?.clock_in && form ? `${form.type || 'Absent'}${form.portion && !/whole/i.test(form.portion) ? ` (${form.portion})` : ''}` : '' } : null
  }).filter(Boolean)
  const total = Math.round(rows.reduce((n, r) => n + r.hours, 0) * 100) / 100
  const byType = {}
  for (const r of rows) if (r.absence) byType[r.absence] = (byType[r.absence] || 0) + 1
  return { id: p.id, name: p.name, payType: p.payType, rows, totalHours: total, daysWorked: rows.filter(r => r.in).length, issues: rows.filter(r => r.flag).length, absences: byType }
 })
}

export function payrollCsv(report, from, to, schoolName) {
 const esc = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
 const lines = [[`${schoolName} payroll`, `${from} to ${to}`].map(esc).join(','), ['Name', 'Pay type', 'Date', 'Clock in', 'Clock out', 'Hours', 'Note'].join(',')]
 for (const p of report) {
  for (const r of p.rows) lines.push([p.name, p.payType, r.day, fmt12(r.in), fmt12(r.out), r.in ? r.hours : '', [r.absence, r.flag, r.edited ? 'Corrected' : ''].filter(Boolean).join('; ')].map(esc).join(','))
  lines.push([p.name, p.payType, 'TOTAL', '', '', p.payType === 'hourly' ? p.totalHours : '', `${p.daysWorked} days worked`].map(esc).join(','))
 }
 return lines.join('\n')
}
