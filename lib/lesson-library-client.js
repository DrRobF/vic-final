import {supabase} from './supabase'
export const draftKey=id=>`vic-lesson-draft-v1:${id}`
export async function lessonLibraryRequest(path='',options={}){
 const {ownerId,...requestOptions}=options
 const {data:{session}}=await supabase.auth.getSession()
 if(ownerId&&session?.user.id!==ownerId)throw new Error('Your account changed. Sign in again before saving this lesson.')
 if(!session)throw new Error('Log in to open your saved lessons.')
 const response=await fetch('/api/educator/lessons'+path,{...requestOptions,headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`,...requestOptions.headers}})
 const data=await response.json()
 if(!response.ok)throw new Error(data.error||'Could not save or open your lesson.')
 return data
}
export async function persistLesson(draft,userId){
 const data=await lessonLibraryRequest('',{ownerId:userId,method:'POST',body:JSON.stringify({id:draft.savedLessonId,draft})})
 try{const key=draftKey(userId),cached=JSON.parse(localStorage.getItem(key)||'null');if(cached&&JSON.stringify({...cached,_pendingSave:undefined})===JSON.stringify({...draft,_pendingSave:undefined}))localStorage.setItem(key,JSON.stringify({...cached,_pendingSave:false}))}catch{}
 return data
}
