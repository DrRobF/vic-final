import { requireApprovedProfile } from '../../../lib/server-auth'
import { ADMIN_EMAIL } from '../../../lib/roster-import'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  const auth = await requireApprovedProfile(req)
  if (auth.error) return res.status(auth.status).json({ error: auth.error })
  if (auth.user.email?.toLowerCase() !== ADMIN_EMAIL || auth.profile.email?.toLowerCase() !== ADMIN_EMAIL || auth.profile.role !== 'teacher') return res.status(403).json({ error: 'Only the school account administrator can reset the demo account.' })
  if (req.body?.confirm !== 'reset-jake-demo' || req.body?.password !== 'spa2026') return res.status(400).json({ error: 'Confirm the Jake demo reset.' })
  const { data: profile, error } = await auth.admin.from('users').select('auth_user_id,email,role').eq('id', 2).eq('email', 'jake@example.com').eq('role', 'student').maybeSingle()
  if (error || !profile?.auth_user_id || profile.auth_user_id === auth.user.id) return res.status(409).json({ error: 'Could not verify Jake’s demo account. No password was changed.' })
  const { data: account, error: lookupError } = await auth.admin.auth.admin.getUserById(profile.auth_user_id)
  if (lookupError || account?.user?.email !== 'jake@example.com') return res.status(409).json({ error: 'Jake’s login did not match the demo profile.' })
  const { error: updateError } = await auth.admin.auth.admin.updateUserById(profile.auth_user_id, {
    password: req.body.password, app_metadata: { ...account.user.app_metadata, must_change_password: false },
  })
  if (updateError) return res.status(400).json({ error: 'Could not reset Jake’s password. Please try again.' })
  return res.status(200).json({ success: true, email: 'jake@example.com' })
}
