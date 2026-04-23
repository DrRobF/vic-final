import { createClient } from '@supabase/supabase-js'

function normalizeNumericId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    return res.status(500).json({ error: 'Supabase server environment is not configured.' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  const supabaseAuth = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAuth.auth.getUser()

  if (authError || !authUser) {
    return res.status(401).json({ error: authError?.message || 'Unauthorized request.' })
  }

  const requestedStudentId = normalizeNumericId(req.body?.studentId)
  const requestedActiveClassId = normalizeNumericId(req.body?.activeClassId)

  const { data: profileRowsByAuth } = await supabaseAuth
    .from('users')
    .select('id, role, auth_user_id, email')
    .eq('auth_user_id', authUser.id)
    .order('id', { ascending: true })
    .limit(1)

  const profileByAuth = profileRowsByAuth?.[0] || null
  const resolvedStudentId = profileByAuth?.role === 'student' ? profileByAuth.id : null

  if (!resolvedStudentId) {
    return res.status(403).json({ error: 'Signed-in user is not a student profile.' })
  }

  if (requestedStudentId && requestedStudentId !== resolvedStudentId) {
    return res.status(403).json({ error: 'Requested student does not match signed-in profile.' })
  }

  const { data: enrollmentRows } = await supabaseAuth
    .from('enrollments')
    .select('class_id, support_level')
    .eq('student_id', resolvedStudentId)
    .order('class_id', { ascending: true })

  const safeEnrollmentRows = Array.isArray(enrollmentRows) ? enrollmentRows : []
  const activeEnrollment = requestedActiveClassId
    ? safeEnrollmentRows.find((row) => row?.class_id === requestedActiveClassId) || null
    : null

  const { data: rows, error: assignmentsError } = await supabaseAuth
    .from('assignments')
    .select('id, student_id, lesson_id, mode, status, assigned_at')
    .eq('student_id', resolvedStudentId)
    .order('assigned_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(20)

  if (assignmentsError) {
    return res.status(500).json({ error: assignmentsError.message || 'Failed to load latest assignment.' })
  }

  const safeRows = Array.isArray(rows) ? rows : []
  const activeSupportLevel =
    typeof activeEnrollment?.support_level === 'string'
      ? activeEnrollment.support_level.trim().toLowerCase()
      : ''
  const classScopedRows =
    activeSupportLevel && safeEnrollmentRows.length > 1
      ? safeRows.filter(
          (row) =>
            typeof row?.mode === 'string' &&
            row.mode.trim().toLowerCase() === activeSupportLevel
        )
      : safeRows
  const latestAssignment = classScopedRows[0] || safeRows[0] || null
  let assignedLesson = null

  if (latestAssignment?.lesson_id) {
    const { data: lessonRow, error: lessonError } = await supabaseAuth
      .from('lessons')
      .select('id, title, lesson_text, subject, is_active')
      .eq('id', latestAssignment.lesson_id)
      .single()

    if (!lessonError && lessonRow) {
      assignedLesson = lessonRow
    }
  }

  const scopedRows = classScopedRows.length > 0 ? classScopedRows : safeRows

  const rowsWithAssignedLesson =
    latestAssignment && assignedLesson
      ? scopedRows.map((row, index) =>
          index === 0 ? { ...row, lessons: assignedLesson, assignedLesson } : row
        )
      : scopedRows

  return res.status(200).json({
    rows: rowsWithAssignedLesson,
    latestAssignment,
    assignedLesson,
    mode: 'matched_by_student_id',
    resolvedStudentId,
    resolvedActiveClassId: activeEnrollment?.class_id || null,
  })
}
