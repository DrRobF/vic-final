import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import { schoolClock } from '../../../lib/assistant-principal-rules.mjs'
import { serviceEmail, spreadsheetId, sheetInfo, tabValues } from '../../../lib/google-sheets'
import { defaultWeekOf } from '../../../lib/lesson-week.mjs'
import { SECRET_HEADER, guessMapping, validateMapping, parseAttendance, parseAbsences, staffPicture, reminderDraft, nameKey } from '../../../lib/staff-attendance.mjs'

export const config = { maxDuration: 45 }
const KINDS = ['attendance', 'absences']
const STALE_MS = 20 * 60 * 1000
const uuid = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : ''

async function q(query) { const { data, error } = await query; if (error) throw error; return data || [] }

// Start of the school year: July 1 before today.
function yearStart(today) { const [y, m] = today.split('-').map(Number); return `${m >= 7 ? y : y - 1}-07-01` }

function pickTab(kind, tabs) {
 const re = kind === 'attendance' ? /attendance|log|check/i : /form\s*responses|absence|responses/i
 return tabs.find(t => re.test(t)) || tabs[0] || ''
}

async function syncLink(db, link) {
 try {
  const values = await tabValues(link.spreadsheet_id, link.tab)
  if (!values.length) throw new Error(`The “${link.tab}” tab looks empty.`)
  const parsed = link.kind === 'attendance' ? parseAttendance(values, link.mapping) : parseAbsences(values, link.mapping)
  const table = link.kind === 'attendance' ? 'ap_attendance' : 'ap_absence_reports'
  const rows = link.kind === 'attendance'
   ? parsed.rows.map(r => ({ school_id: link.school_id, staff_key: r.staffKey, staff_name: r.staffName, day: r.day, clock_in: r.clockIn, clock_out: r.clockOut, status: r.status, late_minutes: r.lateMinutes, early_minutes: r.earlyMinutes, flag: r.flag }))
   : parsed.rows.map(r => ({ school_id: link.school_id, staff_key: r.staffKey, staff_name: r.staffName, start_date: r.startDate, end_date: r.endDate, absence_type: r.type, portion: r.portion, coverage: r.coverage, problem: r.problem }))
  // The sheet is the source of truth: replace this school's copy only after a successful read.
  await q(db.from(table).delete().eq('school_id', link.school_id))
  for (let i = 0; i < rows.length; i += 500) await q(db.from(table).insert(rows.slice(i, i + 500)))
  await q(db.from('ap_sheet_links').update({ last_synced_at: new Date().toISOString(), last_error: null, settings: { ...(link.settings || {}), rows: rows.length, problems: parsed.problems.slice(0, 8) } }).eq('id', link.id))
 } catch (e) {
  await db.from('ap_sheet_links').update({ last_error: String(e.message || 'Could not read the sheet.').slice(0, 300) }).eq('id', link.id)
 }
}

async function picture(db, schoolId, links, timeZone) {
 const clock = schoolClock(new Date(), timeZone || 'America/New_York'), from = yearStart(clock.date)
 const [staff, attendance, absences] = await Promise.all([
  q(db.from('ap_staff').select('id,display_name,role,email,pay_type,shift_start,shift_end,sick_days,personal_days').eq('school_id', schoolId).eq('active', true).order('display_name').limit(500)),
  links.some(l => l.kind === 'attendance') ? q(db.from('ap_attendance').select('staff_key,staff_name,day,clock_in,clock_out,status,late_minutes,flag').eq('school_id', schoolId).gte('day', from).limit(20000)) : [],
  links.some(l => l.kind === 'absences') ? q(db.from('ap_absence_reports').select('staff_key,staff_name,start_date,end_date,absence_type,portion,coverage,problem').eq('school_id', schoolId).limit(5000)) : [],
 ])
 // Lesson plans for the week teachers are planning now (same week the School dashboard shows).
 const weekOf = defaultWeekOf()
 const plans = await q(db.from('lesson_weeks').select('staff_id,status').eq('school_id', schoolId).eq('week_of', weekOf).in('status', ['submitted', 'reviewed']))
 const lessonPlans = {}
 for (const w of plans) if (w.staff_id) lessonPlans[w.staff_id] = lessonPlans[w.staff_id] === 'reviewed' ? 'reviewed' : w.status
 const aliases = Object.assign({}, ...links.map(l => l.aliases || {}))
 const settings = links.find(l => l.kind === 'attendance')?.settings || {}
 return { staff, pic: { ...staffPicture({ staff, attendance, absences, today: clock.date, nowTime: clock.time, settings, aliases, lessonPlans }), weekOf } }
}

