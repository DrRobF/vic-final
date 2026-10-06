import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireLessonEducator(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 return res.json({email:auth.user.email,role:auth.profile?.role||'educator',classroom:auth.profile?.role==='teacher',principal:['teacher','principal'].includes(auth.profile?.role),manageAccounts:canManageAccounts(auth,ADMIN_EMAIL)})
}
