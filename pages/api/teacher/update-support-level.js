import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ALLOWED_SUPPORT_LEVELS = new Set(['remediation', 'on_level', 'on-level', 'core', 'enrichment'])

function normalizeSupportLevel(value) {
  if (value === 'on-level' || value === 'on_level' || value === 'core') return 'on_level'
  if (value === 'remediation' || value === 'enrichment') return value
  return null
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  const [scheme, token] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
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
  const supportLevelRaw = typeof req.body?.supportLevel === 'string' ? req.body.supportLevel.trim() : ''
  const supportLevel = normalizeSupportLevel(supportLevelRaw)

  const classId = typeof classIdRaw === 'number' ? classIdRaw : Number(classIdRaw)
  const studentId = typeof studentIdRaw === 'number' ? studentIdRaw : Number(studentIdRaw)

  if (!Number.isInteger(classId) || classId <= 0) {
    return res.status(400).json({ error: 'A valid classId is required.' })
  }

  if (!Number.isInteger(studentId) || studentId <= 0) {
    return res.status(400).json({ error: 'A valid studentId is required.' })
  }

  if (!ALLOWED_SUPPORT_LEVELS.has(supportLevelRaw) || !supportLevel) {
    return res.status(400).json({ error: 'supportLevel must be remediation, on_level, or enrichment.' })
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
    return res.status(403).json({ error: 'Only teacher accounts can update support level.' })
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

  const { data: enrollmentRow, error: enrollmentLookupError } = await supabaseAdmin
    .from('enrollments')
    .select('id')
    .eq('class_id', classId)
    .eq('student_id', studentId)
    .maybeSingle()

  if (enrollmentLookupError) {
    return res.status(500).json({ error: enrollmentLookupError.message || 'Could not verify enrollment.' })
  }

  if (!enrollmentRow?.id) {
    return res.status(404).json({ error: 'Student is not enrolled in this class.' })
  }

  const { error: updateError } = await supabaseAdmin
    .from('enrollments')
    .update({ support_level: supportLevel })
    .eq('class_id', classId)
    .eq('student_id', studentId)

  if (updateError) {
    return res.status(500).json({ error: updateError.message || 'Could not update support level.' })
  }

  return res.status(200).json({ success: true })
}
