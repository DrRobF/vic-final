import {createClient} from '@supabase/supabase-js'
import {createHash} from 'node:crypto'
import {lessonSignupEnabled} from '../../../lib/lesson-signup.mjs'
import {codeRequest} from '../../../lib/lesson-code.mjs'
import {accountForEmail} from '../../../lib/email-aliases.mjs'
export const config={api:{bodyParser:{sizeLimit:'4kb'}},maxDuration:30}

// Verify the six-digit code from a sign-in email.
//
// This runs on the server because of aliases. A teacher who signed up with a personal
// address and now uses the school one types the school address; Supabase issued the code
// against the address it knows the account by. Only the server can match those up, and it
// does so without ever sending the other address to the browser.
//
// Everything that fails -- wrong code, expired code, unknown address -- answers the same
// way, so this cannot be used to find out which addresses have accounts.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 if(!lessonSignupEnabled(process.env))return res.status(503).json({error:'Email sign-in is temporarily unavailable.'})
 let email,code;try{({email,code}=codeRequest(req.body))}catch(e){return res.status(400).json({error:e.message})}
 const wrong='This code expired or is incorrect. Use your latest email or request a new one.'
 try{
  const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  const hash=value=>createHash('sha256').update(value).digest('hex')
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
  // A six-digit code is guessable if somebody may keep trying. Attempts have their own budget.
  const {data:allowed,error:rateError}=await admin.rpc('claim_lesson_code_attempt',{email_bucket:hash(email),ip_bucket:hash(ip)})
  if(rateError)return res.status(503).json({error:'Sign-in is temporarily unavailable. Please try again later.'})
  if(!allowed){res.setHeader('Retry-After','600');return res.status(429).json({error:'Too many attempts. Please wait, then request a new sign-in email.'})}
  // The address the code was actually issued against: their own, or the account an alias reaches.
  const found=await accountForEmail(admin,email,'id,email')
  const verifyAs=found?.viaAlias?found.profile.email:email
  const anon=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})
  const {data,error}=await anon.auth.verifyOtp({email:verifyAs,token:code,type:'email'})
  if(error||!data?.session?.access_token||!data?.session?.refresh_token)return res.status(400).json({error:wrong})
  return res.json({access_token:data.session.access_token,refresh_token:data.session.refresh_token})
 }catch(error){console.error('Lesson code verification failed',{name:error?.name});return res.status(503).json({error:'Could not check your code. Please try again later.'})}
}
