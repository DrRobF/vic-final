import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {validLessonId} from '../../../lib/educator-lessons.mjs'
import {planAsText} from '../../../lib/lesson-designer.mjs'
import {companionInput,companionInstructions,vicTargetText,familyFallback,nextFallback} from '../../../lib/lesson-companion.mjs'

export const config={api:{bodyParser:{sizeLimit:'32kb'}},maxDuration:60}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  if(req.method==='GET'&&req.query.collection==='family'){
   const {data:rows,error:rowsError}=await auth.admin.from('educator_lesson_companions').select('lesson_id,draft,updated_at').eq('user_id',auth.user.id).eq('kind','family').neq('draft','').order('updated_at',{ascending:false}).limit(100)
   if(rowsError)throw rowsError
   const ids=rows.map(row=>row.lesson_id)
   if(!ids.length)return res.json({drafts:[]})
   const {data:lessons,error:lessonsError}=await auth.admin.from('educator_lessons').select('id,title').eq('user_id',auth.user.id).in('id',ids)
   if(lessonsError)throw lessonsError
   const names=new Map(lessons.map(l=>[l.id,l.title]))
   return res.json({drafts:rows.filter(row=>names.has(row.lesson_id)).map(row=>({...row,title:names.get(row.lesson_id)}))})
  }
  const lessonId=req.method==='GET'?req.query.lessonId:req.body?.lessonId
  if(!validLessonId(lessonId))return res.status(400).json({error:'Choose one of your saved lessons.'})
  const {data:lesson,error:lessonError}=await auth.admin.from('educator_lessons').select('id,title,draft').eq('user_id',auth.user.id).eq('id',lessonId).maybeSingle()
  if(lessonError)throw lessonError
  if(!lesson)return res.status(404).json({error:'This lesson is not in your account.'})
  if(req.method==='GET'){
   const {data,error}=await auth.admin.from('educator_lesson_companions').select('kind,notes,draft,updated_at').eq('user_id',auth.user.id).eq('lesson_id',lessonId)
   if(error)throw error
   let vicText='',vicError=''
   try{vicText=vicTargetText(lesson.draft)}catch(e){vicError=e.message}
   return res.json({lesson:{id:lesson.id,title:lesson.title,hasWorksheet:!!lesson.draft?.worksheet,vicText,vicError},work:data})
  }
  const body=req.body||{}
  let input;try{input=companionInput(body)}catch(e){return res.status(400).json({error:e.message})}
  let draft
  if(body.action==='save'){
   if(typeof body.draft!=='string'||body.draft.length>12000)return res.status(400).json({error:'Keep the editable draft under 12,000 characters.'})
   draft=body.draft
  }else if(body.action==='generate'){
   if(input.kind==='vic'){
    try{draft=vicTargetText(lesson.draft)}catch(e){return res.status(400).json({error:e.message})}
   }else if(input.kind==='family'){
    draft=familyFallback(lesson.draft,input.notes)
   }else{
    if(!process.env.OPENAI_API_KEY){if(input.kind==='next')draft=nextFallback(lesson.draft,input.notes);else return res.status(503).json({error:'Drafting is temporarily unavailable.'})}
    if(!draft){
     if(!await claimLessonRequest(auth)){
      if(input.kind==='next')draft=nextFallback(lesson.draft,input.notes)
      else{res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling many requests. Please try again shortly.'})}
     }
     try{
      if(!draft){
       const lessonText=planAsText(lesson.draft.plan,lesson.draft.input).slice(0,18000)
       const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:1800,instructions:companionInstructions(input.kind),input:`Saved lesson:\n${lessonText}\n\nTeacher notes:\n${input.notes||'(none)'}`})})
       const result=await response.json().catch(()=>null)
       if(response.ok&&result?.status!=='incomplete')draft=result?.output_text||(result?.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n')
      }
     }catch{}
     if(!draft){if(input.kind==='next')draft=nextFallback(lesson.draft,input.notes);else return res.status(502).json({error:'VIC could not finish this draft. Your previous saved version is still available.'})}
    }
   }
   draft=draft.slice(0,12000)
  }else return res.status(400).json({error:'Choose generate or save.'})
  const {data,error}=await auth.admin.from('educator_lesson_companions').upsert({user_id:auth.user.id,lesson_id:lessonId,kind:input.kind,notes:input.notes,draft,updated_at:new Date().toISOString()},{onConflict:'user_id,lesson_id,kind'}).select('kind,notes,draft,updated_at').single()
  if(error)throw error
  return res.json({work:data})
 }catch(e){return res.status(e?.name==='TimeoutError'?504:503).json({error:e?.name==='TimeoutError'?'This draft took too long. Your previous work is still available.':'Could not open or save this lesson work. Please retry.'})}
}
