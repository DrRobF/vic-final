import { requireApprovedProfile } from '../../../lib/server-auth'
import { lessonTargets } from '../../../lib/lesson-companion.mjs'
import { studentWorksheet, cleanAnswers } from '../../../lib/student-today.mjs'
import { releasedFilter } from '../../../lib/release.mjs'
import { buildLessonPacket } from '../../../lib/lesson-packet.mjs'

const positive = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }

// The student's Today screen: what each teacher assigned, the worksheet for this student's version, and saved answers.
// Everything is resolved from the signed-in student's own profile; no caller-supplied student id is trusted.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
 const auth = await requireApprovedProfile(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (auth.profile.role !== 'student') return res.status(403).json({ error: 'This page is for students.' })
 const db = auth.admin, me = auth.profile.id

 try {
  if (req.method === 'POST') {
   const lessonId = positive(req.body?.lessonId)
   if (!lessonId) return res.status(400).json({ error: 'Choose a lesson.' })
   const { data: assignment } = await db.from('assignments').select('id,mode,lessons!inner(id,source_lesson_id,teacher_id)').eq('student_id', me).eq('lesson_id', lessonId).or(releasedFilter()).limit(1).maybeSingle()
   if (!assignment) return res.status(403).json({ error: 'This lesson isn’t assigned to you.' })
   const lesson = Array.isArray(assignment.lessons) ? assignment.lessons[0] : assignment.lessons
   let count = 20
   if (lesson?.source_lesson_id) {
    const { data: src } = await db.from('educator_lessons').select('worksheet:draft->worksheet,groups:draft->input->groups').eq('id', lesson.source_lesson_id).maybeSingle()
    count = studentWorksheet(src?.worksheet, assignment.mode, src?.groups)?.questions.length || 0
   }
   if (!count) return res.status(400).json({ error: 'This lesson has no worksheet.' })
   const { data: prior } = await db.from('student_work').select('status').eq('student_id', me).eq('lesson_id', lessonId).maybeSingle()
   if (prior?.status === 'turned_in' && !req.body?.reopen) return res.status(409).json({ error: 'You already turned this in.' })
   const turnIn = req.body?.turnIn === true, now = new Date().toISOString()
   const row = { student_id: me, lesson_id: lessonId, answers: cleanAnswers(req.body?.answers, count), status: turnIn ? 'turned_in' : 'started', updated_at: now, turned_in_at: turnIn ? now : null }
   const { error } = await db.from('student_work').upsert(row, { onConflict: 'student_id,lesson_id' })
   if (error) throw error
   return res.json({ saved: true, status: row.status, savedAt: now })
  }

  const { data: enrollments, error: eErr } = await db.from('enrollments').select('class_id,classes:class_id(id,class_name)').eq('student_id', me)
  if (eErr) throw eErr
  const classIds = (enrollments || []).map(e => e.class_id)
  const classes = Object.fromEntries((enrollments || []).map(e => [e.class_id, e.classes?.class_name || 'My class']))
  if (!classIds.length) return res.json({ name: auth.profile.name || '', classes: [], lessons: [] })

  const { data: rows, error: aErr } = await db.from('assignments')
   .select('id,mode,assigned_at,lessons!inner(id,class_id,title,source_lesson_id,teacher_id,is_active)')
   .eq('student_id', me).eq('status', 'assigned').in('lessons.class_id', classIds).or(releasedFilter())
   .order('assigned_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(30)
  if (aErr) throw aErr
  const assigned = (rows || []).map(r => ({ ...r, lesson: Array.isArray(r.lessons) ? r.lessons[0] : r.lessons })).filter(r => r.lesson && r.lesson.is_active !== false)

  const sourceIds = [...new Set(assigned.map(r => r.lesson.source_lesson_id).filter(Boolean))]
  const lessonIds = assigned.map(r => r.lesson.id)
  const teacherIds = [...new Set(assigned.map(r => r.lesson.teacher_id).filter(Boolean))]
  const [{ data: sources }, { data: work }, { data: teachers }, { data: packets }] = await Promise.all([
   sourceIds.length ? db.from('educator_lessons').select('id,draft').in('id', sourceIds) : { data: [] },
   lessonIds.length ? db.from('student_work').select('lesson_id,answers,status,updated_at').eq('student_id', me).in('lesson_id', lessonIds) : { data: [] },
   teacherIds.length ? db.from('users').select('id,name').in('id', teacherIds) : { data: [] },
   sourceIds.length ? db.from('educator_lesson_packets').select('lesson_id,packet').in('lesson_id', sourceIds) : { data: [] },
  ])
  const packetById = new Map((packets || []).map(p => [p.lesson_id, p.packet]))
  // Everything else the teacher's student packet holds (the reading, organizers, exit ticket),
  // as the teacher last edited it. The leveled worksheet itself comes separately, one version per child.
  const materialsFor = (sourceId, draft) => {
   let packet = packetById.get(sourceId)
   if (!packet && draft) { try { packet = buildLessonPacket(draft) } catch { packet = null } }
   return (packet?.student || []).filter(s => s?.body && !/^learning goal$/i.test(s.title) && !/— worksheet$/.test(s.title))
    .slice(0, 8).map(s => ({ title: String(s.title).slice(0, 150), body: String(s.body).slice(0, 18000) }))
  }
  const sourceById = new Map((sources || []).map(s => [s.id, s.draft]))
  const workById = new Map((work || []).map(w => [w.lesson_id, w]))
  const teacherById = new Map((teachers || []).map(t => [t.id, t.name]))

  const lessons = assigned.map(r => {
   const draft = r.lesson.source_lesson_id ? sourceById.get(r.lesson.source_lesson_id) : null
   let goals = []
   if (draft) { try { goals = lessonTargets(draft).objectives.slice(0, 4) } catch {} }
   const w = workById.get(r.lesson.id)
   return {
    lessonId: r.lesson.id,
    classId: r.lesson.class_id,
    title: r.lesson.title,
    className: classes[r.lesson.class_id] || 'My class',
    teacher: teacherById.get(r.lesson.teacher_id) || '',
    assignedAt: r.assigned_at,
    goals,
    worksheet: draft ? studentWorksheet(draft.worksheet, r.mode, draft.input?.groups) : null,
    materials: r.lesson.source_lesson_id ? materialsFor(r.lesson.source_lesson_id, draft) : [],
    work: w ? { answers: w.answers || {}, status: w.status, updatedAt: w.updated_at } : null,
   }
  })
  return res.json({ name: auth.profile.name || '', classes: Object.values(classes), lessons })
 } catch (e) {
  console.error('Student today failed', { message: e?.message, code: e?.code })
  return res.status(500).json({ error: 'Something went wrong loading your lessons. Please try again.' })
 }
}
