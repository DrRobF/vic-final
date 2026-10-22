import catalogue from '../../../data/lesson-standards.json'
import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { normalizeWeekSetup, lessonIntoWeekDay, mondayOf, WEEKDAYS, weekStandardRows, buildWeekSubmission, submissionEmail, weekFileName, validEmail, isUuid, MAX_EMAIL_SENDS_PER_DAY } from '../../../lib/lesson-week.mjs'
import { buildWeekDocx } from '../../../lib/lesson-week-docx.mjs'
import { vicTargetText } from '../../../lib/lesson-companion.mjs'
import { syncWeekReleases } from '../../../lib/week-release.mjs'
export const config={api:{bodyParser:{sizeLimit:'200kb'},responseLimit:'12mb'},maxDuration:60}

const SITE=process.env.NEXT_PUBLIC_SITE_URL||'https://www.askvic.ai'
const LIST_COLUMNS='id,week_of,state,grade,subject,minutes,days,status,school_id,sent_to_email,submitted_at,edited_after_submit,reviewed_at,reviewer_name,principal_comment,updated_at,ap_schools(name)'
const escape=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')

function publicWeek(row){
 return {id:row.id,weekOf:row.week_of,state:row.state,grade:row.grade,subject:row.subject,minutes:row.minutes,days:row.days,settings:row.settings,status:row.status,schoolName:row.ap_schools?.name||'',sentToEmail:row.sent_to_email||'',submittedAt:row.submitted_at,editedAfterSubmit:row.edited_after_submit,reviewedAt:row.reviewed_at,reviewerName:row.reviewer_name,principalComment:row.principal_comment,updatedAt:row.updated_at}
}
// Saving an unchanged week (for example before a download) must not tell leaders the week was edited.
const plannedShape=w=>JSON.stringify([w.week_of??w.weekOf,w.state,w.grade,w.subject,Number(w.minutes),(w.days||[]).map(d=>[!!d.off,d.lessonId||null,d.topic||'',(d.standards||[]).map(x=>x.code+'|'+x.text)])])
const changed=(row,week)=>plannedShape(row)!==plannedShape(week)
async function persistWeek(db,owner,week,existing){
 const row={id:week.id,user_id:owner,week_of:week.weekOf,state:week.state,grade:week.grade,subject:week.subject,minutes:week.minutes,days:week.days,settings:week.settings,updated_at:new Date().toISOString(),...(existing&&existing.status!=='draft'&&changed(existing,week)?{edited_after_submit:true}:{})}
 const {error}=await db.from('lesson_weeks').upsert(row,{onConflict:'id'})
 if(error){console.error('Lesson week save failed',{code:error.code});return false}
 await db.from('lesson_week_standards').delete().eq('week_id',week.id)
 const rows=weekStandardRows(week,owner,existing?.school_id||null)
 if(rows.length){const {error:standardsError}=await db.from('lesson_week_standards').insert(rows);if(standardsError)console.error('Lesson week standards save failed',{code:standardsError.code})}
 return true
}
async function teacherName(auth){
 const {data}=await auth.admin.from('users').select('name').eq('auth_user_id',auth.user.id).limit(1).maybeSingle()
 const name=String(data?.name||auth.user.user_metadata?.full_name||auth.user.user_metadata?.name||'').trim()
 return (name||String(auth.user.email||'Teacher').split('@')[0]).slice(0,120)
}
async function loadLessons(auth,ids){
 if(!ids.length)return new Map()
 const {data,error}=await auth.admin.from('educator_lessons').select('id,draft,updated_at').eq('user_id',auth.user.id).in('id',ids)
 if(error)throw error
 return new Map((data||[]).map(r=>[r.id,{...r.draft,updatedAt:r.updated_at}]))
}
// For My Week: when each of these lessons last went to students, and whether that time is still ahead
// (scheduled). Only the teacher's own lesson ids reach here.
async function loadSends(auth,ids){
 if(!ids.length)return new Map()
 const {data,error}=await auth.admin.from('lessons').select('source_lesson_id,assignments(assigned_at)').in('source_lesson_id',ids)
 if(error)return new Map()
 const out=new Map()
 for(const l of data||[]){
  const times=(l.assignments||[]).map(a=>a.assigned_at).filter(Boolean)
  if(!times.length)continue
  const at=times.sort().at(-1),prev=out.get(l.source_lesson_id)
  if(!prev||at>prev.at)out.set(l.source_lesson_id,{at,count:times.length})
 }
 return out
}
function vicReadiness(draft){try{vicTargetText(draft);return {vicReady:true,vicIssue:''}}catch(e){return {vicReady:false,vicIssue:e.message}}}
async function sendEmail({to,replyTo,subject,body,attachment,key}){
 if(!process.env.RESEND_API_KEY||!process.env.REPORTS_FROM_EMAIL)return {sent:false,note:'Email delivery is not set up yet.'}
 try{
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},signal:AbortSignal.timeout(20000),body:JSON.stringify({from:process.env.REPORTS_FROM_EMAIL,to,...(replyTo?{reply_to:replyTo}:{}),subject,text:body,html:`<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escape(body)}</div>`,...(attachment?{attachments:[attachment]}:{})})})
  if(!r.ok){console.error('Lesson week email failed',{status:r.status});return {sent:false,note:'The email could not be delivered.'}}
  return {sent:true}
 }catch(e){console.error('Lesson week email failed',{name:e?.name});return {sent:false,note:'The email could not be delivered.'}}
}
// Leaders' addresses come from their own sign-in accounts, never from anything the teacher typed.
async function leaderEmails(admin,schoolId){
 const {data,error}=await admin.from('ap_memberships').select('auth_user_id').eq('school_id',schoolId)
 if(error)throw error
 const emails=[]
 for(const m of data||[]){const {data:u}=await admin.auth.admin.getUserById(m.auth_user_id);if(u?.user?.email)emails.push(u.user.email.toLowerCase())}
 return [...new Set(emails)].slice(0,10)
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  const db=auth.admin,owner=auth.user.id

  if(req.method==='GET'){
   if(!req.query.id){
    const [{data:weeks,error},{data:staff,error:staffError}]=await Promise.all([
     db.from('lesson_weeks').select(LIST_COLUMNS).eq('user_id',owner).order('week_of',{ascending:false}).order('updated_at',{ascending:false}).limit(60),
     db.from('ap_staff').select('id,school_id,ap_schools(name)').eq('auth_user_id',owner).eq('active',true),
    ])
    if(error||staffError){console.error('Lesson weeks list failed',{code:(error||staffError)?.code});return res.status(503).json({error:'Could not load your weeks. If this keeps happening, the weekly planner may still be getting set up.'})}
    return res.json({weeks:(weeks||[]).map(publicWeek),schools:(staff||[]).map(s=>({id:s.school_id,name:s.ap_schools?.name||'My school'}))})
   }
   if(!isUuid(req.query.id))return res.status(400).json({error:'Invalid week link.'})
   const {data:row,error}=await db.from('lesson_weeks').select(LIST_COLUMNS+',settings').eq('user_id',owner).eq('id',req.query.id).maybeSingle()
   if(error)return res.status(503).json({error:'Could not open this week. Please retry.'})
   if(!row)return res.status(404).json({error:'This week is not in your account.'})
   const ids=(row.days||[]).map(d=>d.lessonId).filter(isUuid)
   const lessons=await loadLessons(auth,ids)
   if(req.query.format==='docx'){
    const week={id:row.id,weekOf:row.week_of,state:row.state,grade:row.grade,subject:row.subject,minutes:row.minutes,days:row.days}
    let submission;try{submission=buildWeekSubmission(week,lessons,await teacherName(auth))}catch(e){return res.status(400).json({error:e.message})}
    const buffer=await buildWeekDocx(submission)
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');res.setHeader('Content-Disposition',`attachment; filename="${weekFileName(week)}"`)
    return res.status(200).send(buffer)
   }
   // The week plan is the schedule: make sure each planned day goes to students that morning.
   let release=null
   if(auth.profile?.role==='teacher'){try{release=await syncWeekReleases(db,{teacherId:auth.profile.id,row,lessons})}catch(e){console.error('Week release sync failed',{message:e?.message})}}
   const sends=await loadSends(auth,[...lessons.keys()])
   const summaries=Object.fromEntries([...lessons].map(([id,d])=>[id,{title:d.plan?.title||'Untitled lesson',worksheet:!!d.worksheet,steps:d.steps||{},updatedAt:d.updatedAt,...vicReadiness(d),sent:sends.get(id)||null}]))
   return res.json({week:publicWeek(row),lessons:summaries,release})
  }

  const action=req.body?.action
  if(action==='save'){
   let week;try{week=normalizeWeekSetup(req.body?.week,catalogue,{allowEmpty:true})}catch(e){return res.status(400).json({error:e.message})}
   const {data:existing,error:readError}=await db.from('lesson_weeks').select('user_id,status,school_id,week_of,state,grade,subject,minutes,days').eq('id',week.id).maybeSingle()
   if(readError)return res.status(503).json({error:'Your week could not be saved. Please retry.'})
   if(existing&&existing.user_id!==owner)return res.status(404).json({error:'This week is not in your account.'})
   if(!await persistWeek(db,owner,week,existing))return res.status(503).json({error:'Your week could not be saved. Please retry.'})
   return res.json({saved:true,id:week.id,status:existing?.status||'draft'})
  }

  // When AskVic can't tell which class a week is for, the teacher picks once and it's remembered.
  if(action==='setClass'){
   if(!isUuid(req.body?.weekId))return res.status(400).json({error:'Invalid week link.'})
   const classId=Number(req.body?.classId)
   if(!auth.profile?.id||!Number.isInteger(classId))return res.status(400).json({error:'Choose one of your classes.'})
   const {data:cls}=await db.from('classes').select('id').eq('id',classId).eq('teacher_id',auth.profile.id).maybeSingle()
   if(!cls)return res.status(403).json({error:'That class does not belong to you.'})
   const {data:row,error}=await db.from('lesson_weeks').select('id,settings').eq('user_id',owner).eq('id',req.body.weekId).maybeSingle()
   if(error||!row)return res.status(404).json({error:'This week is not in your account.'})
   const {error:upErr}=await db.from('lesson_weeks').update({settings:{...(row.settings||{}),classId}}).eq('id',row.id).eq('user_id',owner)
   if(upErr)return res.status(503).json({error:'Could not save the class. Please retry.'})
   return res.json({saved:true})
  }

  // A lesson made in the detailed single-lesson planner goes into one day of a week.
  if(action==='addLesson'){
   const lessonId=req.body?.lessonId,day=Number(req.body?.day)
   if(!isUuid(lessonId))return res.status(400).json({error:'Save this lesson first, then add it to your week.'})
   if(!Number.isInteger(day)||day<0||day>4)return res.status(400).json({error:'Choose a day from Monday to Friday.'})
   const lessons=await loadLessons(auth,[lessonId])
   const lesson=lessons.get(lessonId)
   if(!lesson?.input||!lesson?.plan)return res.status(404).json({error:'This lesson is not saved in your account yet. Wait a moment and try again.'})
   const input=lesson.input
   let row=null
   if(req.body?.weekId){
    if(!isUuid(req.body.weekId))return res.status(400).json({error:'Invalid week link.'})
    const {data,error}=await db.from('lesson_weeks').select('*').eq('user_id',owner).eq('id',req.body.weekId).maybeSingle()
    if(error)throw error
    if(!data)return res.status(404).json({error:'That week is not in your account.'})
    if(data.subject!==input.subject||data.grade!==input.grade)return res.status(409).json({error:`That week is for ${data.grade==='K'?'Kindergarten':'Grade '+data.grade} ${data.subject}. This lesson is ${input.grade==='K'?'Kindergarten':'Grade '+input.grade} ${input.subject}. Choose a different week.`})
    row=data
   }else{
    const weekOf=mondayOf(String(req.body?.weekOf||''))
    if(!weekOf)return res.status(400).json({error:'Choose the week this lesson belongs to.'})
    const {data,error}=await db.from('lesson_weeks').select('*').eq('user_id',owner).eq('week_of',weekOf).eq('subject',input.subject).eq('grade',input.grade).order('updated_at',{ascending:false}).limit(10)
    if(error)throw error
    // Prefer a week still being planned over one already sent.
    row=(data||[]).find(w=>w.status==='draft')||data?.[0]||null
    if(!row)row={id:crypto.randomUUID(),week_of:weekOf,state:input.state,grade:input.grade,subject:input.subject,minutes:input.minutes,days:null,settings:{},status:'draft',school_id:null,user_id:owner,_new:true}
   }
   const current=Array.isArray(row.days)?row.days[day]:null
   if(current?.lessonId&&current.lessonId!==lessonId&&req.body?.replace!==true){
    const other=(await loadLessons(auth,[current.lessonId])).get(current.lessonId)
    return res.status(409).json({conflict:true,existingTitle:other?.plan?.title||'another lesson',error:`${WEEKDAYS[day]} already has a lesson.`})
   }
   const days=lessonIntoWeekDay(row.days,day,lessonId,input)
   let week;try{week=normalizeWeekSetup({id:row.id,weekOf:row.week_of,state:row.state,grade:row.grade,subject:row.subject,minutes:row.minutes,days,settings:row.settings||{}},catalogue,{allowEmpty:true})}catch(e){return res.status(400).json({error:e.message})}
   if(!await persistWeek(db,owner,week,row._new?null:row))return res.status(503).json({error:'Your week could not be saved. Please retry.'})
   const ready=week.days.filter(d=>d.off||d.lessonId).length
   return res.json({added:true,weekId:week.id,weekOf:week.weekOf,day,dayName:WEEKDAYS[day],ready,status:row._new?'draft':row.status,created:!!row._new})
  }

  if(!isUuid(req.body?.id))return res.status(400).json({error:'Choose a week.'})
  const {data:row,error:rowError}=await db.from('lesson_weeks').select('*').eq('user_id',owner).eq('id',req.body.id).maybeSingle()
  if(rowError)return res.status(503).json({error:'Could not open this week. Please retry.'})
  if(!row)return res.status(404).json({error:'This week is not in your account.'})

  if(action==='delete'){
   if(row.status!=='draft')return res.status(409).json({error:'This week was already sent, so it stays on record for your school.'})
   const {error}=await db.from('lesson_weeks').delete().eq('id',row.id).eq('user_id',owner)
   if(error)return res.status(503).json({error:'Could not remove this week. Please retry.'})
   return res.json({deleted:true})
  }

  if(action!=='submit')return res.status(400).json({error:'Unknown action.'})
  const week={id:row.id,weekOf:row.week_of,state:row.state,grade:row.grade,subject:row.subject,minutes:row.minutes,days:row.days}
  const name=await teacherName(auth)
  const lessons=await loadLessons(auth,week.days.map(d=>d.lessonId).filter(isUuid))
  let submission;try{submission=buildWeekSubmission(week,lessons,name)}catch(e){return res.status(400).json({error:e.message})}
  const now=new Date().toISOString()

  let school=null,staffId=null,recipients=[],externalEmail=null
  if(req.body?.schoolId){
   if(!isUuid(req.body.schoolId))return res.status(400).json({error:'Choose your school.'})
   // Only a school the teacher has joined can receive the week.
   const {data:staff,error}=await db.from('ap_staff').select('id,display_name,ap_schools(id,name)').eq('school_id',req.body.schoolId).eq('auth_user_id',owner).eq('active',true).maybeSingle()
   if(error)throw error
   if(!staff)return res.status(403).json({error:'Join your school in AskVic before sending plans to its leaders.'})
   school={id:req.body.schoolId,name:staff.ap_schools?.name||''};staffId=staff.id
   if(staff.display_name)submission.teacherName=staff.display_name
   recipients=await leaderEmails(db,school.id)
  }else{
   externalEmail=validEmail(req.body?.email)
   if(!externalEmail)return res.status(400).json({error:'Enter your principal’s email address.'})
   if(!auth.user.email_confirmed_at)return res.status(403).json({error:'Verify your email before sending plans by email.'})
   const since=new Date(Date.now()-86400000).toISOString()
   const {count,error}=await db.from('lesson_weeks').select('id',{count:'exact',head:true}).eq('user_id',owner).not('sent_to_email','is',null).gte('submitted_at',since)
   if(error)throw error
   if((count||0)>=MAX_EMAIL_SENDS_PER_DAY)return res.status(429).json({error:'You have sent several weeks by email today. Download the Word file and share it instead, or try again tomorrow.'})
   recipients=[externalEmail]
  }

  const {error:updateError}=await db.from('lesson_weeks').update({status:'submitted',submitted_at:now,school_id:school?.id||null,staff_id:staffId,teacher_name:submission.teacherName,sent_to_email:externalEmail,submission,edited_after_submit:false,reviewed_at:null,reviewed_by:null,reviewer_name:'',updated_at:now}).eq('id',row.id).eq('user_id',owner)
  if(updateError){console.error('Lesson week submit failed',{code:updateError.code});return res.status(503).json({error:'Your week could not be sent. Please retry.'})}
  await db.from('lesson_week_standards').update({school_id:school?.id||null}).eq('week_id',row.id)

  let delivery={sent:false,note:recipients.length?'':'Your school has no leader email on file yet, but your plans are waiting in AskVic.'}
  if(recipients.length){
   const buffer=await buildWeekDocx(submission,{schoolName:school?.name||''})
   const mail=submissionEmail({teacherName:submission.teacherName,teacherEmail:auth.user.email,schoolName:school?.name||'',week,reviewUrl:school?`${SITE}/weeklyplans?school=${school.id}&plan=${row.id}`:'',days:submission.days})
   delivery=await sendEmail({to:recipients,replyTo:auth.user.email,subject:mail.subject,body:mail.body,attachment:{filename:weekFileName(week),content:Buffer.from(buffer).toString('base64')},key:`lesson-week/${row.id}/${now}`})
  }
  if(!school&&!delivery.sent){
   await db.from('lesson_weeks').update({status:row.status,submitted_at:row.submitted_at,sent_to_email:row.sent_to_email,submission:row.submission,school_id:row.school_id,staff_id:row.staff_id}).eq('id',row.id)
   return res.status(502).json({error:`${delivery.note||'The email could not be sent.'} Download the Word file and send it yourself.`})
  }
  return res.json({submitted:true,status:'submitted',submittedAt:now,school:school?.name||'',emailed:delivery.sent,recipients:recipients.length,note:delivery.note||''})
 }catch(e){console.error('Lesson weeks request failed',{name:e?.name,message:e?.message});return res.status(500).json({error:'Something went wrong. Your lessons are still saved. Please try again.'})}
}
