import { requireApprovedProfile } from '../../../lib/server-auth'
export const config = { api: { bodyParser: { sizeLimit: '16kb' } } }

// A teacher's own day-off requests: ask in advance, see where it stands, cancel one that hasn't been answered.
// Nothing here changes attendance; a school leader approves or declines in AskVic.
const KINDS = ['sick', 'personal', 'half', 'pd', 'unpaid']
const isDay = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : ''

export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 try {
  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  const db = auth.admin
  const { data: staff, error: staffError } = await db.from('ap_staff').select('id,school_id,ap_schools(name)').eq('auth_user_id', auth.user.id).eq('active', true).limit(1)
  if (staffError) throw staffError
  const me = staff?.[0]
  if (!me) return res.json({ linked: false, requests: [] })

  if (req.method === 'POST') {
   const body = req.body || {}
   if (body.action === 'cancel') {
    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Choose a request.' })
    const { error } = await db.from('ap_day_requests').update({ status: 'cancelled' }).eq('id', id).eq('staff_id', me.id).eq('status', 'pending')
    if (error) throw error
    return res.json({ cancelled: true })
   }
   const today = new Date().toISOString().slice(0, 10)
   if (!isDay(body.day)) return res.status(400).json({ error: 'Choose the day you’ll be out.' })
   if (body.day < today) return res.status(400).json({ error: 'Pick a day that hasn’t happened yet. For a day that’s already passed, talk to the office.' })
   if (body.endDay && (!isDay(body.endDay) || body.endDay < body.day)) return res.status(400).json({ error: 'The last day has to come after the first day.' })
   if (!KINDS.includes(body.kind)) return res.status(400).json({ error: 'Choose what kind of day off this is.' })
   const { error } = await db.from('ap_day_requests').insert({ school_id: me.school_id, staff_id: me.id, day: body.day, end_day: body.endDay || null, kind: body.kind, note: clean(body.note, 300), needs_sub: body.needsSub === true })
   if (error) throw error
   return res.json({ sent: true })
  }

  const { data, error } = await db.from('ap_day_requests').select('id,day,end_day,kind,note,needs_sub,status,decline_note,created_at').eq('staff_id', me.id).order('day', { ascending: false }).limit(20)
  if (error) throw error
  return res.json({ linked: true, school: me.ap_schools?.name || 'your school', requests: (data || []).map(r => ({ id: r.id, day: r.day, endDay: r.end_day || '', kind: r.kind, note: r.note || '', needsSub: !!r.needs_sub, status: r.status, declineNote: r.decline_note || '' })) })
 } catch (e) {
  console.error('Day-off request failed', { message: e?.message })
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
 }
}
