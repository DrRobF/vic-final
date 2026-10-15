// Turns a school's own spreadsheets (a check-in log and an absence form) into a daily picture per staff member.
// Pure functions: no network, no database. The API reads the sheets and stores what these return.

// Columns that hold secrets (sign-in PINs) are never offered for matching or read.
export const SECRET_HEADER = /\b(code|pin|password|passcode)\b/i

export const ATTENDANCE_FIELDS = [
 { key: 'date', label: 'Date', guess: /^date$|^day$/i, required: true },
 { key: 'name', label: 'Staff name', guess: /teacher|staff|name|employee/i, required: true },
 { key: 'clockIn', label: 'Clock in time', guess: /clock\s*in|time\s*in|check\s*in|arriv/i, required: true },
 { key: 'clockOut', label: 'Clock out time', guess: /clock\s*out|time\s*out|check\s*out|leav|depart/i },
 { key: 'status', label: 'Status', guess: /status/i },
 { key: 'lateMinutes', label: 'Late minutes', guess: /late\s*min/i },
 { key: 'earlyMinutes', label: 'Left-early minutes', guess: /early\s*min/i },
]
export const ABSENCE_FIELDS = [
 { key: 'firstName', label: 'First name', guess: /first\s*name/i },
 { key: 'lastName', label: 'Last name', guess: /last\s*name/i },
 { key: 'fullName', label: 'Full name (if one column)', guess: /^(full\s*)?name$|staff\s*name|teacher|employee/i },
 { key: 'start', label: 'First day absent', guess: /start\s*date|date\s*of\s*absence|first\s*day/i, required: true },
 { key: 'end', label: 'Last day absent', guess: /end\s*date|last\s*day|multiple\s*days/i },
 { key: 'type', label: 'Type of absence', guess: /type\s*of\s*absence|what\s*type|reason/i },
 { key: 'portion', label: 'Whole or part day', guess: /whole\s*day|half\s*day|portion/i },
 { key: 'coverage', label: 'Coverage', guess: /cover/i },
]

export function fieldsFor(kind) { return kind === 'absences' ? ABSENCE_FIELDS : ATTENDANCE_FIELDS }

// Best first guess at which column answers which question. The principal confirms or changes it.
export function guessMapping(kind, headers) {
 const usable = headers.map((h, i) => ({ h: String(h || '').trim(), i })).filter(x => x.h && !SECRET_HEADER.test(x.h))
 const taken = new Set(), mapping = {}
 for (const f of fieldsFor(kind)) {
  const hit = usable.find(x => !taken.has(x.h) && f.guess.test(x.h))
  if (hit) { mapping[f.key] = hit.h; taken.add(hit.h) }
 }
 if (kind === 'absences' && mapping.firstName && mapping.lastName) delete mapping.fullName
 return mapping
}

export function validateMapping(kind, mapping, headers) {
 const clean = {}, allowed = new Set(headers.map(h => String(h || '').trim()).filter(h => h && !SECRET_HEADER.test(h)))
 for (const f of fieldsFor(kind)) {
  const v = typeof mapping?.[f.key] === 'string' ? mapping[f.key].trim() : ''
  if (v) { if (!allowed.has(v)) throw new Error(`“${v}” isn’t a column AskVic can read in that tab.`); clean[f.key] = v }
 }
 for (const f of fieldsFor(kind)) if (f.required && !clean[f.key]) throw new Error(`Choose the column for “${f.label}.”`)
 if (kind === 'absences' && !clean.fullName && !(clean.firstName && clean.lastName)) throw new Error('Choose the name column (or both first and last name).')
 return clean
}

// "Dwn White (Dr Furman)" → "dwn white"
// "Dwn White (Dr Furman)" → "dwn white"; "Anderson, Andeen" → "andeen anderson" (staff lists are often Last, First).
export function nameKey(value) {
 let s = String(value || '').replace(/\([^)]*\)/g, ' ')
 const comma = s.split(',')
 if (comma.length === 2 && comma[0].trim() && comma[1].trim()) s = `${comma[1]} ${comma[0]}`
 return s.toLowerCase().replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Accepts 2026-09-30, 2026-09-30 06:38:02, 9/4/2026, 9/4/26. Returns { date, time, problem }.
