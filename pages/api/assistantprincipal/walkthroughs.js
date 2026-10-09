import {requirePrincipal,requireSchool} from '../../../lib/assistant-principal-auth'
import {LOOK_FORS,RATINGS,SUBJECTS,VISIT_LENGTHS,FOLLOW_UPS,walkthroughInput,lookForSuggestions,NEXT_STEP_TOPIC_INSTRUCTIONS,cleanTopic,combineSuggestions,teacherFeedbackEmail} from '../../../lib/walkthrough.mjs'
export const config={api:{bodyParser:{sizeLimit:'64kb'}},maxDuration:30}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const escape=x=>String(x||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
const validDate=d=>!d||(/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d)))

async function topicFromNextStep(nextStep){
 if(!process.env.OPENAI_API_KEY)return ''
 try{
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(12000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:60,instructions:NEXT_STEP_TOPIC_INSTRUCTIONS,input:nextStep})})
  const d=await r.json().catch(()=>null)
  const out=d?.output_text||(d?.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join(' ')
  return r.ok?cleanTopic(out):''
 }catch{return ''}
}

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

  const {data:staff,error:staffError}=await db.from('ap_staff').select('id,display_name,role,assignment,email').eq('school_id',schoolId).eq('active',true).order('display_name').limit(500)
  if(staffError)throw staffError
  const staffById=new Map((staff||[]).map(s=>[s.id,s]))

  if(req.method==='GET'){
   const [{data:walks,error:wErr},{data:suggestions,error:sErr},{data:assignments,error:aErr},{data:schoolRow}]=await Promise.all([
    db.from('ap_walkthroughs').select('id,staff_id,observer_name,subject,visit_length,ratings,strength,next_step,follow_up,shared_feedback,private_notes,feedback_sent_at,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(60),
    db.from('ap_path_suggestions').select('id,staff_id,walkthrough_id,topic,reason,created_at').eq('school_id',schoolId).eq('status','pending').order('created_at',{ascending:false}).limit(100),
    db.from('ap_path_assignments').select('id,staff_id,topic,note,due_date,source,learning_path_id,created_at').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(200),
    db.from('ap_schools').select('name').eq('id',schoolId).maybeSingle(),
   ])
   if(wErr||sErr||aErr)throw wErr||sErr||aErr
   // Principals see completion and the teacher's reflection only. Quiz scores are never selected.
   const pathIds=(assignments||[]).map(a=>a.learning_path_id).filter(Boolean)
   const {data:paths,error:pErr}=pathIds.length?await db.from('educator_learning_paths').select('id,status,reflection,completed_at,updated_at').in('id',pathIds):{data:[],error:null}
   if(pErr)throw pErr
   const pathById=new Map((paths||[]).map(p=>[p.id,p]))
   const name=id=>staffById.get(id)?.display_name||'Former staff member'
   return res.json({
    school:{id:schoolId,name:schoolRow?.name||'',role:school.role},
    me:{name:auth.profile?.name||auth.user.email||''},
    options:{lookFors:LOOK_FORS.map(({key,label})=>({key,label})),ratings:RATINGS,subjects:SUBJECTS,visitLengths:VISIT_LENGTHS,followUps:FOLLOW_UPS},
    staff:(staff||[]).filter(s=>s.role==='teacher'||s.role==='support'||s.role==='other').map(s=>({id:s.id,name:s.display_name,assignment:s.assignment||'',hasEmail:!!s.email})),
    walkthroughs:(walks||[]).map(w=>({...w,teacher:name(w.staff_id)})),
    suggestions:(suggestions||[]).map(s=>({...s,teacher:name(s.staff_id)})),
    assignments:(assignments||[]).map(a=>{const p=a.learning_path_id&&pathById.get(a.learning_path_id);return {...a,teacher:name(a.staff_id),status:p?(p.status==='completed'?'completed':'started'):'not started',completedAt:p?.completed_at||null,reflection:p?.status==='completed'?p.reflection:''}}),
   })
  }

  const body=req.body||{},action=body.action
  if(action==='submit'){
   let input;try{input=walkthroughInput(body)}catch(e){return res.status(400).json({error:e.message})}
   const teacher=staffById.get(input.staffId)
   if(!teacher)return res.status(400).json({error:'That teacher is not on this school’s active staff list.'})
   const observerName=auth.profile?.name||auth.user.email||''
   const {data:walk,error}=await db.from('ap_walkthroughs').insert({school_id:schoolId,staff_id:input.staffId,observer_user_id:auth.user.id,observer_name:observerName,subject:input.subject,visit_length:input.visitLength,ratings:input.ratings,strength:input.strength,next_step:input.nextStep,follow_up:input.followUp,shared_feedback:input.sharedFeedback,private_notes:input.privateNotes}).select('id,created_at').single()
   if(error)throw error
   const suggestions=combineSuggestions(lookForSuggestions(input.ratings),await topicFromNextStep(input.nextStep))
   if(suggestions.length){const {error:sErr}=await db.from('ap_path_suggestions').insert(suggestions.map(s=>({school_id:schoolId,staff_id:input.staffId,walkthrough_id:walk.id,topic:s.topic,reason:s.reason})));if(sErr)throw sErr}
   let emailed=false,emailNote=''
   if(input.emailTeacher){
    if(!teacher.email)emailNote='This teacher has no email on the staff list, so no feedback email was sent.'
    else if(!process.env.RESEND_API_KEY||!process.env.REPORTS_FROM_EMAIL)emailNote='Email delivery is not configured, so no feedback email was sent.'
    else{
     const {data:schoolRow}=await db.from('ap_schools').select('name').eq('id',schoolId).maybeSingle()
     const mail=teacherFeedbackEmail({teacherName:teacher.display_name,observerName,schoolName:schoolRow?.name,subject:input.subject,date:new Date(walk.created_at).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}),ratings:input.ratings,strength:input.strength,nextStep:input.nextStep,sharedFeedback:input.sharedFeedback})
     const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`walkthrough/${walk.id}`},body:JSON.stringify({from:process.env.REPORTS_FROM_EMAIL,to:[teacher.email],subject:mail.subject,text:mail.body,html:`<div style="white-space:pre-wrap;font-family:Arial,sans-serif;line-height:1.6">${escape(mail.body)}</div>`})})
     if(r.ok){emailed=true;await db.from('ap_walkthroughs').update({feedback_sent_at:new Date().toISOString()}).eq('id',walk.id)}else emailNote='The walkthrough is saved, but the feedback email could not be sent.'
    }
   }
   return res.json({saved:true,suggestions:suggestions.length,emailed,emailNote})
  }

  async function assign({staffId,topic,note='',dueDate=null,source='manual',suggestionId=null}){
   const teacher=staffById.get(staffId)
   if(!teacher)throw Object.assign(new Error('That teacher is not on this school’s active staff list.'),{status:400})
   const t=String(topic||'').trim();if(t.length<3||t.length>200)throw Object.assign(new Error('Write a topic of 3–200 characters.'),{status:400})
   const n=String(note||'').trim().slice(0,600)
   if(!validDate(dueDate))throw Object.assign(new Error('Choose a valid due date.'),{status:400})
   const {data,error}=await db.from('ap_path_assignments').insert({school_id:schoolId,staff_id:staffId,staff_email:String(teacher.email||'').toLowerCase(),topic:t,note:n,due_date:dueDate||null,source,suggestion_id:suggestionId,assigned_by:auth.user.id}).select('id').single()
   if(error)throw error
   return data
  }

  try{
   if(action==='decide'){
    if(!UUID.test(String(body.suggestionId||'')))return res.status(400).json({error:'Choose a suggestion.'})
    const {data:s,error}=await db.from('ap_path_suggestions').select('id,staff_id,topic,status').eq('id',body.suggestionId).eq('school_id',schoolId).maybeSingle()
    if(error)throw error
    if(!s||s.status!=='pending')return res.status(409).json({error:'That suggestion was already handled.'})
    if(body.decision==='assign')await assign({staffId:s.staff_id,topic:typeof body.topic==='string'&&body.topic.trim()?body.topic:s.topic,note:body.note,dueDate:body.dueDate,source:'walkthrough',suggestionId:s.id})
    else if(body.decision!=='dismiss')return res.status(400).json({error:'Choose Assign or No thanks.'})
    const {error:uErr}=await db.from('ap_path_suggestions').update({status:body.decision==='assign'?'assigned':'dismissed',decided_at:new Date().toISOString()}).eq('id',s.id)
    if(uErr)throw uErr
    return res.json({ok:true})
   }
   if(action==='assign'){await assign({staffId:body.staffId,topic:body.topic,note:body.note,dueDate:body.dueDate});return res.json({ok:true})}
   if(action==='unassign'){
    if(!UUID.test(String(body.assignmentId||'')))return res.status(400).json({error:'Choose an assignment.'})
    const {error}=await db.from('ap_path_assignments').delete().eq('id',body.assignmentId).eq('school_id',schoolId).is('learning_path_id',null)
    if(error)throw error
    return res.json({ok:true})
   }
  }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e}
  return res.status(400).json({error:'Choose a supported action.'})
 }catch(e){console.error('walkthroughs',e?.message);return res.status(503).json({error:'Could not load or save walkthroughs. Please retry.'})}
}
