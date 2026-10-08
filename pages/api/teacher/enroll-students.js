import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {mayEnroll,searchTerms} from '../../../lib/single-account.mjs'
export const config={api:{bodyParser:{sizeLimit:'8kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 const classId=Number(req.body?.classId),action=req.body?.action
 if(!Number.isSafeInteger(classId)||classId<=0||!['search','add'].includes(action))return res.status(400).json({error:'Choose a valid classroom and action.'})
 try{
  const lookup=await auth.admin.from('classes').select('id,teacher_id').eq('id',classId).maybeSingle()
  if(lookup.error)throw lookup.error
  const isAdmin=canManageAccounts(auth,ADMIN_EMAIL)
  if(!mayEnroll(auth,lookup.data,isAdmin))return res.status(403).json({error:'You can add students only to your own classrooms.'})
  if(action==='search'){
   let terms;try{terms=searchTerms(req.body.q)}catch(e){return res.status(400).json({error:e.message})}
   const find=async words=>{let q=auth.admin.from('users').select('id,name,email').eq('role','student');for(const word of words)q=q.or(`name.ilike.%${word}%,email.ilike.%${word}%`);return q.order('name').limit(30)}
   let result=await find(terms),approximate=false
   if(result.error)throw result.error
   if(!result.data.length&&terms.length>2){result=await find([terms[0],terms[terms.length-1]]);if(result.error)throw result.error;approximate=!!result.data.length}
   return res.json({students:result.data.map(({id,name,email})=>({id,name,username:email?.endsWith('@students.askvic.ai')?email.split('@')[0]:null})),approximate,canCreateAccount:isAdmin})
  }
  const ids=req.body.studentIds
  if(!Array.isArray(ids)||!ids.length||ids.length>100||ids.some(id=>!Number.isSafeInteger(id)||id<=0))return res.status(400).json({error:'Select 1–100 students.'})
  const studentIds=[...new Set(ids)]
  const students=await auth.admin.from('users').select('id').eq('role','student').in('id',studentIds)
  if(students.error)throw students.error
  if(students.data.length!==studentIds.length)return res.status(409).json({error:'A selected account is no longer an active student. Search again.'})
  const current=await auth.admin.from('enrollments').select('student_id').eq('class_id',classId).in('student_id',studentIds)
  if(current.error)throw current.error
  const enrolled=new Set(current.data.map(row=>row.student_id)),missing=studentIds.filter(id=>!enrolled.has(id))
  if(missing.length){const added=await auth.admin.from('enrollments').upsert(missing.map(student_id=>({class_id:classId,student_id,support_level:'core'})),{onConflict:'class_id,student_id',ignoreDuplicates:true}).select('student_id');if(added.error)throw added.error;return res.json({added:added.data.length,alreadyEnrolled:studentIds.length-added.data.length})}
  return res.json({added:missing.length,alreadyEnrolled:studentIds.length-missing.length})
 }catch{return res.status(503).json({error:'Could not search or add students. Refresh the roster before trying again.'})}
}
