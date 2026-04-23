import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !publishableKey) {
    return res.status(500).json({ error: 'Supabase server environment is not configured' })
  }

  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' })
  }

  const classCode = typeof req.body?.classCode === 'string' ? req.body.classCode.trim() : ''
  if (!classCode) {
    return res.status(400).json({ error: 'classCode is required' })
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: {
      headers: {
        Authorization: req.headers.authorization,
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { data: studentRow, error: studentError } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', authUser.id)
      .eq('role', 'student')
      .maybeSingle()

    if (studentError) {
      return res.status(500).json({ error: 'Failed to resolve student' })
    }

    if (!studentRow?.id) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const studentId = studentRow.id

    const { data: classRow, error: classError } = await supabase
      .from('classes')
      .select('id')
      .eq('code', classCode)
      .maybeSingle()

    if (classError) {
      return res.status(500).json({ error: 'Failed to look up class' })
    }

    if (!classRow?.id) {
      return res.status(404).json({ error: 'Invalid class code' })
    }

    const classId = classRow.id

    const { data: enrollmentRow, error: enrollmentCheckError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .maybeSingle()

    if (enrollmentCheckError) {
      return res.status(500).json({ error: 'Failed to verify enrollment' })
    }

    if (enrollmentRow?.id) {
      return res.status(200).json({ success: true, message: 'Already enrolled' })
    }

    const { error: insertError } = await supabase
      .from('enrollments')
      .insert({ student_id: studentId, class_id: classId })

    if (insertError) {
      return res.status(500).json({ error: 'Failed to join class' })
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    return res.status(500).json({ error: 'Unexpected server error' })
  }
}
