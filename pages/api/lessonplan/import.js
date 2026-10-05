import { requireLessonEducator } from '../../../lib/lesson-designer-auth'
import { extractLessonFile } from '../../../lib/lesson-import.mjs'
export const config={api:{bodyParser:{sizeLimit:'4.2mb'}},maxDuration:60}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req);if(auth.error)return res.status(auth.status).json({error:auth.error})
  const encoded=req.body?.data
  if(typeof encoded!=='string'||encoded.length>4194304||!encoded.length||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))return res.status(400).json({error:'Choose a supported lesson file smaller than 3 MB.'})
  const text=await extractLessonFile(req.body?.name,Buffer.from(encoded,'base64'))
  return res.status(200).json({text})
 }catch(error){return res.status(400).json({error:error?.message?.includes('password')?'This PDF is password protected. Upload an unlocked copy or paste its text.':error?.message||'Could not read this lesson. Paste its text instead.'})}
}
