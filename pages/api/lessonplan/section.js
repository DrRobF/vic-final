import catalogue from '../../../data/lesson-standards.json'
import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {normalizeLessonInput,validateLessonPlan} from '../../../lib/lesson-designer.mjs'
import {sectionRewriteRequest,sectionRewriteSchema,sectionRewriteInstructions} from '../../../lib/lesson-section.mjs'
export const config={api:{bodyParser:{sizeLimit:'300kb'}},maxDuration:90}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
 const auth=await requireLessonEducator(req);if(auth.error)return res.status(auth.status).json({error:auth.error})
 let request
 try{const input=normalizeLessonInput({...req.body?.input,preserveExisting:false,startingPoint:'new'},catalogue);const plan=validateLessonPlan(req.body?.plan,input);request=sectionRewriteRequest(plan,input,req.body?.sectionKey,req.body?.directions)}catch(e){return res.status(400).json({error:e.message})}
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Section rewriting is temporarily unavailable.'})
 if(!await claimLessonRequest(auth)){res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling a lot of requests. Please try again later.'})}
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(75000),body:JSON.stringify({model:'gpt-4.1-mini',store:false,max_output_tokens:5000,instructions:sectionRewriteInstructions(),input:JSON.stringify(request),text:{format:{type:'json_schema',name:'lesson_section',strict:true,schema:sectionRewriteSchema}}})})
 const data=await response.json().catch(()=>null)
 if(!response.ok)return res.status(502).json({error:'VIC could not rewrite this section. Your lesson has not changed.'})
 const output=data?.output_text||(data?.output||[]).flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('')
 let result;try{result=JSON.parse(output)}catch{return res.status(502).json({error:'The replacement was incomplete. Your lesson has not changed.'})}
 if(typeof result.body!=='string'||!result.body.trim()||result.body.length>20000||typeof result.reviewNote!=='string'||result.reviewNote.length>3000)return res.status(502).json({error:'The replacement was incomplete. Your lesson has not changed.'})
 // Return a proposal only. The browser explicitly applies one allowlisted section.
 return res.json({sectionKey:request.sectionKey,body:result.body.trim(),reviewNote:result.reviewNote})
 }catch(error){return res.status(error?.name==='TimeoutError'?504:503).json({error:error?.name==='TimeoutError'?'The section rewrite took too long. Your lesson has not changed.':'Could not rewrite this section. Your lesson has not changed.'})}
}
