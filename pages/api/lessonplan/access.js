import {createClient} from '@supabase/supabase-js'
import {readBearerToken} from '../../../lib/server-auth'
import {verifiedLessonEmail,LESSON_CONSENT_TEXT,LESSON_CONSENT_VERSION} from '../../../lib/lesson-access.mjs'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 if(req.method==='GET'&&!readBearerToken(req))return res.json({signupEnabled:process.env.LESSON_PUBLIC_SIGNUP_ENABLED==='true'})
 if(req.method==='POST'&&req.body?.unsubscribe!==true&&process.env.LESSON_PUBLIC_SIGNUP_ENABLED!=='true')return res.status(503).json({error:'Public signup is not open yet. We are completing email delivery and account access setup.'})
 try{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY
 if(!url||!key||!service)return res.status(503).json({error:'Signup is temporarily unavailable.'})
 const token=readBearerToken(req);if(!token)return res.status(401).json({error:'Sign in or verify your email first.'})
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const client=createClient(url,key,options),admin=createClient(url,service,options)
 const {data:{user},error}=await client.auth.getUser(token)
 if(error||!user)return res.status(401).json({error:'Your session expired. Please sign in again.'})
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
 if(req.body?.consent!==true||req.body?.adultEducator!==true)return res.status(400).json({error:'Confirm that you are an adult educator and agree to receive the updates described.'})
 const {error:saveError}=await admin.from('lesson_memberships').upsert({user_id:user.id,email:user.email,newsletter_consent:true,consent_text:LESSON_CONSENT_TEXT,consent_version:LESSON_CONSENT_VERSION,consented_at:new Date().toISOString(),unsubscribed_at:null},{onConflict:'user_id'})
 if(saveError)throw saveError
 return res.json({success:true})
 }catch(error){console.error('Lesson signup failed',{name:error?.name});return res.status(503).json({error:'Could not save your signup. Please try again.'})}
}
