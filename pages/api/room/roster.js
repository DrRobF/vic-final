import { serviceDb } from '../../../lib/service-db'
import { roomStudents, shortName } from '../../../lib/vic-room.mjs'
import { ROOM_CODE, cleanRoomCode } from '../../../lib/room-pictures.mjs'

// The name buttons on the picture login screen: room name and each child's first name and last initial.
// Only the room code is needed; it is typed once per classroom computer by the aide.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const code = cleanRoomCode(req.query.code)
 if (!ROOM_CODE.test(code)) return res.status(400).json({ error: 'Room codes have 6 letters and numbers.' })
 const db = serviceDb()
 if (!db) return res.status(503).json({ error: 'Login is not available right now.' })
 try {
  const { data: room } = await db.from('vic_rooms').select('id,name,class_ids').eq('code', code).maybeSingle()
  if (!room) return res.status(404).json({ error: 'We couldn’t find that room code. Check it with your teacher.' })
  const students = await roomStudents(db, room)
  const ids = students.map(s => s.id)
  const { data: pics } = ids.length ? await db.from('student_picture_logins').select('student_id').in('student_id', ids) : { data: [] }
  const ready = new Set((pics || []).map(p => Number(p.student_id)))
  return res.json({ name: room.name, students: students.map(s => ({ id: s.id, name: shortName(s.name), ready: ready.has(Number(s.id)) })) })
 } catch (e) {
  console.error('[room/roster] failed', { message: e?.message })
  return res.status(500).json({ error: 'Could not open this room. Please try again.' })
 }
}
