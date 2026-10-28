import { serviceDb } from '../../../lib/service-db'
import { createHash } from 'node:crypto'
import { schoolToday } from '../../../lib/release.mjs'
import { plannedToday, launchLesson } from '../../../lib/lesson-launch.mjs'
import { tidyCoverCode, COVER_CODE, grantUsable, COVER_REFUSALS } from '../../../lib/cover.mjs'
import { roomStudents, randomPictures, shortName, LOCK_MINUTES } from '../../../lib/vic-room.mjs'
import { practiceForRoom, VIC_CLASS } from '../../../lib/vic-practice.mjs'
import general from '../../../data/lesson-standards.json'
import access from '../../../data/access-points.json'
export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 30 }

// The screen for whoever is covering a class today. No account: the printed code is the
// credential, sent with every request, good only for its own day and its own classes.
//
// Everything this endpoint can do is in this file, and it is two things: show what the
// class's own teacher planned for today, and put it on the students' screens. It never
// returns the teacher's plan, only its title and objective -- enough to know what you are
// starting and to tell the children, and no more.
//
// POST {code}                              -> whose cover this is, today's lessons, who is in the room
// POST {code, action:'launch', ...}         -> send one of those lessons to its class
// POST {code, action:'practice', subject}   -> start every child on their own next skill
// POST {code, action:'resetPictures', ...}  -> new login pictures for ONE child who cannot get in
//
// The three actions beyond 'launch' exist because the adult holding this code is alone with a
// room of children and cannot ring the office every few minutes. A planned lesson that finishes
// early, or a day nobody planned, used to leave them with nothing to press; a child who cannot
// log in used to need somebody with VIC Room. Each action still reaches no further than the
// classes on the slip.
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

  // Nothing was planned, or the lesson finished early. Same per-child picker the VIC Room uses:
  // every child carries on from their own next standard rather than all getting one topic.
  if (req.body?.action === 'practice') {
   const subject = ['math', 'reading'].includes(req.body?.subject) ? req.body.subject : null
   if (!subject) return res.status(400).json({ error: 'Choose reading or math.' })
   const roster = await roomStudents(db, { class_ids: granted })
   if (!roster.length) return res.status(400).json({ error: 'There are no students in these classes.' })
   const { data: coverClasses } = await db.from('classes').select('id,class_name').in('id', granted)
   const vicIds = new Set((coverClasses || []).filter(c => VIC_CLASS.test(c.class_name || '')).map(c => Number(c.id)))
   const targets = roster.map(s => ({ ...s, vicClassId: (s.classIds || []).map(Number).find(id => vicIds.has(id)) || null }))
   const done = await practiceForRoom(db, { students: targets, subject, catalogues: { general, access } })
   return res.json({ ...done, skipped: (done.skipped || []).map(x => ({ name: shortName(x.name), why: x.why })) })
  }

  // One child cannot get in: no card, or they have forgotten their pictures. New pictures for
  // that child alone, handed straight back so the covering adult can read them out.
  //
  // Deliberately one child rather than the whole room's cards: the pictures are the password and
  // they do not rotate on their own, so a screen showing all of them is a lasting handover of
  // every child's login to somebody who has the building for one day.
  if (req.body?.action === 'resetPictures') {
   const studentId = Number(req.body?.studentId)
   const roster = await roomStudents(db, { class_ids: granted })
   const child = roster.find(s => Number(s.id) === studentId)
   if (!child) return res.status(403).json({ error: 'That child is not in a class on your cover slip.' })
   const pictures = randomPictures()
   const { error: saveError } = await db.from('student_picture_logins').upsert(
    { student_id: child.id, pictures, failed_count: 0, locked_until: null, updated_at: new Date().toISOString() },
    { onConflict: 'student_id' })
   if (saveError) throw saveError
   // Worth a record: a cover code changed a child's login, and the teacher will want to know
   // their printed card is now out of date.
   console.info('[cover] pictures reset', { grant: grant.id, student: child.id })
   return res.json({ name: shortName(child.name), pictures })
  }

  await db.from('cover_grants').update({ last_opened_at: new Date().toISOString() }).eq('id', grant.id)
  const { data: classes } = await db.from('classes').select('id,class_name,grade_level,users:teacher_id(name)').in('id', granted.length ? granted : [0])
  const planned = await plannedToday(db, granted, today)
  const { data: school } = await db.from('ap_schools').select('name').eq('id', grant.school_id).maybeSingle()
  // Who is in the room, for the "a child cannot log in" panel. Names only -- short ones, the
  // same as the Room shows -- never anybody's pictures. A covering adult has the register
  // anyway; the pictures are the part that is a password.
  //
  // Never fatal: this panel is a convenience, and the lessons are why the adult is on this
  // screen. If the roster cannot be read they lose the panel, not their day.
  let roster = [], loginBy = new Map()
  try {
   roster = await roomStudents(db, { class_ids: granted })
   const { data: logins } = roster.length
    ? await db.from('student_picture_logins').select('student_id,pictures,locked_until').in('student_id', roster.map(s => s.id))
    : { data: [] }
   loginBy = new Map((logins || []).map(l => [Number(l.student_id), l]))
  } catch (rosterError) {
   console.error('[cover] roster failed', { message: rosterError?.message })
   roster = []
  }
  const now = Date.now()
  return res.json({
   school: school?.name || '',
   coveringName: grant.covering_name,
   day: grant.day,
   note: grant.note || '',
   students: roster.map(s => {
    const l = loginBy.get(Number(s.id))
    const lockedUntil = l?.locked_until ? Date.parse(l.locked_until) : 0
    const locked = lockedUntil > now
    return {
     id: s.id,
     short: shortName(s.name),
     hasPictures: Array.isArray(l?.pictures) && l.pictures.length > 0,
     locked,
     lockedMinutes: locked ? Math.max(1, Math.ceil((lockedUntil - now) / 60000)) : 0,
    }
   }),
   lockMinutes: LOCK_MINUTES,
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
