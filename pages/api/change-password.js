import { createClient } from '@supabase/supabase-js'
import { readBearerToken } from '../../lib/server-auth'
import { newPasswordError, requiresPasswordChange } from '../../lib/password-policy.mjs'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }) }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || !secret) return res.status(503).json({ error: 'Account verification is temporarily unavailable.' })
  const token = readBearerToken(req)
  if (!token) return res.status(401).json({ error: 'Please sign in again.' })
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const client = createClient(url, key, options)
  const { data: { user }, error } = await client.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Please sign in again.' })
  if (!requiresPasswordChange(user)) return res.status(409).json({ error: 'This account does not need a first-login password change.' })
  const passwordError = newPasswordError(req.body?.password)
  if (passwordError) return res.status(400).json({ error: passwordError })
  const admin = createClient(url, secret, options)
  const { data: profile, error: profileError } = await admin.from('users').select('role').eq('auth_user_id', user.id).limit(1).maybeSingle()
  if (profileError) return res.status(503).json({ error: 'Could not verify account access.' })
  if (!profile || !['teacher', 'principal'].includes(profile.role)) return res.status(403).json({ error: 'An approved staff account is required.' })
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: req.body.password,
    app_metadata: { ...user.app_metadata, must_change_password: false, password_changed_at: new Date().toISOString() },
  })
  if (updateError) return res.status(400).json({ error: 'Could not save this password. Choose a stronger password and try again.' })
  return res.status(200).json({ success: true })
}
