import { serviceDb } from '../../../lib/service-db'
import { createHash } from 'node:crypto'
import { schoolToday } from '../../../lib/release.mjs'
import { plannedToday, launchLesson } from '../../../lib/lesson-launch.mjs'
import { tidyCoverCode, COVER_CODE, grantUsable, COVER_REFUSALS } from '../../../lib/cover.mjs'
export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 30 }

// The screen for whoever is covering a class today. No account: the printed code is the
// credential, sent with every request, good only for its own day and its own classes.
//
// Everything this endpoint can do is in this file, and it is two things: show what the
// class's own teacher planned for today, and put it on the students' screens. It never
// returns the teacher's plan, only its title and objective -- enough to know what you are
// starting and to tell the children, and no more.
//
// POST {code}                      -> whose cover this is, and today's lessons
// POST {code, action:'launch', ...} -> send one of those lessons to its class
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const code = tidyCoverCode(req.body?.code)
 if (!COVER_CODE.test(code)) return res.status(400).json({ error: 'Type the 8-character code from your slip.' })
 const db = serviceDb()
 if (!db) return res.status(503).json({ error: 'Cover is not available right now.' })
 try {
  const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  const { data: allowed, error: rateError } = await db.rpc('claim_cover_attempt', { ip_bucket: createHash('sha256').update(ip).digest('hex') })
  if (rateError) return res.status(503).json({ error: 'Cover is not available right now.' })
  if (!allowed) { res.setHeader('Retry-After', '600'); return res.status(429).json({ error: 'Too many tries. Wait a few minutes, then check the code with the office.' }) }

  const { data: grant } = await db.from('cover_grants').select('id,school_id,day,class_ids,covering_name,note,revoked_at').eq('code', code).maybeSingle()
  const today = schoolToday()
  const usable = grantUsable(grant, today)
  // One wording for "no such code" and "revoked", so this cannot be used to hunt for live codes.
  if (!usable.ok) return res.status(usable.reason === 'notfound' ? 404 : 403).json({ error: COVER_REFUSALS[usable.reason] })

  const granted = (grant.class_ids || []).map(Number)
  if (req.body?.action === 'launch') {
   const classId = Number(req.body?.classId), lessonId = String(req.body?.lessonId || '')
   // The grant decides what may be touched: a class outside it is refused even with a good code.
   if (!granted.includes(classId)) return res.status(403).json({ error: 'That class is not on your cover slip.' })
   const options = await plannedToday(db, granted, today)
   const pick = options.find(o => o.lessonId === lessonId && Number(o.classId) === classId)
   if (!pick) return res.status(400).json({ error: 'That lesson is not planned for this class today.' })
   if (pick.ready === false) return res.status(400).json({ error: 'This lesson is not finished enough for VIC to teach. The children can still use VIC for their own practice.' })
   const done = await launchLesson(db, { classId, lessonId })
   return res.json(done)
  }

  await db.from('cover_grants').update({ last_opened_at: new Date().toISOString() }).eq('id', grant.id)
  const { data: classes } = await db.from('classes').select('id,class_name,grade_level,users:teacher_id(name)').in('id', granted.length ? granted : [0])
  const planned = await plannedToday(db, granted, today)
  const { data: school } = await db.from('ap_schools').select('name').eq('id', grant.school_id).maybeSingle()
  return res.json({
   school: school?.name || '',
   coveringName: grant.covering_name,
   day: grant.day,
   note: grant.note || '',
   classes: (classes || []).map(c => {
    const mine = planned.filter(p => Number(p.classId) === Number(c.id))
    return {
     id: c.id, name: c.class_name, grade: c.grade_level ?? null, teacher: c.users?.name || '',
     lessons: mine.map(p => ({ lessonId: p.lessonId, title: p.title, objective: p.objective, ready: p.ready, live: p.live })),
    }
   }).sort((a, b) => a.name.localeCompare(b.name)),
  })
 } catch (error) {
  console.error('[cover] failed', { message: error?.message })
  return res.status(error?.code === 400 ? 400 : 503).json({ error: error?.code === 400 ? error.message : 'Something went wrong. Try again.' })
 }
}
