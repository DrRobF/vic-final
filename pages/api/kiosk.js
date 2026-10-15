import { createClient } from '@supabase/supabase-js'
import { schoolClock } from '../../lib/assistant-principal-rules.mjs'
import { codeHash, tokenHash, validCode, clockAction, afterMiss, isLocked, fmt12, newToken, normalizeSetupCode } from '../../lib/kiosk.mjs'
import { nameKey, matchStaff } from '../../lib/staff-attendance.mjs'

// "Green, Karen" → "Karen"; "Karen Green" → "Karen"
const firstName = n => { const s = String(n || ''); return (s.includes(',') ? s.split(',')[1] : s).trim().split(/\s+/)[0] || 'there' }

// The office check-in screen. It works only on a computer a school leader has unlocked (it holds a kiosk token).
const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
export const codeSecret = () => process.env.KIOSK_CODE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

async function kioskFor(db, token) {
 if (typeof token !== 'string' || token.length < 30 || token.length > 100) return null
 const { data } = await db.from('ap_kiosks').select('id,school_id,revoked,claimed_at,fail_count,fail_window_start,locked_until').eq('token_hash', tokenHash(token)).maybeSingle()
 return data && !data.revoked && data.claimed_at ? data : null
}

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const db = admin()
  // Turning on a kiosk with a one-time setup code (made by a leader on the Staff attendance page).
  if (req.method === 'POST' && req.body?.action === 'claim') {
   const code = normalizeSetupCode(req.body.setupCode)
   if (code.length !== 8) return res.status(400).json({ error: 'Type the 8-character setup code.' })
   const { data: invite } = await db.from('ap_kiosks').select('id,revoked,claimed_at,setup_expires_at').eq('setup_code_hash', tokenHash(`setup:${code}`)).maybeSingle()
   if (!invite || invite.revoked || invite.claimed_at || !invite.setup_expires_at || Date.parse(invite.setup_expires_at) < Date.now()) return res.status(400).json({ error: 'That setup code isn’t valid or has expired. Ask for a new one.' })
   const token = newToken()
   const { error } = await db.from('ap_kiosks').update({ token_hash: tokenHash(token), claimed_at: new Date().toISOString(), setup_code_hash: null, setup_expires_at: null }).eq('id', invite.id).is('claimed_at', null)
   if (error) throw error
   return res.json({ token })
  }
  const token = req.method === 'GET' ? req.headers['x-kiosk-token'] : req.body?.token
  const kiosk = await kioskFor(db, token)
  if (!kiosk) return res.status(401).json({ error: 'This computer isn’t set up as a check-in kiosk.', notKiosk: true })
  const { data: school } = await db.from('ap_schools').select('name,time_zone,day_start,day_end').eq('id', kiosk.school_id).maybeSingle()
  // A check-in saved while the internet was down carries the time it was typed (accepted up to 2 hours late).
  const queued = req.method === 'POST' && typeof req.body?.queuedAt === 'string' ? Date.parse(req.body.queuedAt) : NaN
  const when = Number.isFinite(queued) && Date.now() - queued >= 0 && Date.now() - queued < 2 * 3600 * 1000 ? new Date(queued) : new Date()
  const clock = schoolClock(when, school?.time_zone || 'America/New_York')
  await db.from('ap_kiosks').update({ last_seen_at: new Date().toISOString() }).eq('id', kiosk.id)

  if (req.method === 'GET') {
   const { data: ann } = await db.from('ap_announcements').select('morning,afternoon,updated_at').eq('school_id', kiosk.school_id).eq('day', clock.date).maybeSingle()
   return res.json({ school: school?.name || 'Our school', start: school?.day_start || '', end: school?.day_end || '', morning: ann?.morning || '', afternoon: ann?.afternoon || '', updatedAt: ann?.updated_at || null })
  }

  if (isLocked(kiosk)) return res.status(429).json({ error: 'Too many wrong codes. Please wait one minute and try again.' })
  const code = String(req.body?.code || '')
  const miss = async msg => { await db.from('ap_kiosks').update(afterMiss(kiosk)).eq('id', kiosk.id); return res.status(400).json({ error: msg }) }
  if (!validCode(code)) return miss('Enter your staff code.')
  const { data: person } = await db.from('ap_staff').select('id,display_name').eq('school_id', kiosk.school_id).eq('active', true).eq('code_hash', codeHash(codeSecret(), kiosk.school_id, code)).maybeSingle()
  if (!person) return miss('That code isn’t active. Check the number or see the main office.')
  if (kiosk.fail_count) await db.from('ap_kiosks').update({ fail_count: 0, fail_window_start: null, locked_until: null }).eq('id', kiosk.id)

  let { data: punch } = await db.from('ap_punches').select('id,clock_in,clock_out').eq('school_id', kiosk.school_id).eq('staff_id', person.id).eq('day', clock.date).maybeSingle()
  // Switching kiosks mid-day: if they already clocked in today on the school's old check-in sheet, carry that in.
  if (!punch) {
   const [{ data: sheetToday }, { data: links }, { data: staff }] = await Promise.all([
    db.from('ap_attendance').select('staff_key,clock_in,clock_out').eq('school_id', kiosk.school_id).eq('day', clock.date),
    db.from('ap_sheet_links').select('aliases').eq('school_id', kiosk.school_id),
    db.from('ap_staff').select('id,display_name').eq('school_id', kiosk.school_id).eq('active', true),
   ])
   const aliases = Object.assign({}, ...(links || []).map(l => l.aliases || {}))
   const mine = (sheetToday || []).find(r => r.clock_in && matchStaff(r.staff_key, staff || [], aliases)?.id === person.id)
   if (mine) {
    const { data: carried } = await db.from('ap_punches').insert({ school_id: kiosk.school_id, staff_id: person.id, day: clock.date, clock_in: mine.clock_in, clock_out: mine.clock_out || null, source: 'import' }).select('id,clock_in,clock_out').single()
    punch = carried
   }
  }
  const action = clockAction(punch)
  const first = firstName(person.display_name)
  if (action === 'done') return res.status(409).json({ error: `${first}, you’re already clocked in and out today. See the main office for a correction.` })
  if (action === 'in') {
   const { error } = await db.from('ap_punches').insert({ school_id: kiosk.school_id, staff_id: person.id, day: clock.date, clock_in: clock.time, source: 'kiosk' })
   if (error) throw error
   return res.json({ ok: true, action: 'in', message: `Good morning, ${first}! Clocked in at ${fmt12(clock.time)}.` })
  }
  const { error } = await db.from('ap_punches').update({ clock_out: clock.time }).eq('id', punch.id).is('clock_out', null)
  if (error) throw error
  return res.json({ ok: true, action: 'out', message: `Thanks, ${first}! Clocked out at ${fmt12(clock.time)}.` })
 } catch (e) {
  console.error('Kiosk failed', { message: e?.message })
  return res.status(500).json({ error: 'Attendance could not be recorded. Please try again or tell the main office.' })
 }
}
