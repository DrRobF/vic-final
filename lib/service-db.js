import { createClient } from '@supabase/supabase-js'
// Server-only client with the service role, for public endpoints that check their own rules
// (the picture login runs before anyone is signed in).
export function serviceDb() {
 const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
 if (!url || !key) return null
 return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