const publicLink = l => ({ kind: l.kind, spreadsheetId: l.spreadsheet_id, tab: l.tab, mapping: l.mapping, onTime: l.settings?.onTime || '', rows: l.settings?.rows ?? null, problems: l.settings?.problems || [], lastSyncedAt: l.last_synced_at, lastError: l.last_error })

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const auth = await requirePrincipal(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const db = auth.admin, body = req.body || {}
  const schoolId = req.method === 'GET' ? req.query.schoolId : body.schoolId
  if (!schoolId) {
   const rows = await q(db.from('ap_memberships').select('school_id,ap_schools(name)').eq('auth_user_id', auth.user.id))
   return res.json({ schools: rows.map(m => ({ id: m.school_id, name: m.ap_schools?.name || 'My school' })), serviceEmail: serviceEmail() })
  }
  const school = await requireSchool(auth, schoolId)
  if (school.error) return res.status(school.status).json({ error: school.error })
  const [schoolRow] = await q(db.from('ap_schools').select('name,time_zone').eq('id', schoolId).limit(1))
  let links = await q(db.from('ap_sheet_links').select('*').eq('school_id', schoolId))

  if (req.method === 'GET') {
   const stale = links.filter(l => req.query.refresh === '1' || !l.last_synced_at || Date.now() - Date.parse(l.last_synced_at) > STALE_MS)
   if (stale.length) { await Promise.all(stale.map(l => syncLink(db, l))); links = await q(db.from('ap_sheet_links').select('*').eq('school_id', schoolId)) }
   const { pic } = await picture(db, schoolId, links, schoolRow?.time_zone)
   return res.json({ school: { id: schoolId, name: schoolRow?.name || '' }, serviceEmail: serviceEmail(), links: links.map(publicLink), ...pic })
  }

  const action = body.action
  if (action === 'inspect') {
   const kind = KINDS.includes(body.kind) ? body.kind : null, id = spreadsheetId(body.url)
   if (!kind) return res.status(400).json({ error: 'Choose which sheet this is.' })
   if (!id) return res.status(400).json({ error: 'Paste the link from your browser’s address bar while the sheet is open.' })
   const info = await sheetInfo(id)
   const tab = info.tabs.includes(body.tab) ? body.tab : pickTab(kind, info.tabs)
   const values = await tabValues(id, tab)
   const headers = (values[0] || []).map(h => String(h || '').trim())
   const visible = headers.map((h, i) => ({ h, i })).filter(x => x.h && !SECRET_HEADER.test(x.h))
   const sample = values.slice(1).filter(r => r.some(c => String(c || '').trim())).slice(0, 3).map(r => visible.map(x => String(r[x.i] ?? '').slice(0, 40)))
   return res.json({ title: info.title, tabs: info.tabs, tab, headers: visible.map(x => x.h), hidden: headers.filter(h => h && SECRET_HEADER.test(h)), sample, mapping: guessMapping(kind, headers) })
  }
  if (action === 'save_link') {
   const kind = KINDS.includes(body.kind) ? body.kind : null, id = spreadsheetId(body.url)
   if (!kind || !id) return res.status(400).json({ error: 'Choose the sheet and paste its link.' })
   const values = await tabValues(id, clean(body.tab, 200))
   let mapping; try { mapping = validateMapping(kind, body.mapping, values[0] || []) } catch (e) { return res.status(400).json({ error: e.message }) }
   const onTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.onTime || '') ? body.onTime : ''
   const existing = links.find(l => l.kind === kind)
   const row = { school_id: schoolId, kind, spreadsheet_id: id, tab: clean(body.tab, 200), mapping, settings: { ...(existing?.settings || {}), onTime }, created_by: auth.user.id, last_synced_at: null, last_error: null }
   const [saved] = await q(db.from('ap_sheet_links').upsert(row, { onConflict: 'school_id,kind' }).select('*'))
   await syncLink(db, saved)
   return res.json({ saved: true })
  }
  if (action === 'remove_link') {
   const kind = KINDS.includes(body.kind) ? body.kind : null
   if (!kind) return res.status(400).json({ error: 'Choose which sheet to disconnect.' })
   await q(db.from('ap_sheet_links').delete().eq('school_id', schoolId).eq('kind', kind))
   await q(db.from(kind === 'attendance' ? 'ap_attendance' : 'ap_absence_reports').delete().eq('school_id', schoolId))
   return res.json({ removed: true })
  }
  if (action === 'set_on_time') {
   const link = links.find(l => l.kind === 'attendance')
   if (!link) return res.status(400).json({ error: 'Connect the check-in sheet first.' })
   const onTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(body.onTime || '') ? body.onTime : ''
   await q(db.from('ap_sheet_links').update({ settings: { ...(link.settings || {}), onTime } }).eq('id', link.id))
   return res.json({ saved: true })
  }
  if (action === 'set_pay') {
   if (!uuid(body.staffId) || !['salaried', 'hourly'].includes(body.payType)) return res.status(400).json({ error: 'Choose salaried or hourly.' })
   await q(db.from('ap_staff').update({ pay_type: body.payType }).eq('school_id', schoolId).eq('id', body.staffId))
   return res.json({ saved: true })
  }
  if (action === 'update_staff') {
   if (!uuid(body.staffId)) return res.status(400).json({ error: 'Choose a staff member.' })
   const time = v => v === '' || v == null ? null : /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined
   const days = v => v === '' || v == null ? null : Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) <= 365 ? Number(v) : undefined
   const patch = { shift_start: time(body.shiftStart), shift_end: time(body.shiftEnd), sick_days: days(body.sickDays), personal_days: days(body.personalDays) }
   if (Object.values(patch).some(v => v === undefined)) return res.status(400).json({ error: 'Use times like 7:30 AM and a number of days.' })
   if (['salaried', 'hourly'].includes(body.payType)) patch.pay_type = body.payType
   await q(db.from('ap_staff').update(patch).eq('school_id', schoolId).eq('id', body.staffId))
   return res.json({ saved: true })
  }
  if (action === 'add_staff') {
   const name = clean(body.name, 120).replace(/\s+/g, ' ')
   const role = ['teacher', 'support', 'office', 'leader', 'other'].includes(body.role) ? body.role : 'teacher'
   if (name.length < 2) return res.status(400).json({ error: 'Enter the person’s name.' })
   const [{ count }, [seat]] = await Promise.all([db.from('ap_staff').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('active', true), q(db.from('ap_schools').select('seat_limit').eq('id', schoolId).limit(1))])
   if ((seat?.seat_limit ?? 50) - (count || 0) < 1) return res.status(409).json({ error: 'Your school has used all of its seats. Remove someone from the staff list or ask about a larger plan.' })
   const [added] = await q(db.from('ap_staff').insert({ school_id: schoolId, display_name: name, role, active: true, pay_type: body.payType === 'hourly' ? 'hourly' : 'salaried' }).select('id'))
   const key = nameKey(body.key || name)
   if (key && key !== nameKey(name)) for (const l of links) await q(db.from('ap_sheet_links').update({ aliases: { ...(l.aliases || {}), [key]: added.id } }).eq('id', l.id))
   return res.json({ added: true })
  }
  if (action === 'alias') {
   const key = nameKey(body.key)
   if (!key || !links.length) return res.status(400).json({ error: 'Choose a name to match.' })
   if (body.staffId && !uuid(body.staffId)) return res.status(400).json({ error: 'Choose a staff member.' })
   for (const l of links) {
    const aliases = { ...(l.aliases || {}) }
    if (body.staffId) aliases[key] = body.staffId; else delete aliases[key]
    await q(db.from('ap_sheet_links').update({ aliases }).eq('id', l.id))
   }
   return res.json({ saved: true })
  }
  if (action === 'draft' || action === 'send') {
   const { staff, pic } = await picture(db, schoolId, links, schoolRow?.time_zone)
   const person = pic.people.find(p => p.id === body.staffId), member = staff.find(s => s.id === body.staffId)
   if (!person) return res.status(404).json({ error: 'That staff member isn’t on your list.' })
   if (action === 'draft') return res.json({ draft: reminderDraft(person, schoolRow?.name, body.topic === 'missing_out' ? 'missing_out' : 'no_form'), to: member.email || '' })
   const subject = clean(body.subject, 200), text = clean(body.body, 4000)
   if (!subject || text.length < 10) return res.status(400).json({ error: 'Add a subject and a message.' })
   if (!member.email) return res.status(400).json({ error: `Add an email for ${member.display_name} on Staff & deadlines first.` })
   if (!process.env.RESEND_API_KEY || !process.env.REPORTS_FROM_EMAIL) return res.status(503).json({ error: 'Email sending isn’t set up on this server yet.' })
   const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000), body: JSON.stringify({ from: process.env.REPORTS_FROM_EMAIL, to: member.email, ...(auth.user.email ? { reply_to: auth.user.email } : {}), subject, text }) })
   if (!r.ok) return res.status(502).json({ error: 'The email didn’t go through. Please try again.' })
   await q(db.from('ap_reminders').insert({ school_id: schoolId, staff_id: member.id, subject, body: text, sent_to: member.email, sent_by: auth.user.id }))
   return res.json({ sent: true, to: member.email })
  }
  return res.status(400).json({ error: 'Unknown action.' })
 } catch (e) {
  if (e?.setup || e?.notShared || e?.userFacing) return res.status(400).json({ error: e.message })
  console.error('School attendance failed', { message: e?.message, code: e?.code })
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
 }
}
