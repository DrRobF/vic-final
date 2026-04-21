import { createClient } from '@supabase/supabase-js'
import { buildReportEmailText, buildReportHtml } from '../../lib/report-format'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const resendApiKey = process.env.RESEND_API_KEY
const reportsFromEmail = process.env.REPORTS_FROM_EMAIL

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

async function resolveTeacherEmail({ requesterProfile, supabaseAdmin }) {
  if (!requesterProfile?.id) return ''

  if (requesterProfile.role === 'teacher') {
    return requesterProfile.email || ''
  }

  if (requesterProfile.role !== 'student') {
    return ''
  }

  const { data: enrollmentRows, error: enrollmentError } = await supabaseAdmin
    .from('enrollments')
    .select('class_id')
    .eq('student_id', requesterProfile.id)
    .order('class_id', { ascending: true })
    .limit(1)

  if (enrollmentError) {
    throw new Error(enrollmentError.message || 'Could not resolve class enrollment.')
  }

  const enrollmentRow = Array.isArray(enrollmentRows) ? enrollmentRows[0] : null
  if (!enrollmentRow?.class_id) return ''

  const { data: classRow, error: classError } = await supabaseAdmin
    .from('classes')
    .select('teacher_id')
    .eq('id', enrollmentRow.class_id)
    .maybeSingle()

  if (classError) {
    throw new Error(classError.message || 'Could not resolve class teacher.')
  }

  if (!classRow?.teacher_id) return ''

  const { data: teacherRow, error: teacherError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', classRow.teacher_id)
    .maybeSingle()

  if (teacherError) {
    throw new Error(teacherError.message || 'Could not resolve teacher email.')
  }

  return teacherRow?.email || ''
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is missing Supabase configuration.' })
  }

  if (!resendApiKey || !reportsFromEmail) {
    return res.status(500).json({ error: 'Email delivery is not configured on the server.' })
  }

  const accessToken = getBearerToken(req)
  if (!accessToken) {
    return res.status(401).json({ error: 'Missing access token.' })
  }

  const reportPayload = req.body?.reportPayload
  if (!reportPayload || typeof reportPayload !== 'object' || !reportPayload.report) {
    return res.status(400).json({ error: 'A valid reportPayload is required.' })
  }

  const requestedParentEmail = parseOptionalEmail(req.body?.parentEmail)
  if (requestedParentEmail && !isValidEmail(requestedParentEmail)) {
    return res.status(400).json({ error: 'parentEmail is not valid.' })
  }

  const explicitTeacherEmail = parseOptionalEmail(req.body?.teacherEmail)
  if (explicitTeacherEmail && !isValidEmail(explicitTeacherEmail)) {
    return res.status(400).json({ error: 'teacherEmail is not valid.' })
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

  const { data: profileRows } = await supabaseAdmin
    .from('users')
    .select('id, email, role')
    .eq('auth_user_id', authUser.id)
    .order('id', { ascending: true })
    .limit(1)

  let requesterProfile = Array.isArray(profileRows) ? profileRows[0] : null

  if (!requesterProfile?.id && authUser.email) {
    const { data: fallbackRows, error: fallbackError } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('email', authUser.email)
      .order('id', { ascending: true })
      .limit(1)

    if (fallbackError) {
      return res.status(500).json({ error: fallbackError.message || 'Could not resolve requester profile.' })
    }

    requesterProfile = Array.isArray(fallbackRows) ? fallbackRows[0] : null
  }

  let resolvedTeacherEmail = ''

  try {
    resolvedTeacherEmail = await resolveTeacherEmail({ requesterProfile, supabaseAdmin })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Could not resolve teacher email.' })
  }

  const teacherRecipient = resolvedTeacherEmail || explicitTeacherEmail

  if (!teacherRecipient || !isValidEmail(teacherRecipient)) {
    return res.status(400).json({ error: 'Could not resolve a valid teacher email recipient.' })
  }

  const recipients = Array.from(new Set([teacherRecipient, requestedParentEmail].filter(Boolean)))

  const html = buildReportHtml(reportPayload)
  const text = buildReportEmailText(reportPayload)

  const studentName = reportPayload?.studentName || 'Student'
  const date = reportPayload?.date || new Date().toISOString().slice(0, 10)

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: reportsFromEmail,
      to: recipients,
      subject: `VIC Learning Report: ${studentName} (${date})`,
      html,
      text,
    }),
  })

  const resendData = await resendResponse.json()

  if (!resendResponse.ok) {
    return res.status(resendResponse.status).json({
      error: resendData?.message || 'Email provider rejected the request.',
      provider: resendData,
    })
  }

  return res.status(200).json({
    success: true,
    recipients,
    providerMessageId: resendData?.id || null,
    teacherEmail: teacherRecipient,
    parentEmail: requestedParentEmail || null,
    deliveryFormat: 'html_text',
  })
}
