import {accountUnavailable} from './admin-management.mjs'
import { requiresPasswordChange } from './password-policy.mjs'
import { createClient } from '@supabase/supabase-js'
import { readBearerToken } from './server-auth'

function serverClient(key) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function requirePrincipal(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !publishable || !service) return { status: 500, error: 'Server authentication is not configured.' }
  const token = readBearerToken(req)
  if (!token) return { status: 401, error: 'Sign in to continue.' }
  const { data: { user }, error } = await serverClient(publishable).auth.getUser(token)
  if (error || !user?.id) return { status: 401, error: 'Invalid or expired session.' }
 if(accountUnavailable(user))return {status:403,error:'This account has been removed. Contact your school administrator.'}
  if (requiresPasswordChange(user)) return { status: 403, error: 'Choose your personal password before using VIC.', passwordChangeRequired: true }
  const admin = serverClient(service)
  const { data: profile, error: profileError } = await admin.from('users')
    .select('id, role, name').eq('auth_user_id', user.id).limit(1).maybeSingle()
  if (profileError) return { status: 500, error: 'Could not verify account access.' }
  if (!profile?.id || !['principal', 'teacher'].includes(String(profile.role || '').toLowerCase())) {
    return { status: 403, error: 'An approved school leader account is required.' }
  }
  const { data: entitlement, error: licenseError } = await admin.from('ap_entitlements')
    .select('status,school_limit,expires_at').eq('auth_user_id', user.id).limit(1).maybeSingle()
  if (licenseError) return { status: 500, error: 'Could not verify Assistant Principal access.' }
  if (!entitlement || !['trial', 'active'].includes(entitlement.status) || (entitlement.expires_at && Date.parse(entitlement.expires_at) <= Date.now())) {
    return { status: 403, error: 'An active Assistant Principal license or trial is required.' }
  }
  return { admin, user, profile, entitlement }
}

export async function requireSchool(auth, schoolId) {
  if (typeof schoolId !== 'string' || !/^[0-9a-f-]{36}$/i.test(schoolId)) {
    return { status: 400, error: 'Choose a school.' }
  }
  const { data, error } = await auth.admin.from('ap_memberships')
    .select('role').eq('school_id', schoolId).eq('auth_user_id', auth.user.id).maybeSingle()
  if (error) return { status: 500, error: 'Could not verify school access.' }
  if (!data) return { status: 403, error: 'You do not have access to this school.' }
  return { schoolId, role: data.role }
}

