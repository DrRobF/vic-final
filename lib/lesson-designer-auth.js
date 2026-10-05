import { requiresPasswordChange } from './password-policy.mjs'
import { createClient } from '@supabase/supabase-js'
import { readBearerToken } from './server-auth'
export async function requireLessonEducator(req) {
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY
 if (!url || !key || !service) return {status:503,error:'Account verification is temporarily unavailable.'}
 const token=readBearerToken(req)
 if (!token) return {status:401,error:'Sign in with your approved Ask VIC teacher or principal account to create a lesson.'}
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const client=createClient(url,key,options)
 const {data:{user},error}=await client.auth.getUser(token)
 if(error || !user) return {status:401,error:'Your session has expired. Please sign in again.'}
 if (requiresPasswordChange(user)) return {status:403,error:'Choose your personal password before using VIC.', passwordChangeRequired:true}
 const admin=createClient(url,service,options)
 const {data:profile,error:profileError}=await admin.from('users').select('id,role').eq('auth_user_id',user.id).order('id',{ascending:true}).limit(1).maybeSingle()
 if(profileError) return {status:503,error:'Could not verify your educator account.'}
 if(!profile?.id || !['teacher','principal'].includes(String(profile.role).toLowerCase())) return {status:403,error:'Lesson Designer requires an approved teacher or principal account.'}
 return {user,profile}
}

