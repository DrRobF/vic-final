import {schoolEducator,studentProfile} from '../../../lib/educator-account.mjs'
import {lessonSignupEnabled} from '../../../lib/lesson-signup.mjs'
import {createClient} from '@supabase/supabase-js'
import {readBearerToken} from '../../../lib/server-auth'
import {verifiedLessonEmail,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../../../lib/lesson-access.mjs'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 if(req.method==='GET'&&!readBearerToken(req))return res.json({signupEnabled:lessonSignupEnabled(process.env)})
 if(req.method==='POST'&&req.body?.unsubscribe!==true&&!lessonSignupEnabled(process.env))return res.status(503).json({error:'Public signup is not open yet. We are completing email delivery and account access setup.'})
 try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key||!service)return res.status(503).json({error:'Signup is temporarily unavailable.'})
 const token=readBearerToken(req);if(!token)return res.status(401).json({error:'Sign in or verify your email first.'})
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const client=createClient(url,key,options),admin=createClient(url,service,options)
 const {data:{user},error}=await client.auth.getUser(token)
 if(error||!user)return res.status(401).json({error:'Your session expired. Please sign in again.'})
 const profileLookup=await admin.from('users').select('id,role').eq('auth_user_id',user.id).order('id',{ascending:true}).limit(1).maybeSingle()
 if(profileLookup.error)throw profileLookup.error
 if(studentProfile(profileLookup.data))return res.status(403).json({error:'Students use the separate student VIC workspace.'})
 if(req.body?.completeFromEmail===true&&schoolEducator(profileLookup.data))return res.json({success:true})
 if(!verifiedLessonEmail(user))return res.status(403).json({error:'Confirm your email before completing signup.'})
 if(req.method==='GET'){
 const {data,error}=await admin.from('lesson_memberships').select('newsletter_consent,consented_at').eq('user_id',user.id).maybeSingle()
 if(error)throw error
 return res.json({enrolled:!!data,newsletterConsent:data?.newsletter_consent??false})
 }
 if(req.body?.unsubscribe===true){
 const {error}=await admin.from('lesson_memberships').update({newsletter_consent:false,unsubscribed_at:new Date().toISOString()}).eq('user_id',user.id)
 if(error)throw error
 return res.json({success:true})
 }
 let consentRecord={consent_text:LESSON_CONSENT_TEXT,consent_version:LESSON_CONSENT_VERSION,consented_at:new Date().toISOString()}
 if(req.body?.completeFromEmail===true){
 const {data:existing,error:existingError}=await admin.from('lesson_memberships').select('user_id').eq('user_id',user.id).maybeSingle()
 if(existingError)throw existingError
 if(existing)return res.json({success:true})
 const {data:pending,error:pendingError}=await admin.from('lesson_signup_consents').select('email,consent_text,consent_version,consented_at').eq('user_id',user.id).maybeSingle()
 if(pendingError)throw pendingError
 if(!pending||pending.email.toLowerCase()!==user.email.toLowerCase()||Date.now()-new Date(pending.consented_at).getTime()>86400000)return res.status(409).json({error:'Your email is verified. Please confirm the signup checkboxes once to finish access.',needsConsent:true})
 consentRecord={consent_text:pending.consent_text,consent_version:pending.consent_version,consented_at:pending.consented_at}
 }else if(req.body?.consent!==true||req.body?.adultEducator!==true)return res.status(400).json({error:'Confirm that you are an adult educator and agree to receive the updates described.'})
 const {error:saveError}=await admin.from('lesson_memberships').upsert({user_id:user.id,email:user.email,newsletter_consent:true,...consentRecord,unsubscribed_at:null},{onConflict:'user_id'})
 if(saveError)throw saveError
 return res.json({success:true})
 }catch(error){console.error('Lesson signup failed',{name:error?.name});return res.status(503).json({error:'Could not save your signup. Please try again.'})}
}
