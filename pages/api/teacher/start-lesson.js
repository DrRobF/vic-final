import { requireApprovedProfile } from '../../../lib/server-auth'
import { vicTargetText } from '../../../lib/lesson-companion.mjs'
import assignLesson from './assign-lesson'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const positive = v => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null }
// Each child keeps the level the teacher already saved; anyone without one is on level.
const toMode = level => (level === 'remediation' ? 'remediation' : level === 'enrichment' ? 'enrichment' : 'on-level')

// "Start with my class": the teacher taps once on today's lesson and VIC gets it for the whole class,
// each student at their saved level. The saved lesson, its standards and its worksheets are the same
// ones the longer Teach page uses; this only skips choosing a class and ticking every student.
// The actual saving is done by the existing assign-lesson handler, so it keeps every check that has.
export default async function handler(req, res) {
 res.setHeader('Cache-Control', 'no-store')
 if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }

 const auth = await requireApprovedProfile(req)
 if (auth.error) return res.status(auth.status).json({ error: auth.error })
 if (auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only teachers may start lessons with a class.' })

 const lessonId = req.body?.lessonId
 if (typeof lessonId !== 'string' || !UUID.test(lessonId)) return res.status(400).json({ error: 'Choose one of your saved lessons.' })

 try {
  const { data: lesson, error: lessonError } = await auth.admin.from('educator_lessons').select('id,title,draft').eq('id', lessonId).eq('user_id', auth.user.id).maybeSingle()
  if (lessonError) throw lessonError
  if (!lesson) return res.status(404).json({ error: 'This lesson is not in your account.' })

  let lessonText
  try { lessonText = vicTargetText(lesson.draft) } catch (e) { return res.status(400).json({ error: e.message, needsLessonWork: true }) }

  const { data: classes, error: classesError } = await auth.admin.from('classes').select('id,class_name').eq('teacher_id', auth.profile.id).order('id', { ascending: true })
  if (classesError) throw classesError
  if (!classes?.length) return res.status(409).json({ error: 'Your account isn’t linked to a school classroom yet. Join with your school’s code first.', noClassroom: true })

  let classId = positive(req.body?.classId)
  if (!classId) {
   if (classes.length === 1) classId = classes[0].id
   else {
    const { data: counts } = await auth.admin.from('enrollments').select('class_id').in('class_id', classes.map(c => c.id))
    const sizes = {}; (counts || []).forEach(r => { sizes[r.class_id] = (sizes[r.class_id] || 0) + 1 })
    return res.status(409).json({ error: 'Which class is this for?', needClass: true, classes: classes.map(c => ({ id: c.id, name: c.class_name, students: sizes[c.id] || 0 })) })
   }
  }
  if (!classes.some(c => Number(c.id) === classId)) return res.status(403).json({ error: 'That class does not belong to you.' })

  const { data: enrolled, error: enrolledError } = await auth.admin.from('enrollments').select('student_id,support_level').eq('class_id', classId)
  if (enrolledError) throw enrolledError
  if (!enrolled?.length) return res.status(409).json({ error: 'This class has no students yet. Add students in My Classes first.', emptyClass: true })

  const students = enrolled.map(r => ({ studentId: r.student_id, mode: toMode(r.support_level) }))
  const payload = { classId, title: lesson.title || lesson.draft?.plan?.title || 'Today’s lesson', lessonText, sourceLessonId: lesson.id, students }
  // Hand the finished request to the existing assignment handler, with the same signed-in caller.
  return await assignLesson({ method: 'POST', headers: req.headers, body: payload }, res)
 } catch (e) {
  console.error('[teacher/start-lesson] failed', { name: e?.name, message: e?.message })
  return res.status(500).json({ error: 'Could not start this lesson. Please try again.' })
 }
}
