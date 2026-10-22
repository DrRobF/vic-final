import {requireLessonEducator} from '../../../lib/lesson-designer-auth'
import {canManageAccounts} from '../../../lib/educator-account.mjs'
import {ADMIN_EMAIL} from '../../../lib/roster-import'
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed.'})}
 const auth=await requireLessonEducator(req)
 if(auth.error)return res.status(auth.status).json({error:auth.error})
 const {data:lead}=await auth.admin.from('ap_memberships').select('school_id').eq('auth_user_id',auth.user.id).limit(1)
 // An aide who runs a VIC Room and has no classes of their own starts the day on the room screen.
 let roomAide=false
 if(auth.profile?.id){const [{data:rooms},{data:own}]=await Promise.all([auth.admin.from('vic_rooms').select('id').contains('staff_ids',[auth.profile.id]).limit(1),auth.admin.from('classes').select('id').eq('teacher_id',auth.profile.id).limit(1)]);roomAide=!!rooms?.length&&!own?.length}
 return res.json({leader:!!lead?.length,email:auth.user.email,role:auth.profile?.role||'educator',classroom:auth.profile?.role==='teacher',principal:['teacher','principal'].includes(auth.profile?.role),manageAccounts:canManageAccounts(auth,ADMIN_EMAIL),roomAide})
}
