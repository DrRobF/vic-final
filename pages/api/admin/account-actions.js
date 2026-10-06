import {requireApprovedProfile} from '../../../lib/server-auth'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {accountAction} from '../../../lib/admin-management.mjs'
export const config={api:{bodyParser:{sizeLimit:'4kb'}}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireApprovedProfile(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 if(!canManageAccounts(auth,ADMIN_EMAIL))return res.status(403).json({error:'Only the approved school administrator can manage accounts.'})
 try{
  const id=Number(req.body?.id)
  if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'Select a valid account.'})
  const lookup=await auth.admin.from('users').select('id,name,email,role,auth_user_id').eq('id',id).maybeSingle()
  if(lookup.error)throw lookup.error
  const profile=lookup.data;if(!profile)return res.status(404).json({error:'Account not found.'})
  let action;try{action=accountAction(req.body,profile,auth).action}catch(e){return res.status(400).json({error:e.message})}
  if(!profile.auth_user_id)return res.status(409).json({error:'This profile is not linked to a login. Its access cannot be changed until the login is linked.'})
  const duplicates=await auth.admin.from('users').select('id').eq('auth_user_id',profile.auth_user_id)
  if(duplicates.error||duplicates.data?.length!==1)return res.status(409).json({error:'The login is linked to more than one profile. No account changes were made.'})
  const {data,error}=await auth.admin.auth.admin.getUserById(profile.auth_user_id)
  const user=data?.user
  if(error||!user||user.email?.toLowerCase()!==profile.email?.toLowerCase())return res.status(409).json({error:'Could not verify this person’s login. No changes were made.'})
  const stamp={account_managed_by:auth.user.id,account_managed_at:new Date().toISOString()}
  if(action==='reset-password'){
   const result=await auth.admin.auth.admin.updateUserById(user.id,{password:req.body.password,app_metadata:{...user.app_metadata,...stamp,must_change_password:profile.role!=='student'}})
   if(result.error)return res.status(400).json({error:'Could not reset the password. Choose a stronger password and try again.'})
   return res.json({success:true,message:profile.role==='student'?'Password reset. Give the student their new password.':'Temporary password reset. This staff member must choose a personal password at their next login.'})
  }
  const restore=action==='restore',originalRole=restore?user.app_metadata?.archived_school_role:profile.role
  if(!['teacher','student','principal'].includes(originalRole))return res.status(409).json({error:'Could not verify the original account type for restoration.'})
  const remainingBan=value=>{const ms=new Date(value||0).getTime()-Date.now();return Number.isFinite(ms)&&ms>0?`${Math.ceil(ms)}ms`:'none'}
  const metadata={...user.app_metadata,...stamp,account_disabled:!restore,archived_school_role:originalRole,...(!restore?{archived_previous_ban_until:user.banned_until||null}:{})}
  // Ban first when removing; restore the school profile before unbanning.
  if(!restore){
   const ban=await auth.admin.auth.admin.updateUserById(user.id,{ban_duration:'876000h',app_metadata:metadata})
   if(ban.error)throw ban.error
  }
  const changed=await auth.admin.from('users').update({role:restore?originalRole:'archived'}).eq('id',profile.id).eq('role',profile.role).select('id,name,email,role,parent_email,interest_tags').maybeSingle()
  if(changed.error||!changed.data){
   if(!restore)await auth.admin.auth.admin.updateUserById(user.id,{ban_duration:remainingBan(user.banned_until),app_metadata:user.app_metadata})
   return res.status(409).json({error:'The account changed while saving. Reload and try again.'})
  }
  if(restore){
   const unban=await auth.admin.auth.admin.updateUserById(user.id,{ban_duration:remainingBan(user.app_metadata?.archived_previous_ban_until),app_metadata:metadata})
   if(unban.error){await auth.admin.from('users').update({role:'archived'}).eq('id',profile.id);return res.status(503).json({error:'Could not restore login access. The account remains removed; try Restore again.'})}
  }
  return res.json({success:true,account:changed.data,message:restore?'Account restored. Existing classrooms and work are available again.':'Account removed from active access. Its saved work and classrooms are retained, and you can restore it here.'})
 }catch{return res.status(503).json({error:'Could not complete the account action. Reload the account list before trying again.'})}
}
