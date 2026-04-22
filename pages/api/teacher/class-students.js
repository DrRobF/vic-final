import { createClient } from '@supabase/supabase-js'
import { lessonFromAssignment, pickLatestAssignment } from '../../../lib/assignment-resolution'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

async function loadAssignmentsSafe(supabaseAdmin, studentIds) {
  const assignmentQueryPlans = [
    {
      select: 'id, student_id, lesson_id, status, mode, assigned_at, created_at, lessons ( id, title, subject )',
      orders: [
        ['assigned_at', { ascending: false, nullsFirst: false }],
        ['created_at', { ascending: false, nullsFirst: false }],
        ['id', { ascending: false }],
      ],
      reason: 'full_assignment_with_join',
    },
    {
      select: 'id, student_id, lesson_id, status, mode, assigned_at, lessons ( id, title, subject )',
      orders: [
        ['assigned_at', { ascending: false, nullsFirst: false }],
        ['id', { ascending: false }],
      ],
      reason: 'no_created_at_fallback',
    },
    {
      select: 'id, student_id, lesson_id, status, mode, assigned_at, created_at',
      orders: [
        ['assigned_at', { ascending: false, nullsFirst: false }],
        ['created_at', { ascending: false, nullsFirst: false }],
        ['id', { ascending: false }],
      ],
      reason: 'no_join_fallback',
    },
    {
      select: 'id, student_id, lesson_id, status, mode, assigned_at',
      orders: [
        ['assigned_at', { ascending: false, nullsFirst: false }],
        ['id', { ascending: false }],
      ],
      reason: 'minimal_assignment_fallback',
    },
  ]

  for (const plan of assignmentQueryPlans) {
    let query = supabaseAdmin.from('assignments').select(plan.select).in('student_id', studentIds)
    plan.orders.forEach(([column, options]) => {
      query = query.order(column, options)
    })

    const { data, error } = await query

    if (!error) {
      return { rows: Array.isArray(data) ? data : [], mode: plan.reason }
    }

    console.error('[teacher/class-students] Assignment lookup fallback triggered.', {
      reason: plan.reason,
      code: error.code,
      message: error.message,
    })
  }

  return { rows: [], mode: 'failed_all_assignment_lookups' }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' })
  }

  const classIdRaw = req.body?.classId
  const classId = typeof classIdRaw === 'number' ? classIdRaw : Number(classIdRaw)

  if (!Number.isInteger(classId) || classId <= 0) {
    return res.status(400).json({ error: 'A valid classId is required.' })
  }

  const accessToken = getBearerToken(req)

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token.' })
  }

  const supabaseAuth = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAuth.auth.getUser(accessToken)

  if (authError || !authUser?.id) {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }

  const { data: teacherRows, error: teacherLookupError } = await supabaseAdmin
    .from('users')
    .select('id, auth_user_id, email, role')
    .eq('auth_user_id', authUser.id)
    .order('id', { ascending: true })
    .limit(1)

  let teacherRow = Array.isArray(teacherRows) ? teacherRows[0] : null

  if (!teacherRow?.id && authUser.email) {
    const { data: fallbackRows, error: fallbackError } = await supabaseAdmin
      .from('users')
      .select('id, auth_user_id, email, role')
      .eq('email', authUser.email)
      .order('id', { ascending: true })
      .limit(1)

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message || 'Could not resolve teacher profile.' })
    }

    teacherRow = Array.isArray(fallbackRows) ? fallbackRows[0] : null
  } else if (teacherLookupError) {
    return res.status(500).json({ error: teacherLookupError.message || 'Could not resolve teacher profile.' })
  }

  if (!teacherRow?.id) {
    return res.status(404).json({ error: 'Teacher profile not found.' })
  }

  if (teacherRow.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teacher accounts can load class students.' })
  }

  const { data: ownedClass, error: classOwnershipError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('teacher_id', teacherRow.id)
    .maybeSingle()

  if (classOwnershipError) {
    return res.status(500).json({ error: classOwnershipError.message || 'Could not verify class ownership.' })
  }

  if (!ownedClass?.id) {
    return res.status(403).json({ error: 'This class does not belong to the signed-in teacher.' })
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select('student_id, support_level')
    .eq('class_id', classId)
    .order('student_id', { ascending: true })

  if (enrollmentError) {
    return res.status(500).json({ error: enrollmentError.message || 'Could not load class enrollments.' })
  }

  const safeEnrollmentRows = Array.isArray(enrollmentRows) ? enrollmentRows : []
  const studentIds = safeEnrollmentRows.map((row) => row?.student_id).filter((id) => Number.isInteger(id))

  if (studentIds.length === 0) {
    return res.status(200).json({ students: [] })
  }

  let studentLookup = await supabaseAdmin
    .from('users')
    .select('id, name, email, parent_email')
    .in('id', studentIds)
    .order('id', { ascending: true })

  if (studentLookup.error?.code === '42703') {
    studentLookup = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .in('id', studentIds)
      .order('id', { ascending: true })
  }

  const { data: studentRows, error: studentLookupError } = studentLookup

  if (studentLookupError) {
    return res.status(500).json({ error: studentLookupError.message || 'Could not load student records.' })
  }

  const { rows: assignmentRowsSafe } = await loadAssignmentsSafe(supabaseAdmin, studentIds)
  const latestAssignmentByStudentId = new Map()
  const assignmentRowsByStudentId = new Map()
  assignmentRowsSafe.forEach((row) => {
    if (!Number.isInteger(row?.student_id)) return
    const existingRows = assignmentRowsByStudentId.get(row.student_id) || []
    existingRows.push(row)
    assignmentRowsByStudentId.set(row.student_id, existingRows)
  })

  assignmentRowsByStudentId.forEach((rows, studentId) => {
    latestAssignmentByStudentId.set(studentId, pickLatestAssignment(rows))
  })

  const lessonIdsMissingJoin = Array.from(latestAssignmentByStudentId.values())
    .filter(Boolean)
    .filter((row) => !lessonFromAssignment(row) && Number.isInteger(row.lesson_id))
    .map((row) => row.lesson_id)
  const uniqueLessonIdsMissingJoin = [...new Set(lessonIdsMissingJoin)]
  const lessonById = new Map()

  if (uniqueLessonIdsMissingJoin.length > 0) {
    const { data: fallbackLessonRows, error: fallbackLessonError } = await supabaseAdmin
      .from('lessons')
      .select('id, title, subject')
      .in('id', uniqueLessonIdsMissingJoin)

    if (fallbackLessonError) {
      console.error('[teacher/class-students] Lesson fallback lookup failed.', {
        code: fallbackLessonError.code,
        message: fallbackLessonError.message,
      })
    }

    ;(Array.isArray(fallbackLessonRows) ? fallbackLessonRows : []).forEach((lesson) => {
      if (Number.isInteger(lesson?.id)) lessonById.set(lesson.id, lesson)
    })
  }

  const studentsById = new Map((Array.isArray(studentRows) ? studentRows : []).map((row) => [row.id, row]))
  const supportByStudentId = new Map(
    safeEnrollmentRows
      .filter((row) => Number.isInteger(row?.student_id))
      .map((row) => [row.student_id, row.support_level || null])
  )
  const students = studentIds
    .map((studentId) => studentsById.get(studentId))
    .filter(Boolean)
    .map((student) => {
      const latestAssignment = latestAssignmentByStudentId.get(student.id) || null
      const latestLesson =
        lessonFromAssignment(latestAssignment) ||
        (Number.isInteger(latestAssignment?.lesson_id) ? lessonById.get(latestAssignment.lesson_id) : null) ||
        null
      const latestLessonTitle = latestLesson?.title || latestLesson?.subject || ''
      const assignmentStatus = typeof latestAssignment?.status === 'string' ? latestAssignment.status.trim() : ''
      const isWorkedLesson = assignmentStatus && assignmentStatus !== 'assigned'

      return {
        id: student.id,
        name: student.name || '',
        email: student.email || '',
        parent_email: student.parent_email || '',
        support_level: supportByStudentId.get(student.id) || null,
        latest_assignment: latestAssignment
          ? {
              status: assignmentStatus || '',
              assigned_at: latestAssignment.assigned_at || null,
              mode: latestAssignment.mode || '',
              lesson_id: latestLesson?.id || null,
              lesson_title: latestLessonTitle || '',
            }
          : null,
        lesson_context_label: isWorkedLesson ? 'Most Recent Lesson Worked On' : 'Assigned Lesson',
        lesson_context_title: latestLessonTitle || 'No lesson activity yet',
        lesson_context_source: isWorkedLesson ? 'latest_session_or_assignment' : 'current_assignment',
      }
    })

  return res.status(200).json({ students })
}
