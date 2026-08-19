import { requireApprovedProfile } from '../../../lib/server-auth'
import { ADMIN_EMAIL, validateRosterRows } from '../../../lib/roster-import'

function safeError(error, fallback) {
  const message = String(error?.message || '')
  if (/duplicate|already registered|already exists/i.test(message)) return 'An account with this username already exists.'
  return fallback
}

async function requireRosterAdmin(req) {
  const auth = await requireApprovedProfile(req)
  if (auth.error) return auth
  const authEmail = String(auth.user?.email || '').toLowerCase()
  const profileEmail = String(auth.profile?.email || '').toLowerCase()
  if (auth.profile.role !== 'teacher' || authEmail !== ADMIN_EMAIL || profileEmail !== ADMIN_EMAIL) {
    return { status: 403, error: 'Roster importing is restricted to the approved administrator.' }
  }
  return auth
}

async function findAuthUserByEmail(admin, email) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    const found = data?.users?.find((user) => user.email?.toLowerCase() === email)
    if (found) return found
    if ((data?.users?.length || 0) < 1000) break
  }
  return null
}

async function importRow(admin, row, classesByCode) {
  const classIds = row.classCodes.map((code) => classesByCode.get(code)).filter(Boolean)
  if (classIds.length !== row.classCodes.length) throw new Error(`Required classes are missing: ${row.classCodes.filter((code) => !classesByCode.has(code)).join(', ')}`)

  const { data: profileRows, error: profileLookupError } = await admin.from('users')
    .select('id, name, email, role, auth_user_id').eq('email', row.email).limit(1)
  if (profileLookupError) throw profileLookupError
  let profile = profileRows?.[0] || null
  let authUser = profile?.auth_user_id ? { id: profile.auth_user_id } : await findAuthUserByEmail(admin, row.email)
  let createdAuth = false
  let changed = false

  if (!authUser) {
    const { data, error } = await admin.auth.admin.createUser({
      email: row.email,
      password: row.password,
      email_confirm: true,
      user_metadata: { name: row.name, role: 'student' },
    })
    if (error || !data?.user?.id) throw new Error(safeError(error, 'Could not create the student authentication account.'))
    authUser = data.user
    createdAuth = true
    changed = true
  }

  try {
    if (!profile) {
      const { data, error } = await admin.from('users').insert({
        name: row.name, email: row.email, role: 'student', auth_user_id: authUser.id,
      }).select('id, name, email, role, auth_user_id').single()
      if (error) throw error
      profile = data
      changed = true
    } else {
      const patch = {}
      if (profile.name !== row.name) patch.name = row.name
      if (profile.role !== 'student') patch.role = 'student'
      if (profile.auth_user_id !== authUser.id) patch.auth_user_id = authUser.id
      if (Object.keys(patch).length) {
        const { data, error } = await admin.from('users').update(patch).eq('id', profile.id)
          .select('id, name, email, role, auth_user_id').single()
        if (error) throw error
        profile = data
        changed = true
      }
    }

    const { data: enrollments, error: enrollmentError } = await admin.from('enrollments')
      .select('class_id').eq('student_id', profile.id).in('class_id', classIds)
    if (enrollmentError) throw enrollmentError
    const enrolled = new Set((enrollments || []).map((item) => String(item.class_id)))
    const missing = classIds.filter((id) => !enrolled.has(String(id)))
    if (missing.length) {
      const { error } = await admin.from('enrollments').insert(
        missing.map((classId) => ({ student_id: profile.id, class_id: classId, support_level: 'core' }))
      )
      if (error) throw error
      changed = true
    }
  } catch (error) {
    if (createdAuth) await admin.auth.admin.deleteUser(authUser.id)
    throw error
  }

  return createdAuth ? 'created' : changed ? 'updated' : 'alreadyExisting'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })
  const auth = await requireRosterAdmin(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })

  const mode = req.body?.mode
  if (!['preview', 'import'].includes(mode)) return res.status(400).json({ error: 'Invalid import mode.' })
  const validation = validateRosterRows(req.body?.rows)
  if (validation.error) return res.status(400).json({ error: validation.error })
  if (!validation.rows.length) return res.status(400).json({ error: 'The CSV does not contain any student rows.' })

  if (mode === 'preview') {
    return res.status(200).json({
      rows: validation.rows.map(({ password, ...row }) => row),
      summary: {
        total: validation.rows.length,
        valid: validation.rows.filter((row) => row.valid).length,
        skipped: validation.rows.filter((row) => !row.valid).length,
      },
    })
  }

  const validRows = validation.rows.filter((row) => row.valid)
  const requestedCodes = [...new Set(validRows.flatMap((row) => row.classCodes))]
  const { data: classes, error: classError } = await auth.admin.from('classes').select('id, class_code').in('class_code', requestedCodes)
  if (classError) return res.status(500).json({ error: 'Could not load the destination classes.' })
  const classesByCode = new Map((classes || []).map((item) => [item.class_code, item.id]))
  const results = []

  for (const row of validation.rows) {
    if (!row.valid) {
      results.push({ rowNumber: row.rowNumber, username: row.username, email: row.email, status: 'skipped', error: row.errors.join(' ') })
      continue
    }
    try {
      const status = await importRow(auth.admin, row, classesByCode)
      results.push({ rowNumber: row.rowNumber, username: row.username, email: row.email, status, error: '' })
    } catch (error) {
      results.push({ rowNumber: row.rowNumber, username: row.username, email: row.email, status: 'failed', error: safeError(error, 'The account, profile, or enrollment could not be completed.') })
    }
  }
  const counts = ['created', 'alreadyExisting', 'updated', 'skipped', 'failed'].reduce((result, key) => ({ ...result, [key]: results.filter((row) => row.status === key).length }), {})
  return res.status(200).json({ results, counts })
}
