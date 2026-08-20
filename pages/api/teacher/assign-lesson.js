import { requireApprovedProfile } from '../../../lib/server-auth'

const positiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only teachers may assign lessons.' })

  const classId = positiveInteger(req.body?.classId)
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : ''
  const lessonText = typeof req.body?.lessonText === 'string' ? req.body.lessonText.trim() : ''
  const requestedStudents = Array.isArray(req.body?.students) ? req.body.students : []
  const students = requestedStudents
    .map((row) => ({ studentId: positiveInteger(row?.studentId), mode: row?.mode === 'core' ? 'on-level' : row?.mode }))
    .filter((row) => row.studentId && ['remediation', 'on-level', 'on_level', 'enrichment'].includes(row.mode))

  if (!classId || !title || !lessonText || students.length === 0 || students.length !== requestedStudents.length) {
    return res.status(400).json({ error: 'A class, lesson title, instructions, and valid selected students are required.' })
  }

  console.info('[teacher/assign-lesson] request', { selectedClassId: classId, studentIds: students.map((row) => row.studentId) })

  const { data: ownedClass, error: classError } = await auth.admin
    .from('classes').select('id, class_name').eq('id', classId).eq('teacher_id', auth.profile.id).maybeSingle()
  if (classError) return res.status(500).json({ error: 'Could not verify the selected class.' })
  if (!ownedClass) return res.status(403).json({ error: 'The selected class does not belong to this teacher.' })

  const studentIds = [...new Set(students.map((row) => row.studentId))]
  if (studentIds.length !== students.length) return res.status(400).json({ error: 'Each student may only be selected once.' })
  const { data: enrollments, error: enrollmentError } = await auth.admin
    .from('enrollments').select('student_id').eq('class_id', classId).in('student_id', studentIds)
  if (enrollmentError) return res.status(500).json({ error: 'Could not verify class enrollment.' })
  if (enrollments?.length !== studentIds.length) return res.status(400).json({ error: 'Every selected student must be enrolled in the selected class.' })

  const { data: lesson, error: lessonError } = await auth.admin.from('lessons').insert({
    class_id: classId,
    teacher_id: auth.profile.id,
    subject: ownedClass.class_name || null,
    title,
    lesson_text: lessonText,
    is_active: true,
  }).select('id, class_id').single()
  if (lessonError || !lesson?.id || Number(lesson.class_id) !== classId) {
    return res.status(500).json({ error: 'The lesson could not be persisted for the selected class.' })
  }
  console.info('[teacher/assign-lesson] lesson-created', { selectedClassId: classId, createdLessonId: lesson.id })

  const assignedAt = new Date().toISOString()
  const assignmentRows = students.map(({ studentId, mode }) => ({
    lesson_id: lesson.id, student_id: studentId, mode, status: 'assigned', assigned_at: assignedAt,
  }))
  const { data: createdAssignments, error: assignmentError } = await auth.admin
    .from('assignments').insert(assignmentRows).select('id, lesson_id, student_id')
  if (assignmentError || createdAssignments?.length !== assignmentRows.length) {
    await auth.admin.from('assignments').delete().eq('lesson_id', lesson.id)
    await auth.admin.from('lessons').delete().eq('id', lesson.id)
    return res.status(500).json({ error: 'The assignments could not be persisted. No lesson was assigned.' })
  }

  const { data: persisted, error: verifyError } = await auth.admin.from('assignments')
    .select('id, lesson_id, student_id').eq('lesson_id', lesson.id).in('student_id', studentIds)
  const persistedIds = new Set((persisted || []).map((row) => row.id))
  const allPersisted = createdAssignments.every((row) => persistedIds.has(row.id))
  console.info('[teacher/assign-lesson] assignments-persisted', {
    selectedClassId: classId,
    createdLessonId: lesson.id,
    assignments: createdAssignments.map((row) => ({ studentId: row.student_id, createdAssignmentId: row.id })),
    returnedAssignmentCount: persisted?.length || 0,
  })
  if (verifyError || !allPersisted || persisted?.length !== studentIds.length) {
    return res.status(500).json({ error: 'The assignment could not be confirmed. Refresh before trying again.' })
  }

  return res.status(201).json({ lessonId: lesson.id, classId, assignmentIds: createdAssignments.map((row) => row.id), assignmentCount: persisted.length })
}
