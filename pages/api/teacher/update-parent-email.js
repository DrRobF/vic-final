import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function parseOptionalEmail(rawValue) {
  if (typeof rawValue !== 'string') return ''
  return rawValue.trim().toLowerCase()
}

function isValidEmail(value) {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
  const studentIdRaw = req.body?.studentId
  const classId = typeof classIdRaw === 'number' ? classIdRaw : Number(classIdRaw)
  const studentId = typeof studentIdRaw === 'number' ? studentIdRaw : Number(studentIdRaw)
  const parentEmail = parseOptionalEmail(req.body?.parentEmail)

  if (!Number.isInteger(classId) || classId <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'Valid classId and studentId are required.' })
  }

  if (parentEmail && !isValidEmail(parentEmail)) {
    return res.status(400).json({ error: 'parentEmail is not valid.' })
  }

  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token.' })
  }

  const supabaseAuth = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const {
    data: { user: authUser },
    error: authError,
  } = await supabaseAuth.auth.getUser(accessToken)

  if (authError || !authUser?.id) {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }

  const { data: teacherRows } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('auth_user_id', authUser.id)
    .order('id', { ascending: true })
    .limit(1)

  let teacherRow = Array.isArray(teacherRows) ? teacherRows[0] : null

  if (!teacherRow?.id && authUser.email) {
    const { data: fallbackRows, error: fallbackError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', authUser.email)
      .order('id', { ascending: true })
      .limit(1)

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message || 'Could not resolve teacher profile.' })
    }

    teacherRow = Array.isArray(fallbackRows) ? fallbackRows[0] : null
  }

  if (!teacherRow?.id || teacherRow.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can update parent email.' })
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

  const { data: enrollmentRow, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select('student_id')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (enrollmentError) {
    return res.status(500).json({ error: enrollmentError.message || 'Could not verify student enrollment.' })
  }

  if (!enrollmentRow?.student_id) {
    return res.status(404).json({ error: 'Student is not enrolled in this class.' })
  }

  const { error: updateError } = await supabaseAdmin.from('users').update({ parent_email: parentEmail || null }).eq('id', studentId)

  if (updateError) {
    if (updateError.code === '42703') {
      return res.status(500).json({
        error: "Parent email storage is not enabled yet. Run `sql/add_parent_email_to_users.sql` (or re-run `sql/fix_classes_rls_and_class_code.sql`) in Supabase to add users.parent_email.",
      })
    }
    return res.status(500).json({ error: updateError.message || 'Could not save parent email.' })
  }

  return res.status(200).json({
    success: true,
    studentId,
    parentEmail: parentEmail || '',
  })
}
