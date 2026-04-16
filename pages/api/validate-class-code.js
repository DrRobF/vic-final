import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server is not configured for class validation.' })
  }

  const classCodeInput = typeof req.body?.classCode === 'string' ? req.body.classCode : ''
  const normalizedClassCode = classCodeInput.trim().toUpperCase()

  if (!normalizedClassCode) {
    return res.status(400).json({ error: 'Class code is required.' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  const { data: classRow, error: classLookupError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('class_code', normalizedClassCode)
    .maybeSingle()

  if (classLookupError) {
    return res.status(500).json({ error: classLookupError.message || 'Could not validate class code.' })
  }

  if (!classRow?.id) {
    return res.status(404).json({ error: 'Invalid class code.' })
  }

  return res.status(200).json({ id: classRow.id })
}
