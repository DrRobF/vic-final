import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { isLeader, canRunRoom, roomStudents, newRoomCode, randomPictures, shortName } from '../../../lib/vic-room.mjs'
import { schoolToday, schoolDayStart } from '../../../lib/release.mjs'
import { plannedToday, launchLesson } from '../../../lib/lesson-launch.mjs'
import { practiceForRoom, VIC_CLASS } from '../../../lib/vic-practice.mjs'
import general from '../../../data/lesson-standards.json'
import access from '../../../data/access-points.json'

const QUIET_MINUTES = 5
const isUuid = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

// The VIC Room screen for the adult running the room (aide, teacher or school leader).
// GET            → rooms this adult can run (and, for leaders/teachers, classes they may add)
// GET ?id=       → one room, live: every child, what they're on, quiet or working, alerts, notes
// POST {action}  → create, update, assignPictures, newPictures, unlock, unlockAll, addNote, clearNote, practiceAll
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireLessonEducator(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (!auth.profile?.id) return res.status(403).json({ error: 'The VIC Room is for school staff.' })
 const db = auth.admin, me = auth.profile.id
 try {
  const leader = await isLeader(db, auth.user.id)
  const loadRoom = async id => { const { data } = await db.from('vic_rooms').select('*').eq('id', id).maybeSingle(); return data }
  const guard = async id => { const room = isUuid(id) ? await loadRoom(id) : null; return room && await canRunRoom(db, { profileId: me, authUserId: auth.user.id, room, leader }) ? room : null }

  if (req.method === 'GET') {
   if (req.query.id) {
    const room = await guard(req.query.id)
    if (!room) return res.status(404).json({ error: 'This room isn’t yours to run.' })
    return res.json({ ...(await liveRoom(db, room)), launchable: await plannedToday(db, room.class_ids) })
   }
   const { data: all } = await db.from('vic_rooms').select('id,name,code,class_ids,staff_ids').order('created_at', { ascending: true })
   const mine = []
   for (const r of all || []) if (await canRunRoom(db, { profileId: me, authUserId: auth.user.id, room: r, leader })) mine.push({ id: r.id, name: r.name, code: r.code })
   let classes = []
   if (leader) ({ data: classes } = await db.from('classes').select('id,class_name,grade_level,users:teacher_id(name)').order('grade_level', { ascending: true, nullsFirst: false }).order('class_name'))
   else ({ data: classes } = await db.from('classes').select('id,class_name,grade_level').eq('teacher_id', me))
   return res.json({ rooms: mine, leader, classes: (classes || []).map(c => ({ id: c.id, name: c.class_name, grade: c.grade_level, teacher: c.users?.name || '' })) })
  }

  const action = req.body?.action
  if (action === 'create' || action === 'update') {
   const name = String(req.body?.name || '').trim().slice(0, 120)
   const classIds = [...new Set((Array.isArray(req.body?.classIds) ? req.body.classIds : []).map(Number).filter(n => Number.isInteger(n) && n > 0))]
   if (!name) return res.status(400).json({ error: 'Give the room a name.' })
   if (!classIds.length) return res.status(400).json({ error: 'Choose at least one class for this room.' })
   const { data: owned } = await db.from('classes').select('id,teacher_id').in('id', classIds)
   if ((owned || []).length !== classIds.length) return res.status(400).json({ error: 'One of those classes no longer exists.' })
   if (!leader && owned.some(c => Number(c.teacher_id) !== Number(me))) return res.status(403).json({ error: 'Only a school leader can add other teachers’ classes.' })
   // Aides by email: they need an AskVic staff account first.
   const emails = [...new Set((Array.isArray(req.body?.staffEmails) ? req.body.staffEmails : []).map(e => String(e).trim().toLowerCase()).filter(e => e.includes('@')))].slice(0, 10)
   let staffIds = []
   if (emails.length) {
    const { data: staff } = await db.from('users').select('id,email,role').in('email', emails)
    const found = (staff || []).filter(s => ['teacher', 'principal'].includes(String(s.role).toLowerCase()))
    const missing = emails.filter(e => !found.some(s => String(s.email).toLowerCase() === e))
    if (missing.length) return res.status(400).json({ error: `No AskVic staff account for ${missing.join(', ')}. Add them as staff first, then try again.`, missing })
    staffIds = found.map(s => s.id)
   }
   if (action === 'create') {
    for (let i = 0; i < 5; i++) {
     const { data, error } = await db.from('vic_rooms').insert({ name, class_ids: classIds, staff_ids: staffIds, code: newRoomCode(), created_by: me }).select('id,code').single()
     if (!error) return res.status(201).json({ id: data.id, code: data.code })
     if (error.code !== '23505') throw error
    }
    throw new Error('Could not make a unique room code.')
   }
   const room = await guard(req.body?.roomId)
   if (!room) return res.status(404).json({ error: 'This room isn’t yours to run.' })
   const patch = { name, class_ids: classIds, updated_at: new Date().toISOString(), ...(Array.isArray(req.body?.staffEmails) ? { staff_ids: staffIds } : {}) }
   const { error } = await db.from('vic_rooms').update(patch).eq('id', room.id)
   if (error) throw error
   return res.json({ saved: true })
  }

  const room = await guard(req.body?.roomId)
  if (!room) return res.status(404).json({ error: 'This room isn’t yours to run.' })
  const students = await roomStudents(db, room)
  const inRoom = id => students.some(s => Number(s.id) === Number(id))
  const studentId = Number(req.body?.studentId)

  // Give every child without pictures a pair (or one child a fresh pair). Picture login replaces
  // the first-login password change for these students.
  if (action === 'assignPictures' || action === 'newPictures') {
   const targets = action === 'newPictures' ? (inRoom(studentId) ? [studentId] : []) : students.map(s => s.id)
   if (!targets.length) return res.status(400).json({ error: 'Choose a student in this room.' })
   const { data: have } = await db.from('student_picture_logins').select('student_id').in('student_id', targets)
   const skip = action === 'assignPictures' ? new Set((have || []).map(h => Number(h.student_id))) : new Set()
   const rows = targets.filter(id => !skip.has(Number(id))).map(id => ({ student_id: id, pictures: randomPictures(), failed_count: 0, locked_until: null, updated_at: new Date().toISOString() }))
   if (rows.length) { const { error } = await db.from('student_picture_logins').upsert(rows, { onConflict: 'student_id' }); if (error) throw error }
   return res.json({ assigned: rows.length })
  }
  // The aide sends a teacher's planned lesson for today to that class, each child at their saved level.
  if (action === 'launch') {
   const classId = Number(req.body?.classId), lessonId = String(req.body?.lessonId || '')
   const options = await plannedToday(db, room.class_ids)
   const pick = options.find(o => o.lessonId === lessonId && Number(o.classId) === classId)
   if (!pick) return res.status(400).json({ error: 'That lesson isn’t planned for this room today.' })
   if (!pick.ready) return res.status(400).json({ error: 'This lesson needs a standard and objective before VIC can teach it. Ask the teacher to fix it.' })
   const done = await launchLesson(db, { classId, lessonId })
   return res.json(done)
  }
  // No teacher planned a lesson, so the aide starts each child on their own next skill.
  // Deliberately per-child rather than one shared topic: a group of eleven sits at eleven
  // different places, and the picker already knows where each of them is.
  if (action === 'practiceAll') {
   const subject = ['math', 'reading'].includes(req.body?.subject) ? req.body.subject : null
   if (!subject) return res.status(400).json({ error: 'Choose reading or math.' })
   const roomClassIds = (room.class_ids || []).map(Number)
   const { data: roomClasses } = roomClassIds.length
    ? await db.from('classes').select('id,class_name').in('id', roomClassIds) : { data: [] }
   const vicIds = new Set((roomClasses || []).filter(c => VIC_CLASS.test(c.class_name || '')).map(c => Number(c.id)))
   const targets = students.map(s => ({
    ...s,
    vicClassId: (s.classIds || []).map(Number).find(id => vicIds.has(id)) || null,
   }))
   const done = await practiceForRoom(db, { students: targets, subject, catalogues: { general, access } })
   return res.json(done)
  }
  // Finishing a move into the room: its students leave every class outside the room. School leaders only.
  if (action === 'leaveOldClasses') {
   if (!leader) return res.status(403).json({ error: 'Only a school leader can move students between classes.' })
   const ids = students.map(s => s.id)
   const { data: other } = ids.length ? await db.from('enrollments').select('class_id,student_id').in('student_id', ids).not('class_id', 'in', `(${(room.class_ids || []).join(',')})`) : { data: [] }
   if (req.body?.confirm !== true) {
    const counts = {}; for (const e of other || []) counts[e.class_id] = (counts[e.class_id] || 0) + 1
    const { data: names } = Object.keys(counts).length ? await db.from('classes').select('id,class_name').in('id', Object.keys(counts).map(Number)) : { data: [] }
    return res.json({ preview: (names || []).map(c => ({ name: c.class_name, students: counts[c.id] })) })
   }
   if (other?.length) { const { error } = await db.from('enrollments').delete().in('student_id', ids).not('class_id', 'in', `(${(room.class_ids || []).join(',')})`); if (error) throw error }
   return res.json({ removed: other?.length || 0 })
  }
  if (action === 'unlock') {
   if (!inRoom(studentId)) return res.status(400).json({ error: 'Choose a student in this room.' })
   await db.from('student_picture_logins').update({ failed_count: 0, locked_until: null }).eq('student_id', studentId)
   return res.json({ unlocked: true })
  }
  // A whole group hits the five-try wall at once on a first day. The adult is standing right
  // there, so clearing the room costs nothing the lock was protecting.
  if (action === 'unlockAll') {
   const ids = students.map(s => s.id)
   if (!ids.length) return res.json({ unlocked: 0 })
   const { data: locked } = await db.from('student_picture_logins').select('student_id').in('student_id', ids).not('locked_until', 'is', null)
   const targets = (locked || []).map(l => l.student_id)
   if (targets.length) await db.from('student_picture_logins').update({ failed_count: 0, locked_until: null }).in('student_id', targets)
   return res.json({ unlocked: targets.length })
  }
  if (action === 'addNote') {
   const note = String(req.body?.note || '').trim().slice(0, 600)
   if (!note) return res.status(400).json({ error: 'Write the note first.' })
   const ids = req.body?.everyone ? students.map(s => s.id) : inRoom(studentId) ? [studentId] : []
   if (!ids.length) return res.status(400).json({ error: 'Choose a student in this room.' })
   const { error } = await db.from('vic_room_notes').insert(ids.map(id => ({ room_id: room.id, student_id: id, note, created_by: me })))
   if (error) throw error
   return res.json({ added: ids.length })
  }
  if (action === 'clearNote') {
   const { error } = await db.from('vic_room_notes').update({ active: false }).eq('id', Number(req.body?.noteId)).eq('room_id', room.id)
   if (error) throw error
   return res.json({ cleared: true })
  }
  return res.status(400).json({ error: 'Unknown action.' })
 } catch (e) {
  console.error('[room/manage] failed', { message: e?.message })
  return res.status(500).json({ error: 'Something went wrong. Please try again.' })
 }
}

