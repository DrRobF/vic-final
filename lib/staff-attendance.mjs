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
export function nameKey(value) {
 return String(value || '').replace(/\([^)]*\)/g, ' ').toLowerCase().replace(/[^a-z' -]/g, ' ').replace(/\s+/g, ' ').trim()
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

export function parseAttendance(values, mapping) {
 const out = [], problems = []
 for (const r of rowsAsObjects(values)) {
  const name = r.get(mapping.name)
  if (!name) continue
  const inRaw = r.get(mapping.clockIn), dateRaw = mapping.date ? r.get(mapping.date) : inRaw
  const parsed = parseDateTime(dateRaw || inRaw)
  if (!parsed.date) { if (parsed.problem) problems.push(`Row ${r.row}: ${parsed.problem}`); continue }
  out.push({
   staffKey: nameKey(name), staffName: name.slice(0, 120), day: parsed.date,
   clockIn: parseTimeOnly(inRaw), clockOut: mapping.clockOut ? parseTimeOnly(r.get(mapping.clockOut)) : null,
   status: mapping.status ? r.get(mapping.status).slice(0, 60) || null : null,
   lateMinutes: mapping.lateMinutes ? int(r.get(mapping.lateMinutes)) : null,
   earlyMinutes: mapping.earlyMinutes ? int(r.get(mapping.earlyMinutes)) : null,
  })
 }
 // One row per person per day: keep the earliest clock-in.
 const byKey = new Map()
 for (const a of out) { const k = `${a.staffKey}|${a.day}`; const prev = byKey.get(k); if (!prev || (a.clockIn && (!prev.clockIn || a.clockIn < prev.clockIn))) byKey.set(k, { ...prev, ...a, clockOut: a.clockOut || prev?.clockOut || null }) }
 return { rows: [...byKey.values()], problems }
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

// The picture a principal sees: today, and the school year so far, per staff member.
// A "school day" is any day when enough staff clocked in, so no calendar is needed.
export function staffPicture({ staff, attendance: attRaw, absences: absRaw, today, nowTime, settings = {}, aliases = {} }) {
 const onTime = /^\d{2}:\d{2}$/.test(settings.onTime || '') ? settings.onTime : null
 // Rows may come straight from the database (snake_case) or from the parser (camelCase).
 const attendance = attRaw.map(a => ({ staffKey: a.staff_key ?? a.staffKey, staffName: a.staff_name ?? a.staffName, day: a.day, clockIn: a.clock_in ?? a.clockIn ?? null, clockOut: a.clock_out ?? a.clockOut ?? null, status: a.status || '', lateMinutes: a.late_minutes ?? a.lateMinutes ?? 0 }))
 const absences = absRaw.map(a => ({ staffKey: a.staff_key ?? a.staffKey, staffName: a.staff_name ?? a.staffName, startDate: a.start_date ?? a.startDate, endDate: a.end_date ?? a.endDate, type: a.absence_type ?? a.type ?? null, portion: a.portion ?? null, coverage: a.coverage ?? null, problem: a.problem ?? null }))
 const byStaff = new Map(staff.map(s => [s.id, { att: new Map(), abs: [] }]))
 const unmatched = new Map()
 for (const a of attendance) { const s = matchStaff(a.staffKey, staff, aliases); if (s) byStaff.get(s.id).att.set(a.day, a); else unmatched.set(a.staffKey, a.staffName) }
 for (const a of absences) { const s = matchStaff(a.staffKey, staff, aliases); if (s) byStaff.get(s.id).abs.push(a); else unmatched.set(a.staffKey, a.staffName) }
 const perDay = new Map()
 for (const a of attendance) if (a.day <= today && a.clockIn) perDay.set(a.day, (perDay.get(a.day) || 0) + 1)
 const threshold = Math.max(2, Math.ceil(staff.length * 0.3))
 const schoolDays = [...perDay.entries()].filter(([, n]) => n >= threshold).map(([d]) => d).sort()
 const todayIsSchoolDay = schoolDays.includes(today)
 const late = a => a.lateMinutes > 0 || /late/i.test(a.status) || (!!onTime && !!a.clockIn && a.clockIn > onTime)

 const people = staff.map(s => {
  const { att, abs } = byStaff.get(s.id)
  const t = att.get(today), formToday = abs.find(a => covers(a, today))
  let todayState
  if (t?.clockIn) todayState = { kind: late(t) ? 'late' : 'in', time: t.clockIn, minutes: t.lateMinutes || 0 }
  else if (formToday) todayState = { kind: 'absent_form', type: formToday.type, portion: formToday.portion, coverage: formToday.coverage }
  else if (todayIsSchoolDay) todayState = { kind: 'absent_no_form' }
  else todayState = { kind: 'waiting' }
  const missedDays = schoolDays.filter(d => d !== today && !att.get(d)?.clockIn)
  const withForm = missedDays.filter(d => abs.some(a => covers(a, d)))
  const noForm = missedDays.filter(d => !abs.some(a => covers(a, d)))
  const lateDays = [...att.values()].filter(a => a.day <= today && a.clockIn && late(a))
  const missingOut = s.pay_type === 'hourly' ? [...att.values()].filter(a => a.day < today && a.clockIn && !a.clockOut).map(a => a.day).sort() : []
  const absentToday = todayIsSchoolDay && ['absent_form', 'absent_no_form'].includes(todayState.kind)
  return {
   id: s.id, name: s.display_name, role: s.role, payType: s.pay_type || 'salaried', hasEmail: !!s.email,
   today: todayState,
   absences: missedDays.length + (absentToday ? 1 : 0),
   absencesWithForm: withForm.length + (absentToday && todayState.kind === 'absent_form' ? 1 : 0),
   noFormDays: [...noForm, ...(todayState.kind === 'absent_no_form' ? [today] : [])].slice(-10),
   lateCount: lateDays.length, lateMinutes: lateDays.reduce((n, a) => n + (a.lateMinutes || 0), 0),
   missingOut: missingOut.slice(-10),
   formProblems: abs.filter(a => a.problem).map(a => a.problem).slice(0, 3),
  }
 })
 const count = k => people.filter(p => p.today.kind === k).length
 return {
  today, todayIsSchoolDay, schoolDays: schoolDays.length,
  summary: { in: count('in'), late: count('late'), absentForm: count('absent_form'), absentNoForm: count('absent_no_form'), waiting: count('waiting') },
  people, unmatched: [...unmatched.entries()].map(([key, name]) => ({ key, name })).slice(0, 50),
  nowTime,
 }
}

// A short, kind first draft. The principal edits it and decides whether to send.
export function reminderDraft(person, schoolName, topic) {
 const first = String(person.name || '').split(' ')[0] || 'there'
 const fmt = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
 if (topic === 'missing_out') return { subject: 'Quick reminder: clocking out', body: `Hi ${first},\n\nQuick reminder to clock out at the end of the day. The check-in computer doesn’t show a clock-out for ${person.missingOut.slice(-3).map(fmt).join(', ')}. Since your hours go to payroll, could you stop by the office so we can fix those days?\n\nThanks!` }
 const days = person.noFormDays.slice(-3)
 return { subject: 'Absence form needed', body: `Hi ${first},\n\nI hope you’re feeling okay. I don’t have an absence form for ${days.length ? days.map(fmt).join(', ') : 'your recent absence'}. When you get a minute, please fill out the staff absence form so your days are recorded correctly.\n\nThank you!` }
}
