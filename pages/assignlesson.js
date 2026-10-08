import {useEffect,useState} from 'react'
import Head from 'next/head'
import {useRouter} from 'next/router'
import {supabase} from '../lib/supabase'
import {validLessonId,lessonLink} from '../lib/educator-lessons.mjs'
import VICHeader from '../components/VICHeader'
import VICClassroomWorkspace from '../components/VICClassroomWorkspace'

export default function AssignLessonPage(){
 const router=useRouter()
 const [lesson,setLesson]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
 const lessonId=typeof router.query.lessonId==='string'?router.query.lessonId:''
 useEffect(()=>{if(!router.isReady)return;let active=true;setLoading(true);setError('');setLesson(null);(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){router.replace('/login');return}
  const headers={Authorization:`Bearer ${session.access_token}`}
  const accountResponse=await fetch('/api/educator/account',{headers})
  const account=await accountResponse.json().catch(()=>({}))
  if(!accountResponse.ok)throw new Error(account.error||'Could not open your classroom tools.')
  if(!account.classroom)throw new Error('VIC lesson assignment requires a school classroom account.')
  if(!validLessonId(lessonId))throw new Error('Choose a saved lesson from My Lessons to assign in VIC.')
  const response=await fetch(`/api/educator/lesson-companion?lessonId=${encodeURIComponent(lessonId)}`,{headers})
  const result=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(result.error||'Could not open your saved lesson.')
  if(!result.lesson?.vicText)throw new Error(result.lesson?.vicError||'Add a standard and learning objectives to this lesson first.')
  if(active)setLesson({title:result.lesson.title,text:result.lesson.vicText,key:lessonId})
 })().catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[router.isReady,lessonId])
 return <main><Head><title>Assign a Lesson in VIC | Ask VIC</title></Head><VICHeader currentPath="/educator"/>
  <nav className="backLinks" aria-label="Lesson navigation"><a href="/educator#my-lessons">← My Lessons</a>{validLessonId(lessonId)&&<a href={lessonLink(lessonId)}>Edit this lesson →</a>}</nav>
  <header><p className="eyebrow">VIC CLASSROOM ASSIGNMENT</p><h1>Give your lesson to students</h1><p>Your standard and objectives are ready. Choose a class, review the goals, select students, then click <strong>Assign lesson</strong>. VIC adapts the teaching to each student’s saved support level.</p></header>
  {loading?<p role="status">Opening your lesson…</p>:error?<p role="alert">{error} <a href="/educator#my-lessons">Return to My Lessons</a></p>:lesson&&<VICClassroomWorkspace assignmentMode prefillLesson={lesson}/>}
  <style jsx>{`main{max-width:1240px;margin:auto;padding:24px;color:var(--vic-text-primary)}.backLinks{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0}.backLinks a{color:var(--vic-primary);font-size:13px;font-weight:750;text-decoration:none}header{padding:8px 0 24px}.eyebrow{color:var(--vic-primary);font-size:10px;font-weight:800;letter-spacing:.1em}h1{font-size:36px;margin:10px 0;line-height:1.15}header>p:last-child{max-width:820px;color:var(--vic-text-secondary);font-size:15px;line-height:1.7}@media(max-width:700px){main{padding:16px}h1{font-size:29px}}`}</style>
 </main>
}
