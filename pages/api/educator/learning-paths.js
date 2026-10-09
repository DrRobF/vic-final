import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {claimLessonRequest} from '../../../lib/lesson-rate-limit'
import {pathInput,PATH_SCHEMA,PATH_INSTRUCTIONS,RESOURCE_INSTRUCTIONS,cleanPath,publicPath,scoreQuiz,parseResourceList,citedResources,mergeResources,verifyResources} from '../../../lib/learning-path.mjs'
export const config={api:{bodyParser:{sizeLimit:'32kb'}},maxDuration:60}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIST='id,topic,status,minutes,updated_at,completed_at,title:path->>title'
const outputText=r=>r?.output_text||(r?.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')

async function openai(body){
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},signal:AbortSignal.timeout(50000),body:JSON.stringify({store:false,...body})})
 const result=await response.json().catch(()=>null)
 return {ok:response.ok&&result?.status!=='incomplete',result}
}

function view(row){
 const submitted=Array.isArray(row.quiz_answers)
 return {id:row.id,topic:row.topic,context:row.context,status:row.status,minutes:row.minutes,createdAt:row.created_at,updatedAt:row.updated_at,completedAt:row.completed_at,
  path:publicPath(row.path||{},submitted),resources:row.resources||[],progress:row.progress||{},quizAnswers:row.quiz_answers||null,quizScore:submitted?row.quiz_score:null,reflection:row.reflection||''}
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  const table=()=>auth.admin.from('educator_learning_paths')
  const own=async id=>{if(!UUID.test(String(id||'')))return null;const {data,error}=await table().select('*').eq('id',id).eq('user_id',auth.user.id).maybeSingle();if(error)throw error;return data}

  if(req.method==='GET'){
   if(req.query.id){const row=await own(req.query.id);if(!row)return res.status(404).json({error:'That learning path is not in your account.'});return res.json({item:view(row)})}
   const {data,error}=await table().select(LIST).eq('user_id',auth.user.id).order('updated_at',{ascending:false}).limit(50)
   if(error)throw error
   return res.json({items:(data||[]).map(r=>({id:r.id,topic:r.topic,title:r.title||r.topic,status:r.status,minutes:r.minutes,updatedAt:r.updated_at,completedAt:r.completed_at}))})
  }

  const body=req.body||{},action=body.action
  if(action==='create'){
   let input;try{input=pathInput(body)}catch(e){return res.status(400).json({error:e.message})}
   if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Learning Paths are temporarily unavailable.'})
   if(!await claimLessonRequest(auth)){res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling many requests. Please try again shortly.'})}
   const {ok,result}=await openai({model:'gpt-4.1-mini',max_output_tokens:3500,instructions:PATH_INSTRUCTIONS,input:JSON.stringify({topic:input.topic,teachingContext:input.context||'not given'}),text:{format:{type:'json_schema',name:'learning_path',strict:true,schema:PATH_SCHEMA}}})
   if(!ok)return res.status(502).json({error:'VIC could not build this path. Please try again.'})
   let path;try{path=cleanPath(JSON.parse(outputText(result)))}catch(e){return res.status(502).json({error:e.message||'VIC could not build this path. Please try again.'})}
   const {data,error}=await table().insert({user_id:auth.user.id,topic:input.topic,context:input.context,path,minutes:0}).select('*').single()
   if(error)throw error
   return res.json({item:view(data)})
  }

  const row=await own(body.id)
  if(!row)return res.status(404).json({error:'That learning path is not in your account.'})

  if(action==='resources'){
   if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:'Finding resources is temporarily unavailable.'})
   if(!await claimLessonRequest(auth)){res.setHeader('Retry-After','600');return res.status(429).json({error:'VIC is handling many requests. Please try again shortly.'})}
   const input=`Topic: ${row.topic}\nTeaching context: ${row.context||'K-12'}\nSuggested searches: ${(row.path?.searchQueries||[]).join(' | ')}`
   let found=[],stage='search'
   for(const tool of ['web_search','web_search_preview']){
    const {ok,result}=await openai({model:'gpt-4.1-mini',max_output_tokens:2500,tools:[{type:tool}],instructions:RESOURCE_INSTRUCTIONS,input})
    if(!ok){console.warn('learning-paths search failed',tool,result?.error?.message||result?.status);continue}
    // Use the JSON list the model returns, plus any pages it actually cited from search results.
    found=mergeResources(parseResourceList(outputText(result)),citedResources(result))
    stage=found.length?'verify':'empty'
    break
   }
   const verified=await verifyResources(found)
   console.log('learning-paths resources',{stage,found:found.length,verified:verified.length})
   const {data,error}=await table().update({resources:verified,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',auth.user.id).select('*').single()
   if(error)throw error
   return res.json({item:view(data),found:found.length,verified:verified.length})
  }
  if(action==='progress'){
   const done=body.progress&&typeof body.progress==='object'?Object.fromEntries(Object.entries(body.progress).filter(([k,v])=>typeof k==='string'&&k.length<=600&&v===true).slice(0,20)):{}
   const {data,error}=await table().update({progress:done,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',auth.user.id).select('*').single()
   if(error)throw error
   return res.json({item:view(data)})
  }
  if(action==='quiz'){
   if(Array.isArray(row.quiz_answers))return res.json({item:view(row)})
   let score;try{score=scoreQuiz(row.path?.quiz||[],body.answers)}catch(e){return res.status(400).json({error:e.message})}
   const {data,error}=await table().update({quiz_answers:body.answers,quiz_score:score,updated_at:new Date().toISOString()}).eq('id',row.id).eq('user_id',auth.user.id).select('*').single()
   if(error)throw error
   return res.json({item:view(data)})
  }
  if(action==='complete'){
   const reflection=typeof body.reflection==='string'?body.reflection.trim():''
   if(!Array.isArray(row.quiz_answers))return res.status(400).json({error:'Take the quiz before you finish.'})
   if(reflection.length<20||reflection.length>4000)return res.status(400).json({error:'Write a short reflection (at least a sentence or two) to finish.'})
   const now=new Date().toISOString()
   const {data,error}=await table().update({reflection,status:'completed',minutes:Math.min(600,Number(row.path?.minutes)||25),completed_at:row.completed_at||now,updated_at:now}).eq('id',row.id).eq('user_id',auth.user.id).select('*').single()
   if(error)throw error
   return res.json({item:view(data)})
  }
  if(action==='delete'){
   const {error}=await table().delete().eq('id',row.id).eq('user_id',auth.user.id)
   if(error)throw error
   return res.json({deleted:true})
  }
  return res.status(400).json({error:'Choose a supported action.'})
 }catch(e){return res.status(e?.name==='TimeoutError'?504:503).json({error:e?.name==='TimeoutError'?'This took too long. Please try again.':'Could not load or save your learning path. Please retry.'})}
}
