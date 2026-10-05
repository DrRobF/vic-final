import catalogue from '../../../data/lesson-standards.json'
import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { normalizeLessonInput, lessonSchema, buildLessonInstructions, validateLessonPlan, materializeLessonPlan, planAsText } from '../../../lib/lesson-designer.mjs'
import { worksheetSettings, worksheetSchema, worksheetInstructions, materializeWorksheet, validateWorksheet } from '../../../lib/lesson-worksheet.mjs'
export const config={api:{bodyParser:{sizeLimit:'160kb'}},maxDuration:60}
const windows=new Map()
export default async function handler(req,res) {
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 try {
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  let input;try{input=normalizeLessonInput(req.body,catalogue)}catch(e){return res.status(400).json({error:e.message})}
  const worksheet=req.body?.kind==='worksheet'
  let settings,lesson;try{if(worksheet){lesson=validateLessonPlan(req.body?.plan,input);settings=worksheetSettings(req.body,input)}}catch(e){return res.status(400).json({error:e.message})}
  if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Lesson generation is temporarily unavailable. Please try again later.'})
  const now=Date.now();for(const [id,w] of windows)if(now-w.start>600000)windows.delete(id)
  const window=windows.get(auth.user.id)||{start:now,count:0}
  if(window.count>=10){res.setHeader('Retry-After','600');return res.status(429).json({error:'You have created several drafts quickly. Please wait a few minutes before generating another.'})}
  window.count++;windows.set(auth.user.id,window)
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:10000,instructions:worksheet?worksheetInstructions():buildLessonInstructions(),input:JSON.stringify(worksheet?{lesson,lessonText:planAsText(lesson,input),input,settings}:input),text:{format:{type:'json_schema',name:worksheet?'student_worksheet':'lesson_plan',strict:true,schema:worksheet?worksheetSchema(settings):lessonSchema(input.sections,input.standards,input)}}})})
  const data=await response.json().catch(()=>null)
  if(!response.ok){console.error('Lesson provider failed',{status:response.status});return res.status(502).json({error:'The lesson service could not finish this draft. Please try again.'})}
  const output=data?.output_text || (data?.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')
  if(worksheet){try{const sheet=validateWorksheet(materializeWorksheet(JSON.parse(output),settings));const source=lesson.displayEdits?.kit_sourceMaterial??lesson.teachingKit?.sourceMaterial;if(input.subject==='reading'&&source){for(const version of sheet.versions)version.passage=source;validateWorksheet(sheet)}return res.status(200).json({worksheet:sheet,createdAt:new Date().toISOString()})}catch(error){console.error('Worksheet validation failed',{status:data?.status,reason:error.message});return res.status(502).json({error:'The worksheet was incomplete. Try fewer questions or one classroom version.'})}}
  let plan;try{plan=validateLessonPlan(materializeLessonPlan(JSON.parse(output),input),input,true)}catch(error){console.error('Lesson draft validation failed',{status:data?.status,reason:error.message,incompleteReason:data?.incomplete_details?.reason});return res.status(502).json({error:'The lesson service returned an incomplete draft. Please try again; your selected standards and settings are still here.'})}
  return res.status(200).json({plan,input,createdAt:new Date().toISOString()})
 } catch(error) {
  console.error('Lesson Designer request failed',{name:error?.name})
  return res.status(error?.name==='TimeoutError'?504:500).json({error:error?.name==='TimeoutError'?'This draft took too long. Try fewer standards or sections.':'Could not create this lesson right now. Please try again.'})
 }
}
