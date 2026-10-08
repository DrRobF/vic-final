import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {validLessonId} from '../../../lib/educator-lessons.mjs'
import {planAsText} from '../../../lib/lesson-designer.mjs'
import {companionInput,companionInstructions} from '../../../lib/lesson-companion.mjs'

export const config={api:{bodyParser:{sizeLimit:'32kb'}},maxDuration:60}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  const lessonId=req.method==='GET'?req.query.lessonId:req.body?.lessonId
  if(!validLessonId(lessonId))return res.status(400).json({error:'Choose one of your saved lessons.'})
  const {data:lesson,error:lessonError}=await auth.admin.from('educator_lessons').select('id,title,draft').eq('user_id',auth.user.id).eq('id',lessonId).maybeSingle()
  if(lessonError)throw lessonError
  if(!lesson)return res.status(404).json({error:'This lesson is not in your account.'})
  if(req.method==='GET'){
   const {data,error}=await auth.admin.from('educator_lesson_companions').select('kind,notes,draft,updated_at').eq('user_id',auth.user.id).eq('lesson_id',lessonId)
   if(error)throw error
   return res.json({lesson:{id:lesson.id,title:lesson.title,hasWorksheet:!!lesson.draft?.worksheet},work:data})
  }
  const body=req.body||{}
  let input;try{input=companionInput(body)}catch(e){return res.status(400).json({error:e.message})}
  let draft
  if(body.action==='save'){
   if(typeof body.draft!=='string'||body.draft.length>12000)return res.status(400).json({error:'Keep the editable draft under 12,000 characters.'})
   draft=body.draft
  }else if(body.action==='generate'){
   if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Drafting is temporarily unavailable.'})
   if(!await claimLessonRequest(auth)){res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling many requests. Please try again shortly.'})}
   const lessonText=planAsText(lesson.draft.plan,lesson.draft.input).slice(0,18000)
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:1800,instructions:companionInstructions(input.kind),input:`Saved lesson:\n${lessonText}\n\nTeacher notes:\n${input.notes||'(none)'}`})})
   const result=await response.json().catch(()=>null)
   if(!response.ok||result?.status==='incomplete')return res.status(502).json({error:'VIC could not finish this draft. Your previous saved version is still available.'})
   draft=result?.output_text||(result?.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n')
   if(!draft)return res.status(502).json({error:'VIC returned no draft. Your previous saved version is still available.'})
   draft=draft.slice(0,12000)
  }else return res.status(400).json({error:'Choose generate or save.'})
  const {data,error}=await auth.admin.from('educator_lesson_companions').upsert({user_id:auth.user.id,lesson_id:lessonId,kind:input.kind,notes:input.notes,draft,updated_at:new Date().toISOString()},{onConflict:'user_id,lesson_id,kind'}).select('kind,notes,draft,updated_at').single()
  if(error)throw error
  return res.json({work:data})
 }catch(e){return res.status(e?.name==='TimeoutError'?504:503).json({error:e?.name==='TimeoutError'?'This draft took too long. Your previous work is still available.':'Could not open or save this lesson work. Please retry.'})}
}
