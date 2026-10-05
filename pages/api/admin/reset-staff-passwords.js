import { requireApprovedProfile } from '../../../lib/server-auth'
import { ADMIN_EMAIL } from '../../../lib/roster-import'

const STAFF_IDS = [86, 87, 88, 89, 90, 91]
const BATCH = 'spa-staff-onboarding-2026-10-05'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.user.email?.toLowerCase() !== ADMIN_EMAIL || auth.profile.email?.toLowerCase() !== ADMIN_EMAIL || auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only the school account administrator can reset staff passwords.' })
  const { data: staff, error } = await auth.admin.from('users').select('id,name,email,auth_user_id,role').in('id', STAFF_IDS).eq('role', 'teacher')
  if (error || staff?.length !== 6 || staff.some(row => !row.auth_user_id || row.auth_user_id === auth.user.id || row.email.toLowerCase() === ADMIN_EMAIL)) return res.status(409).json({ error: 'The six staff accounts could not be verified. No passwords were changed.' })
  if (req.method === 'GET') return res.status(200).json({ staff: staff.map(({ name, email }) => ({ name, email })) })
  if (req.body?.confirm !== 'reset-six-staff' || req.body?.password !== 'spa2026') return res.status(400).json({ error: 'Confirm the staff-only reset and temporary password.' })
  const results = []
  for (const row of staff) {
    const { data: account, error: lookupError } = await auth.admin.auth.admin.getUserById(row.auth_user_id)
    const user = account?.user
    if (lookupError || !user || user.email?.toLowerCase() !== row.email.toLowerCase() || user.id === auth.user.id) { results.push({ name: row.name, status: 'failed' }); continue }
    if (user.app_metadata?.temporary_password_batch === BATCH) { results.push({ name: row.name, status: 'already reset' }); continue }
    const { error: updateError } = await auth.admin.auth.admin.updateUserById(user.id, {
      password: req.body.password,
      app_metadata: { ...user.app_metadata, must_change_password: true, temporary_password_batch: BATCH },
    })
    results.push({ name: row.name, status: updateError ? 'failed' : 'reset' })
  }
  return res.status(200).json({ results, complete: results.every(row => row.status !== 'failed') })
}