export function parseDateTime(value) {
 const s = String(value ?? '').trim()
 if (!s) return { date: null, time: null }
 let y, m, d, rest = ''
 let hit = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/)
 if (hit) { [, y, m, d, rest] = hit }
 else if ((hit = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(.*)$/))) { [, m, d, y, rest] = hit; if (y.length === 2) y = `20${y}` }
 else return { date: null, time: null, problem: `Couldn’t read the date “${s.slice(0, 30)}”` }
 y = Number(y); m = Number(m); d = Number(d)
 if (y < 2000 || y > 2100) return { date: null, time: null, problem: `The year in “${s.slice(0, 30)}” looks like a typo` }
 if (m < 1 || m > 12 || d < 1 || d > 31) return { date: null, time: null, problem: `Couldn’t read the date “${s.slice(0, 30)}”` }
 const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
 const t = rest.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?/i)
 let time = null
 if (t) { let h = Number(t[1]); const ap = (t[3] || '').toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0; time = `${String(h).padStart(2, '0')}:${t[2]}` }
 return { date, time }
}
export function parseTimeOnly(value, fallbackDate) {
 const s = String(value ?? '').trim()
 if (!s) return null
 const full = parseDateTime(s)
 if (full.time) return full.time
 const t = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i)
 if (!t) return null
 let h = Number(t[1]); const ap = (t[3] || '').toLowerCase(); if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0
 return `${String(h).padStart(2, '0')}:${t[2]}`
}

function rowsAsObjects(values) {
 const headers = (values[0] || []).map(h => String(h || '').trim())
 return values.slice(1).map((r, i) => ({ row: i + 2, get: col => { const at = headers.indexOf(col); return at < 0 ? '' : String(r[at] ?? '').trim() } }))
}
const int = v => { const n = Number(String(v).replace(/[^0-9.-]/g, '')); return Number.isFinite(n) && String(v).trim() !== '' ? Math.round(n) : null }

const toMin = t => { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }
export function minutesBetween(a, b) { const x = toMin(a), y = toMin(b); return x == null || y == null ? null : y - x }

// Rows that are probably mistakes in the check-in sheet. The fix happens in the sheet; VIC re-reads it.
export function rowFlag(a) {
 const inM = toMin(a.clockIn), outM = toMin(a.clockOut)
 if (inM != null && (inM < 5 * 60 || inM > 12 * 60)) return 'Odd clock-in time'
 if (inM != null && outM != null && outM <= inM) return 'Clock-out is before clock-in'
 if (inM != null && outM != null && outM - inM > 12 * 60) return 'Over 12 hours'
 return null
}

export function parseAttendance(values, mapping) {
 const out = [], problems = []
 for (const r of rowsAsObjects(values)) {
  const name = r.get(mapping.name)
  if (!name) continue
  const inRaw = r.get(mapping.clockIn), dateRaw = mapping.date ? r.get(mapping.date) : inRaw
  const parsed = parseDateTime(dateRaw || inRaw)
  if (!parsed.date) { if (parsed.problem) problems.push(`Row ${r.row}: ${parsed.problem}`); continue }
  out.push({
   row: r.row, staffKey: nameKey(name), staffName: name.slice(0, 120), day: parsed.date,
   clockIn: parseTimeOnly(inRaw), clockOut: mapping.clockOut ? parseTimeOnly(r.get(mapping.clockOut)) : null,
   status: mapping.status ? r.get(mapping.status).slice(0, 60) || null : null,
   lateMinutes: mapping.lateMinutes ? int(r.get(mapping.lateMinutes)) : null,
   earlyMinutes: mapping.earlyMinutes ? int(r.get(mapping.earlyMinutes)) : null,
  })
 }
 // One row per person per day: earliest clock-in, latest clock-out. Two check-ins on one day get flagged.
 const byKey = new Map()
 for (const a of out) {
  const k = `${a.staffKey}|${a.day}`, prev = byKey.get(k)
  if (!prev) { byKey.set(k, { ...a, rows: [a.row] }); continue }
  const ins = [prev.clockIn, a.clockIn].filter(Boolean).sort(), outs = [prev.clockOut, a.clockOut].filter(Boolean).sort()
  byKey.set(k, { ...prev, clockIn: ins[0] || null, clockOut: outs[outs.length - 1] || null, rows: [...prev.rows, a.row], dup: true })
 }
 const rows = [...byKey.values()].map(({ row, rows: rs, dup, ...a }) => {
  const why = dup ? 'Checked in more than once' : rowFlag(a)
  return { ...a, flag: why ? `Row ${rs.join(', ')}: ${why}` : null }
 })
 return { rows, problems }
}

