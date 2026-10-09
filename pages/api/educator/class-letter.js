import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {lessonTargets} from '../../../lib/lesson-companion.mjs'
import {classLetterInputs,CLASS_LETTER_INSTRUCTIONS,fallbackClassLetter} from '../../../lib/class-letter.mjs'
export const config={api:{bodyParser:{sizeLimit:'32kb'}},maxDuration:60}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  if(req.method==='GET'){
   const {data:lessons,error:lessonsError}=await auth.admin.from('educator_lessons').select('id,title,updated_at').eq('user_id',auth.user.id).order('updated_at',{ascending:false}).limit(100)
   if(lessonsError)throw lessonsError
   const {data:updates,error:updatesError}=await auth.admin.from('educator_lesson_companions').select('lesson_id,updated_at').eq('user_id',auth.user.id).eq('kind','family').neq('draft','').order('updated_at',{ascending:false}).limit(100)
   if(updatesError)throw updatesError
   const titles=new Map((lessons||[]).map(l=>[l.id,l.title]))
   return res.json({lessons:lessons||[],familyUpdates:(updates||[]).filter(u=>titles.has(u.lesson_id)).map(u=>({lessonId:u.lesson_id,title:titles.get(u.lesson_id),updatedAt:u.updated_at}))})
  }
  let inputs;try{inputs=classLetterInputs(req.body)}catch(e){return res.status(400).json({error:e.message})}
  const {data:picked,error:lessonError}=inputs.lessonIds.length?await auth.admin.from('educator_lessons').select('id,title,draft').eq('user_id',auth.user.id).in('id',inputs.lessonIds):{data:[],error:null}
  if(lessonError)throw lessonError
  if((picked||[]).length!==inputs.lessonIds.length)return res.status(400).json({error:'A selected lesson is no longer in your account.'})
  const lessons=(picked||[]).map(l=>({title:l.title,...lessonTargets(l.draft)}))
  const {data:pickedUpdates,error:updateError}=inputs.familyIds.length?await auth.admin.from('educator_lesson_companions').select('lesson_id,draft').eq('user_id',auth.user.id).eq('kind','family').in('lesson_id',inputs.familyIds):{data:[],error:null}
  if(updateError)throw updateError
  const updates=(pickedUpdates||[]).map(u=>String(u.draft||'').slice(0,2000)).filter(Boolean)
  let letter=fallbackClassLetter({lessons,updates,note:inputs.note})
  if(process.env.OPENAI_API_KEY&&await claimLessonRequest(auth)){
   const input=JSON.stringify({lessons:lessons.map(l=>({title:l.title,objectives:l.objectives,standards:l.standards})),lessonUpdates:updates,teacherNote:inputs.note})
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:1500,text:{format:{type:'json_schema',name:'class_letter',strict:true,schema:{type:'object',additionalProperties:false,required:['subject','body'],properties:{subject:{type:'string'},body:{type:'string'}}}}},instructions:CLASS_LETTER_INSTRUCTIONS,input})})
   const result=await response.json().catch(()=>null)
   const output=result?.output_text||(result?.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')
   if(response.ok&&result?.status!=='incomplete'&&output){try{const parsed=JSON.parse(output);if(parsed.subject?.trim()&&parsed.body?.trim())letter=parsed}catch{}}
  }
  return res.json({letter:{subject:letter.subject.slice(0,240),body:letter.body.slice(0,12000)}})
 }catch(e){return res.status(e?.name==='TimeoutError'?504:503).json({error:e?.name==='TimeoutError'?'This letter took too long. Please try again.':'Could not write the class letter. Please retry.'})}
}
