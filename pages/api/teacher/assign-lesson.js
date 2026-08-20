import { requireApprovedProfile } from '../../../lib/server-auth'
import { buildAssignmentRows, normalizePositiveId, validateAssignedStudents } from '../../../lib/lesson-assignment.mjs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only teachers can assign lessons.' })

  const classId = normalizePositiveId(req.body?.classId)
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const lessonText = typeof req.body?.lessonText === 'string' ? req.body.lessonText.trim() : ''
  const selections = Array.isArray(req.body?.assignments) ? req.body.assignments : []
  if (!classId || !title || !lessonText) return res.status(400).json({ error: 'A class, lesson title, and lesson instructions are required.' })

  const { data: ownedClass, error: classError } = await auth.admin.from('classes').select('id').eq('id', classId).eq('teacher_id', auth.profile.id).maybeSingle()
  if (classError) return res.status(500).json({ error: 'Could not verify the selected class.' })
  if (!ownedClass) return res.status(403).json({ error: 'The selected class does not belong to the signed-in teacher.' })

  const { data: enrollments, error: enrollmentError } = await auth.admin.from('enrollments').select('student_id').eq('class_id', classId)
  if (enrollmentError) return res.status(500).json({ error: 'Could not verify class enrollment.' })
  const normalizedSelections = selections.map((row) => ({ studentId: normalizePositiveId(row?.studentId), mode: row?.mode }))
  const validation = validateAssignedStudents(normalizedSelections.map((row) => row.studentId), (enrollments || []).map((row) => row.student_id))
  if (validation.error) return res.status(403).json({ error: validation.error })
  const modeByStudent = new Map(normalizedSelections.map((row) => [row.studentId, row.mode]))

  const { data: lesson, error: lessonError } = await auth.admin.from('lessons').insert({
    class_id: classId,
    teacher_id: auth.profile.id,
    subject: req.body?.subject || null,
    title,
    lesson_text: lessonText,
    is_active: true,
  }).select('id').single()
  if (lessonError || !lesson?.id) return res.status(500).json({ error: lessonError?.message || 'Could not create lesson.' })

  const assignmentRows = buildAssignmentRows(lesson.id, validation.studentIds.map((studentId) => ({ studentId, mode: modeByStudent.get(studentId) })), new Date().toISOString())
  const { error: assignmentError } = await auth.admin.from('assignments').insert(assignmentRows)
  if (assignmentError) {
    const { error: cleanupError } = await auth.admin.from('lessons').delete().eq('id', lesson.id).eq('teacher_id', auth.profile.id)
    const cleanupMessage = cleanupError ? ' The unassigned lesson could not be cleaned up; please contact support.' : ' The unassigned lesson was safely removed.'
    return res.status(500).json({ error: `Lesson assignment failed.${cleanupMessage}` })
  }
  return res.status(201).json({ lessonId: lesson.id, assignmentCount: assignmentRows.length })
}