export function parseAbsences(values, mapping) {
 const out = [], problems = []
 for (const r of rowsAsObjects(values)) {
  const name = mapping.fullName ? r.get(mapping.fullName) : `${r.get(mapping.firstName)} ${r.get(mapping.lastName)}`.trim()
  if (!name) continue
  const start = parseDateTime(r.get(mapping.start)), end = mapping.end ? parseDateTime(r.get(mapping.end)) : { date: null }
  const issues = [start.problem, end.problem].filter(Boolean)
  out.push({
   staffKey: nameKey(name), staffName: name.slice(0, 120),
   startDate: start.date, endDate: end.date && start.date && end.date >= start.date ? end.date : start.date,
   type: mapping.type ? r.get(mapping.type).slice(0, 80) || null : null,
   portion: mapping.portion ? r.get(mapping.portion).slice(0, 80) || null : null,
   coverage: mapping.coverage ? r.get(mapping.coverage).slice(0, 160) || null : null,
   problem: issues.length ? issues.join('; ').slice(0, 200) : null,
  })
  if (issues.length) problems.push(`Row ${r.row} (${name}): ${issues.join('; ')}`)
 }
 return { rows: out, problems }
}

// Which staff member a sheet name belongs to: exact name, then a saved alias, then first+last match.
export function matchStaff(key, staff, aliases = {}) {
 if (aliases[key]) return staff.find(s => s.id === aliases[key]) || null
 const exact = staff.find(s => nameKey(s.display_name) === key)
 if (exact) return exact
 const parts = key.split(' ')
 if (parts.length >= 2) {
  const [first, last] = [parts[0], parts[parts.length - 1]]
  const loose = staff.filter(s => { const p = nameKey(s.display_name).split(' '); return p[p.length - 1] === last && p[0][0] === first[0] })
  if (loose.length === 1) return loose[0]
 }
 return null
}

const covers = (a, day) => a.startDate && day >= a.startDate && day <= (a.endDate || a.startDate)

function weekStart(day) { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10) }

