import { supabase } from './supabase'

async function request(path,{method='GET',body}={}){
 const {data:{session}}=await supabase.auth.getSession()
 if(!session?.access_token)throw new Error('Log in to plan your week.')
 const r=await fetch(path,{method,headers:{Authorization:`Bearer ${session.access_token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const d=await r.json().catch(()=>({error:'Something went wrong. Please try again.'}))
 if(!r.ok)throw Object.assign(new Error(d.error||'Something went wrong. Please try again.'),{status:r.status,conflict:!!d.conflict,existingTitle:d.existingTitle||''})
 return d
}
export const listWeeks=()=>request('/api/lessonplan/weeks')
export const openWeek=id=>request(`/api/lessonplan/weeks?id=${encodeURIComponent(id)}`)
// Puts a saved single lesson into a day of a week. A day that already holds a different lesson
// throws an error with conflict=true; call again with replace=true after the teacher confirms.
export const addLessonToWeek=({lessonId,weekId,weekOf,day,replace=false})=>request('/api/lessonplan/weeks',{method:'POST',body:{action:'addLesson',lessonId,...(weekId?{weekId}:{weekOf}),day,replace}})
export const deleteWeek=id=>request('/api/lessonplan/weeks',{method:'POST',body:{action:'delete',id}})
