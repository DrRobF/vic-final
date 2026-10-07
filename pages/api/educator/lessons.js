import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {lessonRecord,validLessonId} from '../../../lib/educator-lessons.mjs'
export const config={api:{bodyParser:{sizeLimit:'1mb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireLessonEducator(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 const owner=auth.user.id
 if(req.method==='POST'){
  let row;try{row=lessonRecord(req.body,owner)}catch(e){return res.status(400).json({error:e.message})}
  const {data,error}=await auth.admin.from('educator_lessons').upsert(row,{onConflict:'user_id,id'}).select('id,updated_at').single()
  if(error)return res.status(503).json({error:'Your lesson could not be saved to your account. Your browser draft is still available. Please retry before starting another lesson.'})
  return res.json(data)
 }
 if(req.query.id){
  if(!validLessonId(req.query.id))return res.status(400).json({error:'Invalid lesson link.'})
  const {data,error}=await auth.admin.from('educator_lessons').select('id,draft,updated_at').eq('user_id',owner).eq('id',req.query.id).maybeSingle()
  if(error)return res.status(503).json({error:'Could not open your saved lesson. Please retry.'})
  if(!data)return res.status(404).json({error:'This lesson is not available in your account.'})
  return res.json(data)
 }
 const offset=Math.max(0,Math.min(100000,Number.parseInt(req.query.offset,10)||0))
 const {data,error}=await auth.admin.from('educator_lessons').select('id,title,subject,grade,created_at,updated_at').eq('user_id',owner).order('updated_at',{ascending:false}).order('id',{ascending:true}).range(offset,offset+49)
 if(error)return res.status(503).json({error:'Could not load your saved lessons. Please retry.'})
 return res.json({lessons:data,hasMore:data.length===50})
}
