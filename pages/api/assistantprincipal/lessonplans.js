import { requirePrincipal, requireSchool } from '../../../lib/assistant-principal-auth'
import { isUuid, mondayOf, reviewEmail, weekFileName } from '../../../lib/lesson-week.mjs'
import { buildWeekDocx } from '../../../lib/lesson-week-docx.mjs'
export const config={api:{bodyParser:{sizeLimit:'16kb'},responseLimit:'12mb'},maxDuration:60}

// School leaders see only weeks a teacher chose to send to their school: the snapshot taken at sending.
const LIST='id,user_id,staff_id,teacher_name,week_of,state,grade,subject,status,submitted_at,edited_after_submit,reviewed_at,reviewer_name,principal_comment,days'
const escape=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const summary=row=>({id:row.id,staffId:row.staff_id,teacherName:row.teacher_name,weekOf:row.week_of,state:row.state,grade:row.grade,subject:row.subject,status:row.status,submittedAt:row.submitted_at,editedAfterSubmit:row.edited_after_submit,reviewedAt:row.reviewed_at,reviewerName:row.reviewer_name,principalComment:row.principal_comment,days:(row.days||[]).map(d=>({off:!!d.off,date:d.date,topic:d.topic||'',codes:(d.standards||[]).map(s=>s.code)}))})

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requirePrincipal(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  const db=auth.admin
  const schoolId=req.method==='GET'?req.query.schoolId:req.body?.schoolId
  if(req.method==='GET'&&!schoolId){
   const {data,error}=await db.from('ap_memberships').select('school_id,role,ap_schools(name)').eq('auth_user_id',auth.user.id)
   if(error)throw error
   return res.json({schools:(data||[]).map(m=>({id:m.school_id,name:m.ap_schools?.name||'My school',role:m.role}))})
  }
  const school=await requireSchool(auth,schoolId)
  if(school.error)return res.status(school.status).json({error:school.error})

  if(req.method==='GET'&&req.query.id){
   if(!isUuid(req.query.id))return res.status(400).json({error:'Invalid lesson plan link.'})
   const {data:row,error}=await db.from('lesson_weeks').select(LIST+',submission').eq('school_id',schoolId).eq('id',req.query.id).in('status',['submitted','reviewed']).maybeSingle()
   if(error)throw error
   if(!row?.submission)return res.status(404).json({error:'These lesson plans are not available for this school.'})
   if(req.query.format==='docx'){
    const {data:schoolRow}=await db.from('ap_schools').select('name').eq('id',schoolId).maybeSingle()
    const buffer=await buildWeekDocx(row.submission,{schoolName:schoolRow?.name||''})
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition',`attachment; filename="${weekFileName(row)}"`)
    return res.status(200).send(buffer)
   }
   return res.json({week:{...summary(row),submission:row.submission}})
  }

  if(req.method==='GET'){
   const weekOf=req.query.week?mondayOf(String(req.query.week)):null
   let query=db.from('lesson_weeks').select(LIST).eq('school_id',schoolId).in('status',['submitted','reviewed']).order('week_of',{ascending:false}).order('submitted_at',{ascending:false}).limit(weekOf?300:150)
   if(weekOf)query=query.eq('week_of',weekOf)
   const [{data:weeks,error},{data:staff,error:staffError},{data:schoolRow}]=await Promise.all([query,db.from('ap_staff').select('id,display_name,role,auth_user_id').eq('school_id',schoolId).eq('active',true).order('display_name').limit(500),db.from('ap_schools').select('name').eq('id',schoolId).maybeSingle()])
   if(error||staffError)throw error||staffError
   return res.json({school:{id:schoolId,name:schoolRow?.name||''},weekOf,weeks:(weeks||[]).map(summary),teachers:(staff||[]).filter(s=>s.role==='teacher').map(s=>({id:s.id,name:s.display_name,onAskVic:!!s.auth_user_id}))})
  }

  if(req.body?.action!=='review')return res.status(400).json({error:'Unknown action.'})
  if(!isUuid(req.body?.id))return res.status(400).json({error:'Choose a week of lesson plans.'})
  const comment=typeof req.body.comment==='string'?req.body.comment.trim().slice(0,2000):''
  const {data:row,error}=await db.from('lesson_weeks').select('id,user_id,teacher_name,week_of,grade,subject,status').eq('school_id',schoolId).eq('id',req.body.id).in('status',['submitted','reviewed']).maybeSingle()
  if(error)throw error
  if(!row)return res.status(404).json({error:'These lesson plans are not available for this school.'})
  const reviewerName=String(auth.profile?.name||auth.user.user_metadata?.full_name||auth.user.email||'').slice(0,120)
  const now=new Date().toISOString()
  const {error:updateError}=await db.from('lesson_weeks').update({status:'reviewed',reviewed_at:now,reviewed_by:auth.user.id,reviewer_name:reviewerName,principal_comment:comment}).eq('id',row.id).eq('school_id',schoolId)
  if(updateError)throw updateError
  let emailed=false
  if(req.body.notify===true&&process.env.RESEND_API_KEY&&process.env.REPORTS_FROM_EMAIL){
   const {data:u}=await db.auth.admin.getUserById(row.user_id)
   if(u?.user?.email){
    const mail=reviewEmail({teacherName:row.teacher_name,reviewerName,week:{weekOf:row.week_of,grade:row.grade,subject:row.subject},comment})
    try{
     const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`lesson-week-review/${row.id}/${now}`},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:process.env.REPORTS_FROM_EMAIL,to:[u.user.email],...(auth.user.email?{reply_to:auth.user.email}:{}),subject:mail.subject,text:mail.body,html:`<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escape(mail.body)}</div>`})})
     emailed=r.ok
     if(!r.ok)console.error('Lesson week review email failed',{status:r.status})
    }catch(e){console.error('Lesson week review email failed',{name:e?.name})}
   }
  }
  return res.json({reviewed:true,reviewedAt:now,emailed})
 }catch(e){console.error('Lesson plans review request failed',{name:e?.name,code:e?.code});return res.status(503).json({error:'Could not load lesson plans right now. Please try again.'})}
}
