import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {assistantInput,assistantInstructions,assistantTasks} from '../../../lib/educator-assistant.mjs'
export const config={api:{bodyParser:{sizeLimit:'64kb'}},maxDuration:60}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  if(req.method==='GET'){
   const {data,error}=await auth.admin.from('educator_assistant_work').select('kind,notes,draft,tasks,updated_at').eq('user_id',auth.user.id)
   if(error)throw error
   return res.json({work:data})
  }
  const body=req.body||{}
  let row={user_id:auth.user.id,updated_at:new Date().toISOString()}
  try{
   if(body.action==='tasks'){row={...row,kind:'tasks',notes:'',draft:'',tasks:assistantTasks(body.tasks)}}
   else{const input=assistantInput(body);row={...row,...input,tasks:[]};if(body.action==='save'){if(typeof body.draft!=='string'||body.draft.length>16000)throw new Error('Use an editable draft of up to 16,000 characters.');row.draft=body.draft}else if(body.action!=='generate')throw new Error('Choose a supported action.')}
  }catch(e){return res.status(400).json({error:e.message})}
  if(body.action==='generate'){
   if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Drafting is temporarily unavailable. Your saved work is still available.'})
   if(!await claimLessonRequest(auth)){res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling many requests. Please try again shortly.'})}
   const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(45000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:1800,instructions:assistantInstructions(row.kind),input:row.notes})})
   const result=await response.json().catch(()=>null)
   if(!response.ok||result?.status==='incomplete')return res.status(502).json({error:'VIC could not finish this draft. Your previous saved draft has been kept.'})
   const text=result?.output_text||(result?.output||[]).flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text).join('\n')
   if(!text)return res.status(502).json({error:'VIC returned no draft. Your previous saved work has been kept.'})
   row.draft=text.slice(0,16000)
  }
  const {data,error}=await auth.admin.from('educator_assistant_work').upsert(row,{onConflict:'user_id,kind'}).select('kind,notes,draft,tasks,updated_at').single()
  if(error)throw error
  return res.json({work:data})
 }catch(e){return res.status(e?.name==='TimeoutError'?504:503).json({error:e?.name==='TimeoutError'?'This draft took too long. Your previous saved work is still available.':'Could not save or load your assistant work. Please retry.'})}
}