// What a day off was. "absent" is the default for a missed school day nobody explained.
export const LEAVE_KINDS = {
 absent: { label: 'Absent', cost: 1 },
 sick: { label: 'Sick', cost: 1 },
 personal: { label: 'Personal', cost: 1 },
 half: { label: 'Half day', cost: 0.5 },
 pd: { label: 'PD / school business', cost: 0 },
 excused: { label: 'Excused (doesn’t count)', cost: 0 },
 unpaid: { label: 'Unpaid', cost: 0 },
 present: { label: 'Was here', cost: 0 },
}
export const MARK_KINDS = ['sick', 'personal', 'half', 'pd', 'excused', 'unpaid', 'present']
const COUNTS_AS_ABSENT = new Set(['absent', 'sick', 'personal', 'half', 'unpaid'])
// An absence form row → a leave kind (forms only ever say sick or personal, whole or part day).
function formKind(a) { return /half|custom|partial|hour/i.test(a.portion || '') ? 'half' : /sick|ill|medical/i.test(a.type || '') ? 'sick' : /personal/i.test(a.type || '') ? 'personal' : 'absent' }
function addDays(d, n) { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

// The picture a principal sees: today, and the school year so far, per staff member.
// A "school day" is any day when enough staff clocked in, so no calendar is needed.
// No check-in on a school day = absent, and it uses a paid day — unless a leader marked the day
// (sick, personal, half, PD, excused, unpaid, was here) or the absence form explains it.
// Once someone's paid days run out, more absences become unpaid.
export function staffPicture({ staff, attendance: attRaw, absences: absRaw, marks: marksRaw = [], today, nowTime, settings = {}, aliases = {}, lessonPlans = {} }) {
 const schoolStart = /^\d{2}:\d{2}$/.test(settings.onTime || '') ? settings.onTime : null
 const [ty, tm] = today.split('-').map(Number), yearStart = `${tm >= 7 ? ty : ty - 1}-07-01`
 // Rows may come straight from the database (snake_case) or from the parser (camelCase).
 const attendance = attRaw.map(a => ({ staffKey: a.staff_key ?? a.staffKey, staffName: a.staff_name ?? a.staffName, day: a.day, clockIn: a.clock_in ?? a.clockIn ?? null, clockOut: a.clock_out ?? a.clockOut ?? null, status: a.status || '', lateMinutes: a.late_minutes ?? a.lateMinutes ?? 0, flag: a.flag ?? null, edited: !!a.edited }))
 const absences = absRaw.map(a => ({ staffKey: a.staff_key ?? a.staffKey, staffName: a.staff_name ?? a.staffName, startDate: a.start_date ?? a.startDate, endDate: a.end_date ?? a.endDate, type: a.absence_type ?? a.type ?? null, portion: a.portion ?? null, coverage: a.coverage ?? null, problem: a.problem ?? null }))
 const byStaff = new Map(staff.map(s => [s.id, { att: new Map(), abs: [], marks: new Map() }]))
 for (const m of marksRaw) { const b = byStaff.get(m.staff_id ?? m.staffId); if (b && MARK_KINDS.includes(m.kind)) b.marks.set(m.day, { kind: m.kind, note: m.note || '', needsSub: !!(m.needs_sub ?? m.needsSub) }) }
 const unmatched = new Map()
 for (const a of attendance) { const s = matchStaff(a.staffKey, staff, aliases); if (s) byStaff.get(s.id).att.set(a.day, a); else { const u = unmatched.get(a.staffKey) || { name: a.staffName, days: 0, sources: new Set() }; u.days++; u.sources.add('check-in'); unmatched.set(a.staffKey, u) } }
 for (const a of absences) { const s = matchStaff(a.staffKey, staff, aliases); if (s) byStaff.get(s.id).abs.push(a); else { const u = unmatched.get(a.staffKey) || { name: a.staffName, days: 0, sources: new Set() }; u.sources.add('absence form'); unmatched.set(a.staffKey, u) } }
 const perDay = new Map()
 for (const a of attendance) if (a.day <= today && a.clockIn) perDay.set(a.day, (perDay.get(a.day) || 0) + 1)
 const threshold = Math.max(2, Math.ceil(staff.length * 0.3))
 const schoolDays = [...perDay.entries()].filter(([, n]) => n >= threshold).map(([d]) => d).sort()
 const schoolDaySet = new Set(schoolDays)
 const todayIsSchoolDay = schoolDaySet.has(today)
 const anyoneInToday = (perDay.get(today) || 0) > 0
 const weekend = [0, 6].includes(new Date(`${today}T12:00:00Z`).getUTCDay())
 const thisWeek = weekStart(today), lastWeek = addDays(thisWeek, -7)

 const people = staff.map(s => {
  const { att, abs, marks } = byStaff.get(s.id)
  const start = /^\d{2}:\d{2}$/.test(s.shift_start || '') ? s.shift_start : schoolStart
  const end = /^\d{2}:\d{2}$/.test(s.shift_end || '') ? s.shift_end : /^\d{2}:\d{2}$/.test(settings.dayEnd || '') ? settings.dayEnd : null
  // Counting starts at the school year, or later: the day the school told AskVic to start
  // counting days off, or this person's start date.
  const countFrom = /^\d{4}-\d{2}-\d{2}$/.test(settings.leaveFrom || '') && settings.leaveFrom > yearStart ? settings.leaveFrom : yearStart
  const firstDay = s.start_date && s.start_date > countFrom ? s.start_date : countFrom
  // With a start time set, AskVic decides lateness itself (the sheet's own Late column is ignored).
  // Flexible-hours staff are never late or absent; part-timers are only expected on their work days.
  const flexible = !!s.flexible
  const workDays = Array.isArray(s.work_days) && s.work_days.length ? new Set(s.work_days.map(Number)) : null
  const expected = d => !flexible && d >= firstDay && (!workDays || workDays.has(new Date(`${d}T12:00:00Z`).getUTCDay()))
  const excusedLate = d => ['half', 'present', 'pd', 'excused'].includes(marks.get(d)?.kind)
  const lateBy = a => flexible || excusedLate(a.day) ? 0 : start ? Math.max(0, minutesBetween(start, a.clockIn) ?? 0) : (a.lateMinutes > 0 ? a.lateMinutes : /late/i.test(a.status) ? 1 : 0)
  const earlyBy = a => !flexible && end && a.clockOut && !excusedLate(a.day) ? Math.max(0, minutesBetween(a.clockOut, end) ?? 0) : 0
  // What happened on a day this person didn't check in (or checked in for part of the day).
  const reasonFor = (d, checkedIn) => {
   const m = marks.get(d), form = abs.find(a => covers(a, d))
   if (m) return checkedIn && m.kind !== 'half' ? null : { kind: m.kind, source: 'you', note: m.note, needsSub: m.needsSub }
   if (form) { const k = formKind(form); return checkedIn && k !== 'half' ? null : { kind: k, of: /sick|ill|medical/i.test(form.type || '') ? 'sick' : /personal/i.test(form.type || '') ? 'personal' : '', source: 'form', note: form.coverage || '', type: form.type || '' } }
   return checkedIn ? null : { kind: 'absent', source: 'auto' }
  }
  const t = att.get(today), markToday = marks.get(today), formToday = abs.find(a => covers(a, today))
  let todayState
  if (t?.clockIn) { const m = lateBy(t); todayState = { kind: m > 0 ? 'late' : 'in', time: t.clockIn, minutes: start ? m : (t.lateMinutes || 0) } }
  else if (markToday?.kind === 'present') todayState = { kind: 'in', time: '', marked: true }
  else if (markToday || formToday) { const r = reasonFor(today, false); todayState = { kind: 'absent_form', type: r.source === 'form' && r.type ? r.type : LEAVE_KINDS[r.kind].label, portion: formToday?.portion || '', coverage: formToday?.coverage || '', needsSub: !!markToday?.needsSub, note: markToday?.note || '' } }
  else if (!expected(today) || (weekend && !anyoneInToday)) todayState = { kind: 'off' }
  else if (start && nowTime && nowTime < start) todayState = { kind: 'waiting', due: start }
  else if (todayIsSchoolDay || (start && nowTime && anyoneInToday)) todayState = { kind: 'absent_no_form' }
  else todayState = { kind: 'waiting', due: start || '' }
  const days = [...att.values()].filter(a => a.day <= today && a.day >= yearStart && a.clockIn)
  const allow = k => s[k] == null || s[k] === '' ? null : Number(s[k])
  const pool = allow('sick_days')
  // Every day this year that counts for leave, oldest first, so paid days run out in order.
  // A no-show today counts once the day is done (they may still walk in late); a marked day counts now.
  const countToday = todayState.kind === 'absent_form' || (todayState.kind === 'absent_no_form' && end && nowTime && nowTime >= end) || (t?.clockIn && marks.get(today)?.kind === 'half')
  const leaveDayList = [...new Set([...schoolDays.filter(d => d < today), ...[...marks.keys()].filter(d => d < today && (schoolDaySet.has(d) || att.get(d)?.clockIn)), ...(countToday ? [today] : [])])].filter(d => d >= firstDay && (expected(d) || marks.has(d))).sort()
  // Days off already used before AskVic was counting, typed in by a leader.
  const carried = s.leave_used_before == null || s.leave_used_before === '' ? 0 : Math.max(0, Number(s.leave_used_before) || 0)
  let paidUsed = carried, unpaidDays = 0
  const leaveDays = []
  for (const d of leaveDayList) {
   const checkedIn = !!att.get(d)?.clockIn
   const r = reasonFor(d, checkedIn)
   if (!r) continue
   const cost = LEAVE_KINDS[r.kind].cost
   let paid = cost, unpaid = r.kind === 'unpaid' ? 1 : 0
   if (pool != null && cost) { paid = Math.max(0, Math.min(cost, pool - paidUsed)); unpaid += cost - paid }
   paidUsed += paid; unpaidDays += unpaid
   leaveDays.push({ day: d, kind: r.kind, of: r.of || '', label: LEAVE_KINDS[r.kind].label + (r.of && r.kind === 'half' ? ` (${r.of})` : ''), source: r.source, note: r.note || '', paid, unpaid })
  }
  const absentList = leaveDays.filter(l => COUNTS_AS_ABSENT.has(l.kind))
  const byKind = k => leaveDays.filter(l => l.kind === k || l.of === k).reduce((n, l) => n + l.paid, 0)
  // boardOrder: where this tile sits on the dashboard (null means sort by last name).
  const boardOrder = Number.isInteger(s.board_order) ? s.board_order : null
  const planned = [...marks.entries()].filter(([d, m]) => d > today && m.kind !== 'present').map(([d, m]) => ({ day: d, kind: m.kind, label: LEAVE_KINDS[m.kind].label, note: m.note, needsSub: m.needsSub, source: 'you' }))
   .concat(abs.filter(a => a.startDate && (a.endDate || a.startDate) > today).map(a => ({ day: a.startDate > today ? a.startDate : addDays(today, 1), end: a.endDate || '', kind: formKind(a), label: LEAVE_KINDS[formKind(a)].label, note: a.coverage || '', needsSub: false, source: 'form' })))
   .sort((a, b) => a.day.localeCompare(b.day)).slice(0, 10)
  const lateDays = days.filter(a => lateBy(a) > 0)
  const earlyDays = days.filter(a => a.day < today && !a.flag && earlyBy(a) > 0)
  const hourly = s.pay_type === 'hourly'
  const missingOut = hourly ? days.filter(a => a.day < today && !a.clockOut).map(a => a.day).sort() : []
  const hoursIn = from => days.filter(a => a.day >= from && a.day < (from === lastWeek ? thisWeek : '9999') && a.clockOut && !a.flag).reduce((n, a) => n + Math.max(0, (minutesBetween(a.clockIn, a.clockOut) || 0)) / 60, 0)
  const autoDays = absentList.filter(l => l.source === 'auto').map(l => l.day)
  return {
   id: s.id, flexible, boardOrder, workDays: workDays ? [...workDays].sort() : [], name: s.display_name, role: s.role, payType: hourly ? 'hourly' : 'salaried', hasEmail: !!s.email,
   shiftStart: s.shift_start || '', shiftEnd: s.shift_end || '', sickDays: pool, personalDays: allow('personal_days'),
   today: todayState,
   absences: absentList.length,
   absencesWithForm: absentList.length - autoDays.length,
   noFormDays: autoDays.slice(-10),
   lateCount: lateDays.length, lateMinutes: lateDays.reduce((n, a) => n + (start ? lateBy(a) : a.lateMinutes || 0), 0),
   earlyCount: earlyDays.length,
   missingOut: missingOut.slice(-10),
   // One pool of paid days off (stored in sick_days). Anything past the pool is unpaid.
   leave: { sick: byKind('sick'), personal: byKind('personal'), half: byKind('half'), unexplained: byKind('absent'), carried, paidUsed, paidLeft: pool == null ? null : Math.max(0, pool - paidUsed), unpaid: unpaidDays },
   countFrom: firstDay,
   leaveDays, planned,
   hours: hourly ? { thisWeek: Math.round(hoursIn(thisWeek) * 100) / 100, lastWeek: Math.round(hoursIn(lastWeek) * 100) / 100 } : null,
   flags: days.filter(a => a.flag).map(a => ({ day: a.day, flag: a.flag })).slice(-8),
   lessonPlan: s.role === 'teacher' ? (lessonPlans[s.id] || 'none') : null,
   formProblems: abs.filter(a => a.problem).map(a => a.problem).slice(0, 3),
   // Day-by-day history (newest first) for the one person a leader opened.
   // Today's no-show isn't counted as a day until the day is over, but it still gets a row now,
   // so a leader can say "was here" the moment they notice.
   ...(settings.historyFor === s.id ? { history: [...new Set([...leaveDays.map(l => l.day), ...days.map(a => a.day), ...(todayState.kind === 'absent_no_form' ? [today] : [])])].sort().reverse().slice(0, 80).map(d => {
    const a = att.get(d), l = leaveDays.find(x => x.day === d)
    if (!a?.clockIn && !l && d === today) return { day: d, kind: 'absent', label: 'No check-in yet today', source: 'auto', today: true, note: '', paid: 0, unpaid: 0 }
    if (a?.clockIn) return { day: d, kind: l?.kind === 'half' ? 'half' : lateBy(a) > 0 ? 'late' : 'in', in: a.clockIn, out: a.clockOut || '', late: lateBy(a), marked: marks.get(d)?.kind || '', label: l?.label || (marks.get(d) ? LEAVE_KINDS[marks.get(d).kind].label : ''), paid: l?.paid || 0, unpaid: l?.unpaid || 0, source: l?.source || '' }
    return { day: d, kind: l.kind, label: l.label, source: l.source, note: l.note, paid: l.paid, unpaid: l.unpaid }
   }) } : {}),
  }
 })
 const count = k => people.filter(p => p.today.kind === k).length
 return {
  today, todayIsSchoolDay, schoolDays: schoolDays.filter(d => d >= yearStart).length,
  // The first and last school days AskVic knows about, so Setup can say where the record starts.
  schoolDayList: schoolDays.filter(d => d >= yearStart),
  summary: { in: count('in'), late: count('late'), absentForm: count('absent_form'), absentNoForm: count('absent_no_form'), waiting: count('waiting') },
  people, unmatched: [...unmatched.entries()].map(([key, u]) => ({ key, name: u.name, days: u.days, sources: [...u.sources] })).sort((a, b) => b.days - a.days).slice(0, 50),
  nowTime,
 }
}

// A short, kind first draft. The principal edits it and decides whether to send.
export function reminderDraft(person, schoolName, topic) {
 const raw = String(person.name || ''), first = (raw.includes(',') ? raw.split(',')[1] : raw).trim().split(/\s+/)[0] || 'there'
 const fmt = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
 if (topic === 'days_left') {
  const left = person.leave?.paidLeft, used = person.leave?.paidUsed || 0
  const n = v => `${v} day${v === 1 ? '' : 's'}`
  return { subject: 'Your paid days off this year', body: `Hi ${first},\n\nJust a friendly heads-up so you can plan ahead: you’ve used ${n(used)} of your paid days off this school year${left == null ? '.' : `, and you have ${n(Math.max(0, left))} left`}.${left != null && left <= 2 ? ' After those are used, any more days off would be unpaid.' : ''}\n\nIf anything looks off, stop by the office and we’ll check it together.\n\nThanks for all you do!` }
 }
 if (topic === 'missing_out') return { subject: 'Quick reminder: clocking out', body: `Hi ${first},\n\nQuick reminder to clock out at the end of the day. The check-in computer doesn’t show a clock-out for ${person.missingOut.slice(-3).map(fmt).join(', ')}. Since your hours go to payroll, could you stop by the office so we can fix those days?\n\nThanks!` }
 const days = person.noFormDays.slice(-3)
 return { subject: 'Absence form needed', body: `Hi ${first},\n\nI hope you’re feeling okay. I don’t have an absence form for ${days.length ? days.map(fmt).join(', ') : 'your recent absence'}. When you get a minute, please fill out the staff absence form so your days are recorded correctly.\n\nThank you!` }
}
