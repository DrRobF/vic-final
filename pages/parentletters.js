import {useEffect,useState} from 'react'
import Head from 'next/head'
import {useRouter} from 'next/router'
import {supabase} from '../lib/supabase'
import VICHeader from '../components/VICHeader'
import ParentLetterStudio from '../components/ParentLetterStudio'
import QuickParentEmail from '../components/QuickParentEmail'
import ClassLetter from '../components/ClassLetter'

// Family Letters: the one home for everything a teacher sends to families.
const MODES=[
 {key:'quick',label:'Quick email from notes',hint:'Jot a few notes. VIC writes the email.'},
 {key:'student',label:'One student letter',hint:'For one child: your notes, comments, VIC report, lesson goals.'},
 {key:'class',label:'Whole-class letter',hint:'One standard letter for every family in your class.'},
]

export default function ParentLettersPage(){
 const router=useRouter()
 const [account,setAccount]=useState(null)
 const [classes,setClasses]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{let active=true;(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){router.replace('/login?next=/parentletters');return}
  const response=await fetch('/api/educator/account',{headers:{Authorization:`Bearer ${session.access_token}`}})
  const acct=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(acct.error||'Could not open Family Letters.')
  if(active)setAccount(acct)
  if(!acct.classroom)return
  const {data:{user},error:authError}=await supabase.auth.getUser()
  if(authError||!user)throw new Error('Please sign in again to open Family Letters.')
  const {data:byAuth,error:teacherError}=await supabase.from('users').select('id,role').eq('auth_user_id',user.id).limit(1)
  if(teacherError)throw teacherError
  let teacher=byAuth?.[0]
  if(!teacher&&user.email){const {data:byEmail,error:emailError}=await supabase.from('users').select('id,role').eq('email',user.email).limit(1);if(emailError)throw emailError;teacher=byEmail?.[0]}
  if(!teacher||teacher.role!=='teacher')return
  const {data:classRows,error:classError}=await supabase.from('classes').select('id,class_name,grade_level').eq('teacher_id',teacher.id).order('created_at',{ascending:true})
  if(classError)throw classError
  if(active)setClasses(classRows||[])
 })().catch(e=>{if(active)setError(e.message||'Could not open Family Letters.')}).finally(()=>{if(active)setLoading(false)})
 return()=>{active=false}
 },[router])

 const q=key=>Array.isArray(router.query[key])?router.query[key][0]:router.query[key]
 const requestedClass=q('classId')
 const requestedMode=q('mode')
 const mode=MODES.some(m=>m.key===requestedMode)?requestedMode:requestedClass?'student':'quick'
 const chosenClass=classes.find(item=>String(item.id)===String(requestedClass))||classes[0]
 const requestedStudent=q('studentId')
 const focusStudentId=requestedClass&&String(chosenClass?.id)===String(requestedClass)&&/^\d+$/.test(String(requestedStudent))?Number(requestedStudent):null
 const go=(next,extra='')=>router.push(`/parentletters?mode=${next}${extra}`,undefined,{shallow:true})

 return <main><Head><title>Family Letters | Ask VIC</title><meta name="description" content="Write parent emails from quick notes, personalized student letters, and class updates in one place."/></Head><VICHeader currentPath="/educator"/>
  <div className="breadcrumbs"><a href="/educator">← Educator Dashboard</a></div>
  <header className="pageHeader"><p className="eyebrow">FAMILY COMMUNICATION</p><h1>Family Letters</h1><p>Everything you send to families, in one place. Pick the kind of message, add what you want, and review it before anything goes out.</p></header>
  <nav className="modes" aria-label="Kind of family message">{MODES.map(m=><button key={m.key} type="button" aria-pressed={mode===m.key} onClick={()=>go(m.key)}><strong>{m.label}</strong><span>{m.hint}</span></button>)}</nav>
  {loading?<p role="status">Opening Family Letters…</p>:error?<p role="alert">{error} <a href="/educator">Return to your dashboard</a></p>:
   mode==='quick'?<QuickParentEmail/>:
   mode==='class'?<ClassLetter/>:
   !account?.classroom?<div className="empty"><h2>Student letters use your VIC classroom roster</h2><p>Your account doesn’t have a VIC classroom yet. You can still write any parent email with <a href="/parentletters?mode=quick">Quick email from notes</a>.</p></div>:
   classes.length===0?<div className="empty"><h2>Create a class to get started</h2><p>Student letters use the students in your VIC classroom roster.</p><a href="/educator#classrooms">Set up your classroom →</a></div>:<>
   <div className="classPicker"><label htmlFor="letter-class">Choose a class</label><select id="letter-class" value={chosenClass.id} onChange={event=>go('student',`&classId=${encodeURIComponent(event.target.value)}`)}>{classes.map(item=><option key={item.id} value={item.id}>{item.class_name}{item.grade_level?` · Grade ${item.grade_level}`:''}</option>)}</select><a href="/educator#classrooms">Manage roster →</a></div>
      <ParentLetterStudio key={chosenClass.id} classId={chosenClass.id} focusStudentId={focusStudentId} single/>
  </>}
  <style jsx>{`main{max-width:1240px;margin:auto;padding:24px;color:var(--vic-text-primary)}.breadcrumbs{display:flex;gap:20px;flex-wrap:wrap;margin:28px 0 10px}.breadcrumbs a,.classPicker a,.empty a{color:var(--vic-primary);font-size:13px;font-weight:750;text-decoration:none}.pageHeader{padding:18px 0 16px}.eyebrow{color:var(--vic-primary);font-weight:800;font-size:10px;letter-spacing:.1em}.pageHeader h1{font-size:42px;line-height:1.1;letter-spacing:-.035em;margin:10px 0}.pageHeader>p:last-child{max-width:730px;color:var(--vic-text-secondary);font-size:16px;line-height:1.7}.classPicker{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:18px 20px;border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface)}.classPicker label{font-size:13px;font-weight:750}.classPicker select{min-width:240px;max-width:100%;padding:10px;border:1px solid var(--vic-border);border-radius:8px;background:white;font:inherit}.classPicker a{margin-left:auto}.empty{padding:28px;border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface)}.empty p{color:var(--vic-text-secondary)}.modes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:0 0 22px}.modes button{text-align:left;padding:16px 18px;border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface);color:var(--vic-text-primary);cursor:pointer;font:inherit}.modes button strong{display:block;font-size:15px;margin-bottom:4px}.modes button span{font-size:12px;line-height:1.5;color:var(--vic-text-secondary)}.modes button[aria-pressed=true]{border-color:var(--vic-primary);box-shadow:inset 0 0 0 1px var(--vic-primary);background:#fff}.modes button[aria-pressed=true] strong{color:var(--vic-primary)}.tip{font-size:13px;line-height:1.6;color:var(--vic-text-secondary);margin:14px 2px}.empty a{display:inline}@media(max-width:700px){.modes{grid-template-columns:1fr}main{padding:16px}.pageHeader h1{font-size:34px}.classPicker select{width:100%}.classPicker a{margin-left:0}}`}</style>
 </main>
}
