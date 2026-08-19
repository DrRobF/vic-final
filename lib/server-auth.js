import { createClient } from '@supabase/supabase-js'

function serverClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function readBearerToken(req) {
  const match = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}

export async function requireApprovedProfile(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !publishableKey || !serviceRoleKey) {
    return { status: 500, error: 'Server authentication is not configured.' }
  }

  const token = readBearerToken(req)
  if (!token) return { status: 401, error: 'Missing access token.' }

  const authClient = serverClient(publishableKey)
  const admin = serverClient(serviceRoleKey)
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user?.id) return { status: 401, error: 'Invalid or expired session.' }

  const { data, error: profileError } = await admin
    .from('users')
    .select('id, auth_user_id, email, name, role, interest_tags')
    .eq('auth_user_id', user.id)
    .order('id', { ascending: true })
    .limit(1)

  if (profileError) return { status: 500, error: 'Could not verify the user profile.' }
  const profile = data?.[0]
  const role = typeof profile?.role === 'string' ? profile.role.toLowerCase() : ''
  if (!profile?.id || !['teacher', 'student'].includes(role)) {
    return { status: 403, error: 'This account is not approved to use VIC.' }
  }

  return { token, user, profile: { ...profile, role }, admin }
}
