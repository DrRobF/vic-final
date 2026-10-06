import {createHash} from 'node:crypto'
import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {accountUnavailable} from '../../../lib/admin-management.mjs'
import {staffRows} from '../../../lib/staff-setup.mjs'
export const config={api:{bodyParser:{sizeLimit:'32kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 if(!canManageAccounts(auth,ADMIN_EMAIL))return res.status(403).json({error:'Only the approved administrator can set up staff.'})
 let rows;try{rows=staffRows(req.body?.rows,ADMIN_EMAIL)}catch(e){return res.status(400).json({error:e.message})}
 if(!['preview','apply'].includes(req.body?.mode))return res.status(400).json({error:'Review the staff setup before applying it.'})
 try{
  const logins=[]
  for(let page=1;page<=20;page++){
   const list=await auth.admin.auth.admin.listUsers({page,perPage:1000});if(list.error)throw list.error
   logins.push(...list.data.users);if(list.data.users.length<1000)break
   if(page===20)throw new Error('Staff directory is too large for this setup.')
  }
  const profiles=await auth.admin.from('users').select('id,name,email,role,auth_user_id').limit(1001)
  if(profiles.error)throw profiles.error
  if(profiles.data.length>1000)throw new Error('Use a paginated staff setup for schools with more than 1,000 profiles.')
  const plan=rows.map(row=>{
   const matches=profiles.data.filter(p=>p.email?.toLowerCase()===row.email)
   if(matches.length>1)throw new Error('Duplicate staff profiles need to be resolved first.')
   const profile=matches[0],login=logins.find(u=>u.email?.toLowerCase()===row.email)
   if(profile&&profile.role!=='teacher')throw new Error('An email belongs to a different account type. No changes were made.')
   if(profile?.auth_user_id&&profile.auth_user_id!==login?.id)throw new Error('A staff profile has a mismatched login. No changes were made.')
   if(login&&profiles.data.some(p=>p.auth_user_id===login.id&&p.id!==profile?.id))throw new Error('This login is already linked to another profile. No changes were made.')
   if(login&&accountUnavailable(login))throw new Error('A removed account must be restored separately. No changes were made.')
   return {...row,profileId:profile?.id||null,authId:login?.id||null,status:login&&profile?'Already set up':login?'Link existing login':'Create staff login'}
  })
  const confirmation=createHash('sha256').update(JSON.stringify(plan)).digest('hex')
  if(req.body.mode==='preview')return res.json({plan,confirmation})
  if(req.body.confirmation!==confirmation)return res.status(409).json({error:'The staff setup changed. Review it again before applying.'})
  const results=[]
  // Each result is recorded separately so a retry safely finishes a partial setup.
  for(const row of plan){
   try{
    let authId=row.authId
    if(!authId){
     const made=await auth.admin.auth.admin.createUser({email:row.email,email_confirm:false,user_metadata:{name:row.name},app_metadata:{staff_created_by:auth.user.id,staff_created_at:new Date().toISOString()}})
     if(made.error||!made.data?.user?.id)throw new Error('Could not create this login. Retry setup.')
     authId=made.data.user.id
    }
    const patch={name:row.name,email:row.email,role:'teacher',auth_user_id:authId}
    const saved=row.profileId?await auth.admin.from('users').update(patch).eq('id',row.profileId).eq('role','teacher').select('id').maybeSingle():await auth.admin.from('users').insert(patch).select('id').single()
    if(saved.error||!saved.data)throw new Error('Login exists, but the staff profile could not be saved. Retry setup to finish linking it.')
    results.push({name:row.name,email:row.email,status:'Ready',profileId:saved.data.id})
   }catch(e){results.push({name:row.name,email:row.email,status:'Needs retry',error:e.message})}
  }
  return res.json({results,complete:results.every(r=>r.status==='Ready')})
 }catch(e){return res.status(503).json({error:e.message||'Could not review the staff setup. No changes were made.'})}
}
