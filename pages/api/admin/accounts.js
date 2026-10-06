import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {accountPatch,canManageAccounts} from '../../../lib/educator-account.mjs'
export const config={api:{bodyParser:{sizeLimit:'8kb'}}}
const FIELDS='id,name,email,role,parent_email,interest_tags'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(!['GET','PATCH'].includes(req.method)){res.setHeader('Allow','GET, PATCH');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 if(!canManageAccounts(auth,ADMIN_EMAIL))return res.status(403).json({error:'Only the approved school administrator can manage these accounts.'})
 try{
  if(req.method==='GET'){
   const role=['teacher','student','principal'].includes(req.query.role)?req.query.role:null
   const page=Math.max(0,Math.min(1000,Number.parseInt(req.query.page,10)||0)),query=String(req.query.q||'').trim().slice(0,100)
   let lookup=auth.admin.from('users').select(FIELDS,{count:'exact'}).in('role',role?[role]:['teacher','student','principal'])
   // Strip PostgREST filter syntax; keep ordinary letters/numbers for name/email search.
   const search=query.replace(/[^\p{L}\p{N}@ ._+-]/gu,'').trim()
   if(search)lookup=lookup.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
   const {data,error,count}=await lookup.order('name',{ascending:true}).order('id',{ascending:true}).range(page*50,page*50+49)
   if(error)throw error
   return res.json({accounts:data||[],total:count||0,page,pageSize:50})
  }
  const id=Number(req.body?.id)
  if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Select a valid account.'})
  const {data:profile,error}=await auth.admin.from('users').select(FIELDS).eq('id',id).maybeSingle()
  if(error)throw error
  if(!profile)return res.status(404).json({error:'Account not found.'})
  let patch;try{patch=accountPatch(req.body,profile)}catch(e){return res.status(400).json({error:e.message})}
  const {data:updated,error:updateError}=await auth.admin.from('users').update(patch).eq('id',id).eq('role',profile.role).select(FIELDS).maybeSingle()
  if(updateError)throw updateError
  if(!updated)return res.status(409).json({error:'The account changed. Reload and try again.'})
  return res.json({account:updated,success:true})
 }catch{return res.status(503).json({error:'Could not read or save account details. Please try again.'})}
}
