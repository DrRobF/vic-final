import {newPasswordError} from './password-policy.mjs'
export function accountUnavailable(user){return user?.app_metadata?.account_disabled===true||Boolean(user?.banned_until&&new Date(user.banned_until).getTime()>Date.now())}
export function accountAction(body,profile,actor){
 const id=Number(body?.id)
 if(!Number.isSafeInteger(id)||id<=0||id!==profile?.id)throw new Error('Select a valid account.')
 if(id===actor.profile.id||profile.auth_user_id===actor.user.id)throw new Error('Use your own account settings. You cannot remove or reset your administrator account here.')
 if(!['teacher','student','principal','archived'].includes(profile.role))throw new Error('This account cannot be managed here.')
 if(!['reset-password','archive','restore'].includes(body?.action))throw new Error('Choose an account action.')
 if(body.confirm!==`${body.action}:${id}`)throw new Error('Confirm the action for this person.')
 if(body.action==='reset-password'){
  if(profile.role==='archived')throw new Error('Restore this account before resetting its password.')
  const error=newPasswordError(body.password);if(error)throw new Error(error)
 }
 if(body.action==='restore'&&profile.role!=='archived')throw new Error('This account is already active.')
 if(body.action==='archive'&&profile.role==='archived')throw new Error('This account is already removed.')
 return {id,action:body.action}
}
export function classroomPatch(body){
 const teacherId=Number(body?.teacherId),name=typeof body?.name==='string'?body.name.trim():''
 if(!Number.isSafeInteger(teacherId)||teacherId<=0)throw new Error('Choose the classroom teacher.')
 if(!name||name.length>150)throw new Error('Enter a classroom name of 1–150 characters.')
 const raw=String(body?.grade??'').trim().toLowerCase(),grade=['k','kindergarten'].includes(raw)?0:raw===''?null:Number(raw)
 if(grade!==null&&(!Number.isInteger(grade)||grade<0||grade>12))throw new Error('Choose Kindergarten or grade 1–12.')
 return {teacher_id:teacherId,class_name:name,grade_level:grade}
}
export function enrollmentAction(body){
 const classId=Number(body?.classId),studentId=Number(body?.studentId)
 if(![classId,studentId].every(n=>Number.isSafeInteger(n)&&n>0))throw new Error('Choose a classroom and student.')
 if(!['add','remove'].includes(body?.action))throw new Error('Choose add or remove.')
 if(body.action==='remove'&&body.confirm!==`remove:${classId}:${studentId}`)throw new Error('Confirm removing this student from this class.')
 return {classId,studentId,action:body.action}
}
