import { createClient } from '@supabase/supabase-js'

function normalizeNumericId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

async function loadAssignmentRowsByField(supabaseAdmin, fieldName, studentId) {
  const queryPlans = [
    {
      select:
        'id, student_id, user_id, lesson_id, mode, status, assigned_at, created_at, lessons:lesson_id (id, subject, title, lesson_text, is_active)',
      orderByCreatedAt: true,
    },
    {
      select: 'id, student_id, user_id, lesson_id, mode, status, assigned_at, created_at',
      orderByCreatedAt: true,
    },
    {
      select: 'id, student_id, user_id, lesson_id, mode, status, assigned_at',
      orderByCreatedAt: false,
    },
  ]

  for (const plan of queryPlans) {
    let query = supabaseAdmin
      .from('assignments')
      .select(plan.select)
      .eq(fieldName, studentId)
      .order('assigned_at', { ascending: false, nullsFirst: false })

    if (plan.orderByCreatedAt) {
      query = query.order('created_at', { ascending: false, nullsFirst: false })
    }

    const { data, error } = await query.order('id', { ascending: false }).limit(20)

    if (!error) {
      return { rows: Array.isArray(data) ? data : [], mode: `matched_by_${fieldName}`, error: null }
    }

    if (error.code !== '42703') {
      return { rows: [], mode: `query_failed_${fieldName}`, error }
    }
  }

  return { rows: [], mode: `column_unavailable_${fieldName}`, error: null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server environment is not configured.' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' })
  }

  const supabaseAuth = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
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

  const { data: profileRowsByAuth } = await supabaseAdmin
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

  const byStudentId = await loadAssignmentRowsByField(supabaseAdmin, 'student_id', resolvedStudentId)

  if (byStudentId.rows.length > 0) {
    return res.status(200).json({ rows: byStudentId.rows, mode: byStudentId.mode, resolvedStudentId })
  }

  const byUserId = await loadAssignmentRowsByField(supabaseAdmin, 'user_id', resolvedStudentId)

  return res.status(200).json({
    rows: byUserId.rows,
    mode: byUserId.mode,
    resolvedStudentId,
    fallbackFrom: byStudentId.mode,
  })
}