// Everything the aide sees for one room, right now.
async function liveRoom(db, room) {
 const students = await roomStudents(db, room)
 const ids = students.map(s => s.id)
 const dayStart = schoolDayStart(schoolToday()), now = Date.now()
 const empty = { data: [] }
 const [{ data: classes }, { data: pics }, { data: acts }, { data: open }, { data: alerts }, { data: notes }, { data: assigned }, { data: goals }] = await Promise.all([
  db.from('classes').select('id,class_name,grade_level').in('id', room.class_ids || []),
  ids.length ? db.from('student_picture_logins').select('student_id,pictures,locked_until,last_login_at').in('student_id', ids) : empty,
  ids.length ? db.from('vic_activity_snapshots').select('student_id,class_id,assignment_id,turns,updated_at').in('student_id', ids).gte('updated_at', dayStart) : empty,
  ids.length ? db.from('vic_open_work_snapshots').select('student_id,class_id,turns,updated_at').in('student_id', ids).gte('updated_at', dayStart) : empty,
  ids.length ? db.from('vic_safety_alerts').select('id,student_id,category,created_at,reviewed_at').in('student_id', ids).gte('created_at', dayStart) : empty,
  ids.length ? db.from('vic_room_notes').select('id,student_id,note,created_at').eq('room_id', room.id).eq('active', true).in('student_id', ids) : empty,
  ids.length ? db.from('assignments').select('student_id,mode,assigned_at,lessons!inner(id,title,class_id,source_lesson_id)').in('student_id', ids).eq('status', 'assigned').in('lessons.class_id', room.class_ids || []).gte('assigned_at', dayStart).lte('assigned_at', new Date().toISOString()) : empty,
  ids.length ? db.from('vic_goal_results').select('student_id,verdict').in('student_id', ids).gte('created_at', dayStart) : empty,
 ])
 const by = (rows, key = 'student_id') => { const m = new Map(); for (const r of rows || []) { const k = Number(r[key]); m.set(k, [...(m.get(k) || []), r]) } return m }
 const picBy = new Map((pics || []).map(p => [Number(p.student_id), p]))
 const actBy = by([...(acts || []).map(a => ({ ...a, kind: 'lesson' })), ...(open || []).map(a => ({ ...a, kind: 'own' }))])
 const alertBy = by(alerts), noteBy = by(notes), lessonBy = by(assigned), goalBy = by(goals)
 const className = Object.fromEntries((classes || []).map(c => [c.id, c.class_name]))

 const rows = students.map(s => {
  const id = Number(s.id), pic = picBy.get(id)
  const activity = (actBy.get(id) || []).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
  const last = activity[0]?.updated_at || null
  const turns = activity.reduce((n, a) => n + (Array.isArray(a.turns) ? a.turns.length : 0), 0)
  const loggedIn = !!(pic?.last_login_at && pic.last_login_at >= dayStart) || !!last
  const minutesQuiet = last ? Math.floor((now - new Date(last).getTime()) / 60000) : null
  const openAlerts = (alertBy.get(id) || []).filter(a => !a.reviewed_at)
  const lessons = (lessonBy.get(id) || []).map(a => ({ title: a.lessons?.title || 'Lesson', className: className[a.lessons?.class_id] || '', mode: a.mode }))
  const status = openAlerts.length ? 'alert' : !loggedIn ? 'out' : last && minutesQuiet < QUIET_MINUTES ? 'working' : 'quiet'
  return {
   id, name: s.name, short: shortName(s.name), classes: s.classIds.map(c => className[c]).filter(Boolean),
   status, minutesQuiet, turns, lastWith: activity[0]?.kind || null,
   lessons, alerts: openAlerts.map(a => ({ id: a.id, category: a.category, at: a.created_at })),
   notes: (noteBy.get(id) || []).map(n => ({ id: n.id, note: n.note })),
   goals: ['met', 'partly', 'not_yet'].reduce((o, v) => ({ ...o, [v]: (goalBy.get(id) || []).filter(g => g.verdict === v).length }), {}),
   pictures: pic?.pictures || null, locked: !!(pic?.locked_until && new Date(pic.locked_until) > new Date()),
  }
 })
 const count = k => rows.filter(r => r.status === k).length
 return { id: room.id, name: room.name, code: room.code, classes: (classes || []).map(c => ({ id: c.id, name: c.class_name, grade: c.grade_level })), summary: { total: rows.length, working: count('working'), quiet: count('quiet'), out: count('out'), alert: count('alert') }, students: rows }
}

// Today's planned lessons from the week plans of the teachers whose classes are in this room,
// matched to the right class by grade and subject, and whether each is already on screens.
