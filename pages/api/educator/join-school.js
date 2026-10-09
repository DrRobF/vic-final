import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {normalizeJoinCode,JOIN_CONSENT} from '../../../lib/walkthrough.mjs'
export const config={api:{bodyParser:{sizeLimit:'8kb'}}}

// A teacher joins a school's AskVic staff with the school's join code.
// It links their own account to their spot on the staff list (matching by email when the leader already added them),
// or adds them if the school has an open seat.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed.'})}
 try{
  const auth=await requireLessonEducator(req)
  if(auth.error)return res.status(auth.status).json({error:auth.error})
  const db=auth.admin,email=String(auth.user.email||'').toLowerCase()

  if(req.method==='GET'&&!req.query.code){
   const {data,error}=await db.from('ap_staff').select('id,joined_at,ap_schools(name)').eq('auth_user_id',auth.user.id).eq('active',true)
   if(error)throw error
   return res.json({schools:(data||[]).map(s=>({staffId:s.id,name:s.ap_schools?.name||'',joinedAt:s.joined_at})),consent:JOIN_CONSENT})
  }
  const code=normalizeJoinCode(req.method==='GET'?req.query.code:req.body?.code)
  if(!/^[A-Z0-9]{3,6}-\d{4}$/.test(code))return res.status(400).json({error:'Enter the code from your school leader, like SPA-4821.'})
  const {data:school,error:schoolError}=await db.from('ap_schools').select('id,name,seat_limit').eq('join_code',code).maybeSingle()
  if(schoolError)throw schoolError
  if(!school)return res.status(404).json({error:'That code didn’t match a school. Check it with your school leader.'})
  if(req.method==='GET')return res.json({school:{name:school.name},consent:JOIN_CONSENT})

  if(req.body?.agree!==true)return res.status(400).json({error:'Please read and agree to what joining means.'})
  const {data:mine}=await db.from('ap_staff').select('id').eq('school_id',school.id).eq('auth_user_id',auth.user.id).eq('active',true).maybeSingle()
  if(mine)return res.json({joined:true,school:{name:school.name},already:true})
  // Already on the staff list by email? Link that spot (no new seat used).
  const {data:listed}=email?await db.from('ap_staff').select('id').eq('school_id',school.id).eq('active',true).is('auth_user_id',null).ilike('email',email).limit(1):{data:[]}
  const now=new Date().toISOString()
  if(listed?.[0]){
   const {error}=await db.from('ap_staff').update({auth_user_id:auth.user.id,joined_at:now}).eq('id',listed[0].id)
   if(error)throw error
   return res.json({joined:true,school:{name:school.name}})
  }
  const {count,error:countError}=await db.from('ap_staff').select('id',{count:'exact',head:true}).eq('school_id',school.id).eq('active',true)
  if(countError)throw countError
  if((count||0)>=(school.seat_limit??50))return res.status(409).json({error:'Your school is full right now. Ask your school leader to free a seat or add you.'})
  const {data:profile}=await db.from('users').select('name').eq('auth_user_id',auth.user.id).limit(1).maybeSingle()
  const name=String(profile?.name||auth.user.user_metadata?.full_name||email.split('@')[0]||'Teacher').slice(0,120)
  const {error}=await db.from('ap_staff').insert({school_id:school.id,display_name:name.length>=2?name:'Teacher',role:'teacher',assignment:'',email:email||null,auth_user_id:auth.user.id,joined_at:now})
  if(error)throw error
  return res.json({joined:true,school:{name:school.name}})
 }catch(e){console.error('join-school',e?.message);return res.status(503).json({error:'Could not join right now. Please try again.'})}
}
