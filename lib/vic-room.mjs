// VIC Room, server side: rooms group existing classes so one aide can run them, and students in a room
// log in with their name and two secret pictures.
import { randomInt } from 'node:crypto'
import { PICTURE_KEYS } from './room-pictures.mjs'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const MAX_TRIES = 5, LOCK_MINUTES = 5

export function newRoomCode() { return Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('') }
export function randomPictures() {
 const a = randomInt(PICTURE_KEYS.length)
 let b = randomInt(PICTURE_KEYS.length - 1); if (b >= a) b++
 return [PICTURE_KEYS[a], PICTURE_KEYS[b]]
}
// "Maya Rodriguez" → "Maya R." Enough for a child to find their own name; no full names on a shared screen.
export function shortName(name) {
 const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
 if (!parts.length) return 'Student'
 return parts.length > 1 ? `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.` : parts[0]
}

export async function isLeader(db, authUserId) {
 const { data } = await db.from('ap_memberships').select('school_id').eq('auth_user_id', authUserId).limit(1)
 return !!data?.length
}

// May this adult run this room? School leaders, the room's aides, and teachers of its classes.
export async function canRunRoom(db, { profileId, authUserId, room, leader }) {
 if (!room || !profileId) return false
 if (leader ?? await isLeader(db, authUserId)) return true
 if ((room.staff_ids || []).map(Number).includes(Number(profileId))) return true
 if (!room.class_ids?.length) return false
 const { data } = await db.from('classes').select('id').in('id', room.class_ids).eq('teacher_id', profileId).limit(1)
 return !!data?.length
}

// Every student in the room's classes, once each, with which of the room's classes they're in.
export async function roomStudents(db, room) {
 if (!room?.class_ids?.length) return []
 const { data } = await db.from('enrollments').select('class_id,support_level,users:student_id(id,name,role)').in('class_id', room.class_ids)
 const byId = new Map()
 for (const e of data || []) {
  const u = e.users
  if (!u?.id || u.role !== 'student') continue
  const s = byId.get(u.id) || { id: u.id, name: u.name || 'Student', classIds: [], levels: {} }
  s.classIds.push(e.class_id); s.levels[e.class_id] = e.support_level || null
  byId.set(u.id, s)
 }
 return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}
