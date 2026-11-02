// What VIC's attempt rows say, for the two people who can act on them.
//
// One endpoint serves both because it is one question asked at two altitudes. A leader asks
// it of a school and gets standards first -- a principal cannot act on "Johnny is behind",
// that is the teacher's job, but can act on "this standard came back not-landed more than
// landed" by walking into the room. A teacher asks it of their own classes and gets children
// by name, because knowing them is the job.
//
// Rules live in lib/student-evidence.mjs and are tested there. This file does the fetching,
// the scoping and the naming, and decides nothing.
import {requirePrincipal,requireSchool} from '../../../lib/assistant-principal-auth'
import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {evidence,standardLine,WINDOW_DAYS} from '../../../lib/student-evidence.mjs'
import general from '../../../data/lesson-standards.json'
export const config={api:{bodyParser:{sizeLimit:'16kb'}}}

const STANDARD=new Map(general.map(s=>[s.id,s]))
// A child's name as an adult who knows them would say it, and never more of it than needed.
const shortName=name=>{const parts=String(name||'').trim().split(/\s+/);return parts.length<2?parts[0]||'Student':`${parts[0]} ${parts[parts.length-1][0]}.`}
const days=q=>{const n=Number(q);return Number.isInteger(n)&&n>=1&&n<=90?n:WINDOW_DAYS}

/** Standard id -> what a human calls it. Unknown ids still render: a teacher pasted it. */
function describe(id){
 const s=STANDARD.get(id)
 if(!s)return{id,code:String(id||'').split(':').pop()||'Standard',text:'',subject:'',grade:''}
 return{id,code:s.code,text:s.text,subject:s.subject,grade:String(s.grade)}
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const window=days(req.query.days)
  // Leader first. A principal who also teaches lands here, which is right: the school view
  // is the one they came for, and the dashboard has a Teacher button for the other.
  const leader=await requirePrincipal(req)
  const asLeader=!leader.error&&req.query.schoolId

  let db,classIds,scope
  if(asLeader){
   const school=await requireSchool(leader,req.query.schoolId)
   if(school.error)return res.status(school.status).json({error:school.error})
   db=leader.admin
   // ap_staff and classes are two lists of the same people, joined only at auth_user_id.
   const [{data:staff},{data:classes}]=await Promise.all([
    db.from('ap_staff').select('auth_user_id').eq('school_id',school.schoolId).eq('active',true).limit(500),
    db.from('classes').select('id,class_name,grade_level,teacher_id,users:teacher_id(auth_user_id,name)').limit(500),
   ])
   const known=new Set((staff||[]).map(s=>s.auth_user_id).filter(Boolean))
   const mine=(classes||[]).filter(c=>c.users?.auth_user_id&&known.has(c.users.auth_user_id))
   classIds=mine.map(c=>c.id)
   scope={kind:'school',classes:mine.map(c=>({id:c.id,name:c.class_name,grade:c.grade_level,teacher:c.users?.name||''}))}
  }else{
   const teacher=await requireLessonEducator(req)
   if(teacher.error)return res.status(teacher.status).json({error:teacher.error})
   db=teacher.admin
   const {data:me}=await db.from('users').select('id').eq('auth_user_id',teacher.user.id).maybeSingle()
   if(!me)return res.status(403).json({error:'No teacher record on this account.'})
   const {data:classes}=await db.from('classes').select('id,class_name,grade_level').eq('teacher_id',me.id).limit(500)
   classIds=(classes||[]).map(c=>c.id)
   scope={kind:'classes',classes:(classes||[]).map(c=>({id:c.id,name:c.class_name,grade:c.grade_level,teacher:''}))}
  }

  if(!classIds.length)return res.json({scope,windowDays:window,standards:[],struggling:[],disengaged:[],students:{},empty:'no-classes'})

  const since=new Date(Date.now()-window*86400000).toISOString()
  const {data:attempts,error}=await db.from('vic_goal_attempts')
   .select('student_id,class_id,standard_id,turns,verdict,resolved_at,started_at,last_seen_at,audio_on_assessed,alternate_standard')
   .in('class_id',classIds).gte('last_seen_at',since).limit(5000)
  if(error)throw error

  const found=evidence(attempts||[],{days:window})

  // Names, only for the children who appear in a finding. A roster is a different screen.
  const ids=[...new Set([...found.struggling.map(s=>s.studentId),...found.disengaged.map(d=>d.studentId)])]
  const {data:people}=ids.length?await db.from('users').select('id,name,grade_level,enrollment_status').in('id',ids):{data:[]}
  const students=Object.fromEntries((people||[])
   // A withdrawn child's old rows must not become this week's to-do list.
   .filter(p=>p.enrollment_status!=='withdrawn')
   .map(p=>[p.id,{name:shortName(p.name),grade:p.grade_level}]))

  const present = s => Object.hasOwn(students, s.studentId)
  return res.json({
   scope,
   windowDays:window,
   // The principal's altitude: standards, with the plain line already written.
   standards:found.standards.map(s=>({...s,standard:describe(s.standardId),line:standardLine(s)})),
   // Signal 1, a teaching question. Signal 2, a supervision question. Never merged.
   struggling:found.struggling.filter(present).map(s=>({...s,standard:describe(s.standardId)})),
   disengaged:found.disengaged.filter(present),
   students,
   counted:(attempts||[]).length,
  })
 }catch(e){console.error('progress',e?.message);return res.status(503).json({error:'Could not load student progress. Please retry.'})}
}
