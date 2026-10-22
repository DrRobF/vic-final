import { serviceDb } from '../../../lib/service-db'
import { MAX_TRIES, LOCK_MINUTES } from '../../../lib/vic-room.mjs'
import { ROOM_CODE, cleanRoomCode, PICTURE_KEYS } from '../../../lib/room-pictures.mjs'

// Picture login. The child picked their name and tapped two pictures. If they match, the server makes
// a one-time sign-in token for that child's existing account; the page trades it for a session.
// Five wrong tries locks that child for five minutes (the aide can unlock sooner).
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const code = cleanRoomCode(req.body?.code), studentId = Number(req.body?.studentId)
 const pictures = Array.isArray(req.body?.pictures) ? req.body.pictures.map(String) : []
 if (!ROOM_CODE.test(code) || !Number.isInteger(studentId) || pictures.length !== 2 || !pictures.every(p => PICTURE_KEYS.includes(p))) return res.status(400).json({ error: 'Tap your name, then your two pictures.' })
 const db = serviceDb()
 if (!db) return res.status(503).json({ error: 'Login is not available right now.' })
 try {
  const { data: room } = await db.from('vic_rooms').select('id,class_ids').eq('code', code).maybeSingle()
  if (!room?.class_ids?.length) return res.status(404).json({ error: 'We couldn’t find that room. Ask your teacher.' })
  const [{ data: inRoom }, { data: login }, { data: user }] = await Promise.all([
   db.from('enrollments').select('class_id').eq('student_id', studentId).in('class_id', room.class_ids).limit(1),
   db.from('student_picture_logins').select('pictures,failed_count,locked_until').eq('student_id', studentId).maybeSingle(),
   db.from('users').select('id,role,auth_user_id').eq('id', studentId).maybeSingle(),
  ])
  if (!inRoom?.length || user?.role !== 'student' || !user.auth_user_id) return res.status(404).json({ error: 'Ask your teacher for help logging in.' })
  if (!login) return res.status(409).json({ error: 'You don’t have pictures yet. Ask your teacher.', noPictures: true })
  if (login.locked_until && new Date(login.locked_until) > new Date()) return res.status(423).json({ error: 'Too many tries. Ask your teacher for help.', locked: true })

  if (login.pictures[0] !== pictures[0] || login.pictures[1] !== pictures[1]) {
   const failed = (login.failed_count || 0) + 1
   const lock = failed >= MAX_TRIES
   await db.from('student_picture_logins').update({ failed_count: lock ? 0 : failed, locked_until: lock ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null, updated_at: new Date().toISOString() }).eq('student_id', studentId)
   return res.status(401).json({ error: lock ? 'Too many tries. Ask your teacher for help.' : 'Not quite. Try your pictures again.', locked: lock, triesLeft: lock ? 0 : MAX_TRIES - failed })
  }

  const { data: authUser, error: userError } = await db.auth.admin.getUserById(user.auth_user_id)
  if (userError || !authUser?.user?.email) return res.status(409).json({ error: 'Ask your teacher for help logging in.' })
  const { data: link, error: linkError } = await db.auth.admin.generateLink({ type: 'magiclink', email: authUser.user.email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) { console.error('[room/login] link failed', { message: linkError?.message }); return res.status(503).json({ error: 'Login is busy. Try again.' }) }
  await db.from('student_picture_logins').update({ failed_count: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('student_id', studentId)
  return res.json({ tokenHash })
 } catch (e) {
  console.error('[room/login] failed', { message: e?.message })
  return res.status(500).json({ error: 'Login is busy. Try again.' })
 }
}
