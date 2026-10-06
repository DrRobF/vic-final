import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {classroomPatch,enrollmentAction} from '../../../lib/admin-management.mjs'
export const config={api:{bodyParser:{sizeLimit:'8kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST','PATCH','PUT'].includes(req.method)){res.setHeader('Allow','GET, POST, PATCH, PUT');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 if(!canManageAccounts(auth,ADMIN_EMAIL))return res.status(403).json({error:'Only the approved school administrator can manage classrooms.'})
 try{
  if(req.method==='GET'){
   const classId=Number(req.query.classId)
   if(req.query.classId){
    if(!Number.isSafeInteger(classId)||classId<=0)return res.status(400).json({error:'Choose a valid classroom.'})
    const cl=await auth.admin.from('classes').select('id,class_name,teacher_id,grade_level,class_code').eq('id',classId).maybeSingle()
    if(cl.error)throw cl.error;if(!cl.data)return res.status(404).json({error:'Classroom not found.'})
    const enrollments=await auth.admin.from('enrollments').select('student_id,support_level').eq('class_id',classId)
    if(enrollments.error)throw enrollments.error
    const ids=[...new Set((enrollments.data||[]).map(r=>r.student_id))]
    const students=ids.length?await auth.admin.from('users').select('id,name,email,role').in('id',ids).order('name'):{data:[]}
    if(students.error)throw students.error
    return res.json({classroom:cl.data,students:students.data||[]})
   }
   const classes=await auth.admin.from('classes').select('id,class_name,teacher_id,grade_level,class_code').order('class_name').limit(1001)
   if(classes.error)throw classes.error
   if(classes.data.length>1000)return res.status(409).json({error:'More than 1,000 classrooms require a paginated school directory.'})
   const teachers=await auth.admin.from('users').select('id,name,email,role').in('role',['teacher','archived']).order('name').limit(1001)
   if(teachers.error)throw teachers.error
   return res.json({classrooms:classes.data||[],teachers:teachers.data||[]})
  }
  if(['POST','PATCH'].includes(req.method)){
   let patch;try{patch=classroomPatch(req.body)}catch(e){return res.status(400).json({error:e.message})}
   const teacher=await auth.admin.from('users').select('id').eq('id',patch.teacher_id).eq('role','teacher').maybeSingle()
   if(teacher.error)throw teacher.error;if(!teacher.data)return res.status(400).json({error:'Choose an active teacher account.'})
   let result
   if(req.method==='POST')result=await auth.admin.from('classes').insert(patch).select('id,class_name,teacher_id,grade_level,class_code').single()
   else{
    const id=Number(req.body.id);if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Choose a classroom to edit.'})
    const current=await auth.admin.from('classes').select('teacher_id').eq('id',id).maybeSingle()
    if(current.error)throw current.error
    if(!current.data)return res.status(404).json({error:'Classroom not found.'})
    if(current.data.teacher_id!==patch.teacher_id)return res.status(409).json({error:'A classroom’s teacher cannot be changed here. Create a classroom for the new teacher and move the roster as needed.'})
    result=await auth.admin.from('classes').update(patch).eq('id',id).select('id,class_name,teacher_id,grade_level,class_code').maybeSingle()
   }
   if(result.error)throw result.error;if(!result.data)return res.status(404).json({error:'Classroom not found.'})
   return res.json({success:true,classroom:result.data})
  }
  let action;try{action=enrollmentAction(req.body)}catch(e){return res.status(400).json({error:e.message})}
  const cl=await auth.admin.from('classes').select('id').eq('id',action.classId).maybeSingle()
  if(cl.error)throw cl.error;if(!cl.data)return res.status(404).json({error:'Classroom not found.'})
  const student=await auth.admin.from('users').select('id,role').eq('id',action.studentId).maybeSingle()
  if(student.error)throw student.error
  if(!student.data||!['student',...(action.action==='remove'?['archived']:[])].includes(student.data.role))return res.status(400).json({error:'Choose an active student account to add.'})
  if(action.action==='remove'){
   const removed=await auth.admin.from('enrollments').delete().eq('class_id',action.classId).eq('student_id',action.studentId)
   if(removed.error)throw removed.error
  }else{
   const existing=await auth.admin.from('enrollments').select('id').eq('class_id',action.classId).eq('student_id',action.studentId).limit(1)
   if(existing.error)throw existing.error
   if(!existing.data?.length){const added=await auth.admin.from('enrollments').insert({class_id:action.classId,student_id:action.studentId,support_level:'core'});if(added.error)throw added.error}
  }
  return res.json({success:true,message:action.action==='add'?'Student added to the classroom.':'Student removed from this classroom. Their account and saved work remain.'})
 }catch{return res.status(503).json({error:'Could not load or save the classroom. Please reload before trying again.'})}
}
