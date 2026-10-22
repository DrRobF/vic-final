import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { isLeader, canRunRoom, roomStudents, newRoomCode, randomPictures, shortName } from '../../../lib/vic-room.mjs'
import { schoolToday, schoolDayStart } from '../../../lib/release.mjs'
import { mondayOf, weekDates } from '../../../lib/lesson-week.mjs'
import { matchClass } from '../../../lib/class-match.mjs'
import { vicTargetText } from '../../../lib/lesson-companion.mjs'

const QUIET_MINUTES = 5
const isUuid = v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

// The VIC Room screen for the adult running the room (aide, teacher or school leader).
// GET            → rooms this adult can run (and, for leaders/teachers, classes they may add)
// GET ?id=       → one room, live: every child, what they're on, quiet or working, alerts, notes
// POST {action}  → create, update, assignPictures, newPictures, unlock, addNote, clearNote
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
    return res.json({ ...(await liveRoom(db, room)), launchable: await launchable(db, room) })
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
   const options = await launchable(db, room)
   const pick = options.find(o => o.lessonId === lessonId && Number(o.classId) === classId)
   if (!pick) return res.status(400).json({ error: 'That lesson isn’t planned for this room today.' })
   if (!pick.ready) return res.status(400).json({ error: 'This lesson needs a standard and objective before VIC can teach it. Ask the teacher to fix it.' })
   const { data: src } = await db.from('educator_lessons').select('id,title,draft').eq('id', lessonId).maybeSingle()
   const { data: cls } = await db.from('classes').select('id,class_name,teacher_id').eq('id', classId).maybeSingle()
   const { data: enrolled } = await db.from('enrollments').select('student_id,support_level').eq('class_id', classId)
   if (!src || !cls || !enrolled?.length) return res.status(400).json({ error: 'This class has no students yet.' })
   const toMode = l => (l === 'remediation' ? 'remediation' : l === 'enrichment' ? 'enrichment' : 'on-level')
   const { data: lesson, error: lErr } = await db.from('lessons').insert({ class_id: classId, teacher_id: cls.teacher_id, subject: cls.class_name, title: src.draft?.plan?.title || src.title || 'Today’s lesson', lesson_text: vicTargetText(src.draft), is_active: true, source_lesson_id: src.id }).select('id').single()
   if (lErr) throw lErr
   const at = new Date().toISOString()
   const { error: aErr } = await db.from('assignments').insert(enrolled.map(e => ({ lesson_id: lesson.id, student_id: e.student_id, mode: toMode(e.support_level), status: 'assigned', assigned_at: at })))
   if (aErr) { await db.from('lessons').delete().eq('id', lesson.id); throw aErr }
   return res.json({ launched: enrolled.length })
  }
  if (action === 'unlock') {
   if (!inRoom(studentId)) return res.status(400).json({ error: 'Choose a student in this room.' })
   await db.from('student_picture_logins').update({ failed_count: 0, locked_until: null }).eq('student_id', studentId)
   return res.json({ unlocked: true })
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
 const [{ data: classes }, { data: pics }, { data: acts }, { data: open }, { data: alerts }, { data: notes }, { data: assigned }] = await Promise.all([
  db.from('classes').select('id,class_name,grade_level').in('id', room.class_ids || []),
  ids.length ? db.from('student_picture_logins').select('student_id,pictures,locked_until,last_login_at').in('student_id', ids) : empty,
  ids.length ? db.from('vic_activity_snapshots').select('student_id,class_id,assignment_id,turns,updated_at').in('student_id', ids).gte('updated_at', dayStart) : empty,
  ids.length ? db.from('vic_open_work_snapshots').select('student_id,class_id,turns,updated_at').in('student_id', ids).gte('updated_at', dayStart) : empty,
  ids.length ? db.from('vic_safety_alerts').select('id,student_id,category,created_at,reviewed_at').in('student_id', ids).gte('created_at', dayStart) : empty,
  ids.length ? db.from('vic_room_notes').select('id,student_id,note,created_at').eq('room_id', room.id).eq('active', true).in('student_id', ids) : empty,
  ids.length ? db.from('assignments').select('student_id,mode,assigned_at,lessons!inner(id,title,class_id,source_lesson_id)').in('student_id', ids).eq('status', 'assigned').in('lessons.class_id', room.class_ids || []).gte('assigned_at', dayStart).lte('assigned_at', new Date().toISOString()) : empty,
 ])
 const by = (rows, key = 'student_id') => { const m = new Map(); for (const r of rows || []) { const k = Number(r[key]); m.set(k, [...(m.get(k) || []), r]) } return m }
 const picBy = new Map((pics || []).map(p => [Number(p.student_id), p]))
 const actBy = by([...(acts || []).map(a => ({ ...a, kind: 'lesson' })), ...(open || []).map(a => ({ ...a, kind: 'own' }))])
 const alertBy = by(alerts), noteBy = by(notes), lessonBy = by(assigned)
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
   pictures: pic?.pictures || null, locked: !!(pic?.locked_until && new Date(pic.locked_until) > new Date()),
  }
 })
 const count = k => rows.filter(r => r.status === k).length
 return { id: room.id, name: room.name, code: room.code, classes: (classes || []).map(c => ({ id: c.id, name: c.class_name, grade: c.grade_level })), summary: { total: rows.length, working: count('working'), quiet: count('quiet'), out: count('out'), alert: count('alert') }, students: rows }
}

// Today's planned lessons from the week plans of the teachers whose classes are in this room,
// matched to the right class by grade and subject, and whether each is already on screens.
async function launchable(db, room) {
 const { data: classes } = await db.from('classes').select('id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id,name)').in('id', room.class_ids || [])
 const today = schoolToday(), weekOf = mondayOf(today), idx = weekDates(weekOf).indexOf(today)
 if (idx < 0 || !classes?.length) return []
 const owners = [...new Set(classes.map(c => c.users?.auth_user_id).filter(Boolean))]
 const { data: weeks } = owners.length ? await db.from('lesson_weeks').select('user_id,grade,subject,days').in('user_id', owners).eq('week_of', weekOf) : { data: [] }
 const out = []
 for (const w of weeks || []) {
  const lessonId = w.days?.[idx]?.lessonId
  if (!lessonId || w.days[idx].off) continue
  const theirs = classes.filter(c => c.users?.auth_user_id === w.user_id)
  const cls = matchClass(theirs, w)
  if (!cls || out.some(o => o.lessonId === lessonId && o.classId === cls.id)) continue
  out.push({ lessonId, classId: cls.id, className: cls.class_name, teacher: cls.users?.name || '' })
 }
 if (!out.length) return []
 const ids = out.map(o => o.lessonId)
 const [{ data: drafts }, { data: sent }] = await Promise.all([
  db.from('educator_lessons').select('id,title,draft').in('id', ids),
  db.from('lessons').select('source_lesson_id,class_id,assignments!inner(assigned_at)').in('source_lesson_id', ids).gte('assignments.assigned_at', schoolDayStart(today)).lte('assignments.assigned_at', new Date().toISOString()),
 ])
 const draftBy = new Map((drafts || []).map(d => [d.id, d]))
 return out.map(o => {
  const d = draftBy.get(o.lessonId)
  let ready = true; try { vicTargetText(d?.draft) } catch { ready = false }
  return { ...o, title: d?.draft?.plan?.title || d?.title || 'Lesson', ready, live: (sent || []).some(x => x.source_lesson_id === o.lessonId && Number(x.class_id) === Number(o.classId)) }
 })
}
