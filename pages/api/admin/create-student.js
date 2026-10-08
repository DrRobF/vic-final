import {randomBytes} from 'node:crypto'
import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {studentAccountInput} from '../../../lib/single-account.mjs'
export const config={api:{bodyParser:{sizeLimit:'8kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 if(!canManageAccounts(auth,ADMIN_EMAIL))return res.status(403).json({error:'Only the school administrator can create student accounts.'})
 let input;try{input=studentAccountInput(req.body)}catch(e){return res.status(400).json({error:e.message})}
 let authId=null,profileId=null
 try{
  const existing=await auth.admin.from('users').select('id').eq('email',input.email).limit(1)
  if(existing.error)throw existing.error
  if(existing.data.length)return res.status(409).json({error:'That username already has an account. Find the existing student and add them to a class, or choose a different username.'})
  if(input.classIds.length){const found=await auth.admin.from('classes').select('id').in('id',input.classIds);if(found.error)throw found.error;if(found.data.length!==input.classIds.length)return res.status(400).json({error:'A selected classroom no longer exists. Refresh and choose again.'})}
  const password=randomBytes(12).toString('base64url')
  const made=await auth.admin.auth.admin.createUser({email:input.email,password,email_confirm:true,user_metadata:{name:input.name},app_metadata:{student_created_by:auth.user.id,student_created_at:new Date().toISOString()}})
  if(made.error){if(/already|registered|exists/i.test(made.error.message))return res.status(409).json({error:'That login already exists. Use an existing account or a different username.'});throw made.error}
  if(!made.data?.user?.id)throw new Error('No authentication account returned.')
  authId=made.data.user.id
  const profile=await auth.admin.from('users').insert({name:input.name,email:input.email,role:'student',auth_user_id:authId}).select('id,name,email,role').single()
  if(profile.error)throw profile.error
  profileId=profile.data.id
  if(input.classIds.length){const added=await auth.admin.from('enrollments').insert(input.classIds.map(class_id=>({class_id,student_id:profileId,support_level:'core'})));if(added.error)throw added.error}
  return res.status(201).json({account:profile.data,username:input.username,password,enrolledClassIds:input.classIds})
 }catch{
  // A new login is not handed out until its profile and requested enrollments exist.
  let clean=true
  if(profileId){const e=await auth.admin.from('enrollments').delete().eq('student_id',profileId);const p=await auth.admin.from('users').delete().eq('id',profileId);clean=!e.error&&!p.error}
  if(authId&&clean){const removed=await auth.admin.auth.admin.deleteUser(authId);clean=!removed.error}
  return res.status(503).json({error:clean?'Could not create this account. Refresh and try again.':'Account setup stopped partway through. Search this username in Manage accounts before retrying.'})
 }
}
