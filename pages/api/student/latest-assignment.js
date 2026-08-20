import { requireApprovedProfile } from '../../../lib/server-auth'

function normalizeNumericId(value) {
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
  if (auth.profile.role !== 'student') return res.status(403).json({ error: 'Signed-in user is not a student profile.' })

  const activeClassId = normalizeNumericId(req.body?.activeClassId)
  if (!activeClassId) return res.status(400).json({ error: 'A valid activeClassId is required.' })
  if (normalizeNumericId(req.body?.studentId) && Number(req.body.studentId) !== auth.profile.id) {
    return res.status(403).json({ error: 'Requested student does not match signed-in profile.' })
  }

  console.info('[student/latest-assignment] request', { selectedClassId: activeClassId, studentId: auth.profile.id })
  const { data: enrollment, error: enrollmentError } = await auth.admin.from('enrollments')
    .select('class_id, support_level').eq('student_id', auth.profile.id).eq('class_id', activeClassId).maybeSingle()
  if (enrollmentError) return res.status(500).json({ error: 'Could not verify the selected class.' })
  if (!enrollment) return res.status(403).json({ error: 'The selected class is not available for this student.' })

  // Class ownership belongs to lessons in the real schema. The inner join prevents an
  // assignment for another enrolled subject from enabling Teacher Lesson here.
  const { data, error } = await auth.admin.from('assignments')
    .select('id, student_id, lesson_id, mode, status, assigned_at, lessons!inner(id, class_id, title, lesson_text, subject, is_active)')
    .eq('student_id', auth.profile.id)
    .eq('status', 'assigned')
    .eq('lessons.class_id', activeClassId)
    .order('assigned_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(20)
  if (error) return res.status(500).json({ error: 'Failed to load the latest assignment.' })

  const rows = Array.isArray(data) ? data : []
  const latestAssignment = rows[0] || null
  const assignedLesson = Array.isArray(latestAssignment?.lessons)
    ? latestAssignment.lessons[0] || null
    : latestAssignment?.lessons || null
  console.info('[student/latest-assignment] result', {
    selectedClassId: activeClassId,
    studentId: auth.profile.id,
    createdLessonId: assignedLesson?.id || null,
    createdAssignmentId: latestAssignment?.id || null,
    returnedAssignmentCount: rows.length,
  })

  return res.status(200).json({
    rows,
    latestAssignment,
    assignedLesson,
    mode: 'student_assignment_joined_to_lesson_class',
    resolvedStudentId: auth.profile.id,
    resolvedActiveClassId: activeClassId,
  })
}
