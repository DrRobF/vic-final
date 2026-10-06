import {schoolEducator,studentProfile} from '../../../lib/educator-account.mjs'
import {LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../../../lib/lesson-access.mjs'
import {createClient} from '@supabase/supabase-js'
import {createHash} from 'node:crypto'
import {lessonSignupEnabled,signupEmail,lessonSigninLink} from '../../../lib/lesson-signup.mjs'
export const config={api:{bodyParser:{sizeLimit:'4kb'}},maxDuration:30}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 if(!lessonSignupEnabled(process.env))return res.status(503).json({error:'Email signup is temporarily unavailable.'})
 let email;try{email=signupEmail(req.body)}catch(e){return res.status(400).json({error:e.message})}
 try{
 const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const hash=value=>createHash('sha256').update(value).digest('hex')
 const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim()
 const {data:allowed,error:rateError}=await admin.rpc('claim_lesson_signup_email',{email_bucket:hash(email),ip_bucket:hash(ip)})
 if(rateError)return res.status(503).json({error:'Signup is temporarily unavailable. Please try again later.'})
 if(!allowed){res.setHeader('Retry-After','600');return res.status(429).json({error:'Please wait before requesting another sign-in email.'})}
 const returning=req.body?.intent==='login'
 const school=await admin.from('users').select('role,auth_user_id').eq('email',email).order('id',{ascending:true}).limit(1).maybeSingle()
 if(school.error)throw new Error('Account lookup failed')
 if(studentProfile(school.data))return res.json({success:true})
 if(returning){
  const member=await admin.from('lesson_memberships').select('user_id').eq('email',email).maybeSingle()
  const pending=await admin.from('lesson_signup_consents').select('user_id').eq('email',email).maybeSingle()
  if(member.error||pending.error)throw new Error('Account lookup failed')
  // Do not create an account or reveal whether an address is registered during login.
  if(!member.data&&!pending.data&&!(schoolEducator(school.data)&&school.data.auth_user_id))return res.json({success:true})
 }
 const {data,error}=await admin.auth.admin.generateLink({type:'magiclink',email})
 if(error)return res.status(503).json({error:'Could not prepare your sign-in email. Please try again later.'})
 if(!data.user?.id)return res.status(503).json({error:'Could not prepare your signup. Please try again.'})
 if(!returning){
 const {error:consentError}=await admin.from('lesson_signup_consents').upsert({user_id:data.user.id,email,consent_text:LESSON_CONSENT_TEXT,consent_version:LESSON_CONSENT_VERSION,consented_at:new Date().toISOString()},{onConflict:'user_id'})
 if(consentError)return res.status(503).json({error:'Could not save your signup choices. Please try again.'})
 }
 const link=lessonSigninLink(data.properties,req.body?.next)
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`lesson-signin-${hash(data.properties.hashed_token)}`},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:process.env.REPORTS_FROM_EMAIL,to:[email],subject:'Your secure Ask VIC educator sign-in link',text:`You requested ${returning?'a login to':'free educator access to'} Ask VIC Lesson Designer.\n\nOpen this one-time link to verify your email and sign in:\n${link}\n\n${data.properties.email_otp ? `Or enter this verification code on the page you started from: ${data.properties.email_otp}\n\n` : ''}Your email link signs you in to your educator workspace. Use the same login across your available VIC tools. This link expires according to the account verification settings. If you did not request it, you can ignore this email.\n\nDr. Rob Furman\nAsk VIC Lesson Designer\nhttps://www.askvic.ai/lessonplan`})})
 const sent=await response.json().catch(()=>null)
 if(!response.ok||!sent?.id){console.error('Lesson sign-in email failed',{status:response.status});return res.status(503).json({error:'Could not send your sign-in email. Please try again later.'})}
 return res.json({success:true})
 }catch(error){console.error('Lesson email request failed',{name:error?.name});return res.status(503).json({error:'Could not send your sign-in email. Please try again later.'})}
}
