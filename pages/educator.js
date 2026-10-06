import {useEffect,useState} from 'react'
import Head from 'next/head'
import {supabase} from '../lib/supabase'
import VICHeader from '../components/VICHeader'
export default function Educator(){
 const [account,setAccount]=useState(null),[error,setError]=useState('')
 useEffect(()=>{let active=true;(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){window.location.replace('/login');return}
  const r=await fetch('/api/educator/account',{headers:{Authorization:`Bearer ${session.access_token}`}}),d=await r.json()
  if(!r.ok)throw new Error(d.error||'Could not open your workspace.')
  if(active)setAccount(d)
 })().catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 return <main><Head><title>Educator workspace | Ask VIC</title></Head><VICHeader currentPath="/educator"/><header><p>YOUR EDUCATOR WORKSPACE</p><h1>One account. More time to teach.</h1><p>Move between your tools without logging in again.</p></header>{error?<p role="alert">{error} <a href="/login">Educator login</a> · <a href="/student-login">Student login</a></p>:!account?<p role="status">Opening your workspace…</p>:<><p>Signed in as <strong>{account.email}</strong></p><div className="cards"><a href="/lessonplan"><h2>Lesson Designer</h2><p>Create, refresh, edit and download classroom-ready lessons.</p><strong>Open Lesson Designer →</strong></a>{account.classroom?<a href="/teacher"><h2>VIC classroom</h2><p>Manage your classes, students and assignments from Teacher Portal.</p><strong>Open Teacher Portal →</strong></a>:<section><h2>VIC classroom</h2><p>Your free account includes Lesson Designer. School classroom tools are available when your administrator links your existing account to a school.</p></section>}{account.principal&&<a href="/assistantprincipal"><h2>Assistant Principal</h2><p>Open your existing leadership workspace.</p><strong>Open workspace →</strong></a>}{account.manageAccounts&&<a href="/admin/accounts"><h2>Manage people</h2><p>Edit accounts, reset passwords, manage classrooms and upload student rosters.</p><strong>Manage accounts →</strong></a>}</div><p className="note">Students use <a href="/student-login">their separate student login</a> for learning with VIC.</p></>}<style jsx>{`main{max-width:1100px;margin:auto;padding:24px}header{padding:36px 0 18px}header>p:first-child{color:var(--vic-primary);font-weight:800;font-size:12px;letter-spacing:.1em}h1{font-size:42px;margin:12px 0}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin:28px 0}.cards>a,.cards>section{padding:28px;background:var(--vic-surface);border:1px solid var(--vic-border);border-radius:18px;text-decoration:none;color:var(--vic-text-primary);box-shadow:var(--vic-shadow-card)}.cards a:hover{border-color:var(--vic-primary)}h2{margin-top:0}.cards p,header p,.note{line-height:1.6;color:var(--vic-text-secondary)}strong{color:var(--vic-primary)}.note{padding:20px 0}`}</style></main>
}
