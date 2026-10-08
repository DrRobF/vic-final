import {useEffect,useState} from 'react'
import Head from 'next/head'
import {useRouter} from 'next/router'
import {supabase} from '../lib/supabase'
import VICHeader from '../components/VICHeader'
import ParentLetterStudio from '../components/ParentLetterStudio'

export default function ParentLettersPage(){
 const router=useRouter()
 const [classes,setClasses]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{let active=true;(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){router.replace('/login');return}
  const response=await fetch('/api/educator/account',{headers:{Authorization:`Bearer ${session.access_token}`}})
  const account=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(account.error||'Could not open Parent Letters.')
  if(!account.classroom)throw new Error('Parent Letters requires an educator classroom account.')
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)throw new Error('Please sign in again to open Parent Letters.')
  const {data:byAuth,error:teacherError}=await supabase.from('users').select('id,role').eq('auth_user_id',user.id).limit(1)
  if(teacherError)throw teacherError
  let teacher=byAuth?.[0]
  if(!teacher&&user.email){const {data:byEmail,error:emailError}=await supabase.from('users').select('id,role').eq('email',user.email).limit(1);if(emailError)throw emailError;teacher=byEmail?.[0]}
  if(!teacher||teacher.role!=='teacher')throw new Error('Could not find your teacher profile.')
  const {data:classRows,error:classError}=await supabase.from('classes').select('id,class_name,grade_level').eq('teacher_id',teacher.id).order('created_at',{ascending:true})
  if(classError)throw classError
  if(active)setClasses(classRows||[])
 })().catch(e=>{if(active)setError(e.message||'Could not load your classes.')}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[router])

 const requestedClass=Array.isArray(router.query.classId)?router.query.classId[0]:router.query.classId
 const chosenClass=classes.find(item=>String(item.id)===String(requestedClass))||classes[0]
 const requestedStudent=Array.isArray(router.query.studentId)?router.query.studentId[0]:router.query.studentId
 const focusStudentId=requestedClass&&String(chosenClass?.id)===String(requestedClass)&&/^\d+$/.test(String(requestedStudent))?Number(requestedStudent):null

 return <main><Head><title>Parent Letters | Ask VIC</title></Head><VICHeader currentPath="/educator"/>
  <div className="breadcrumbs"><a href="/educator">← Educator Dashboard</a><a href="/educator#classrooms">Classrooms and lesson assignment</a></div>
  <header className="pageHeader"><p className="eyebrow">TEACHER ASSISTANT · FAMILY COMMUNICATION</p><h1>Parent Letters</h1><p>Bring together your classroom notes, lesson goals, and VIC reports. Edit and approve each personal letter before you send it.</p></header>
  {loading?<p role="status">Opening your classes…</p>:error?<p role="alert">{error} <a href="/educator">Return to your dashboard</a></p>:classes.length===0?<div className="empty"><h2>Create a class to get started</h2><p>Parent Letters uses the students in your VIC classroom roster.</p><a href="/educator#classrooms">Set up your classroom →</a></div>:<>
   <div className="classPicker"><label htmlFor="letter-class">Choose a class</label><select id="letter-class" value={chosenClass.id} onChange={event=>router.push(`/parentletters?classId=${encodeURIComponent(event.target.value)}`)}>{classes.map(item=><option key={item.id} value={item.id}>{item.class_name}{item.grade_level?` · Grade ${item.grade_level}`:''}</option>)}</select><a href="/educator#classrooms">Manage roster →</a></div>
   <ParentLetterStudio key={chosenClass.id} classId={chosenClass.id} focusStudentId={focusStudentId}/>
  </>}
  <style jsx>{`main{max-width:1240px;margin:auto;padding:24px;color:var(--vic-text-primary)}.breadcrumbs{display:flex;gap:20px;flex-wrap:wrap;margin:28px 0 10px}.breadcrumbs a,.classPicker a,.empty a{color:var(--vic-primary);font-size:13px;font-weight:750;text-decoration:none}.pageHeader{padding:18px 0 16px}.eyebrow{color:var(--vic-primary);font-weight:800;font-size:10px;letter-spacing:.1em}.pageHeader h1{font-size:42px;line-height:1.1;letter-spacing:-.035em;margin:10px 0}.pageHeader>p:last-child{max-width:730px;color:var(--vic-text-secondary);font-size:16px;line-height:1.7}.classPicker{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 20px;border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface)}.classPicker label{font-size:13px;font-weight:750}.classPicker select{min-width:240px;max-width:100%;padding:10px;border:1px solid var(--vic-border);border-radius:8px;background:white;font:inherit}.classPicker a{margin-left:auto}.empty{padding:28px;border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface)}.empty p{color:var(--vic-text-secondary)}@media(max-width:700px){main{padding:16px}.pageHeader h1{font-size:34px}.classPicker select{width:100%}.classPicker a{margin-left:0}}`}</style>
 </main>
}
