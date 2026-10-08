import {useEffect,useState} from 'react'
import Head from 'next/head'
import {supabase} from '../lib/supabase'
import VICHeader from '../components/VICHeader'
import MyEducatorLessons from '../components/MyEducatorLessons'
import VICClassroomWorkspace from '../components/VICClassroomWorkspace'

export default function EducatorDashboard(){
 const [account,setAccount]=useState(null),[error,setError]=useState('')
 const [vicPrefill,setVicPrefill]=useState(null)
 function useWithVic(lesson){setVicPrefill({...lesson,key:Date.now()});setTimeout(()=>document.getElementById('classrooms')?.scrollIntoView({behavior:'smooth'}),50)}
 useEffect(()=>{let active=true;(async()=>{
  const {data:{session}}=await supabase.auth.getSession()
  if(!session){window.location.replace('/login');return}
  const response=await fetch('/api/educator/account',{headers:{Authorization:`Bearer ${session.access_token}`}})
  const data=await response.json()
  if(!response.ok)throw new Error(data.error||'Could not open your dashboard.')
  if(active)setAccount(data)
 })().catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[])
 return <main><Head><title>Educator Dashboard | Ask VIC</title></Head><VICHeader currentPath="/educator"/>
 <header className="dashboardHeading"><p className="eyebrow">YOUR EDUCATOR DASHBOARD</p><h1>All your VIC tools. One place.</h1><p>Plan lessons, support student learning, and manage your classroom with the same educator account.</p></header>
 {error?<p role="alert">{error} <a href="/login">Educator log in</a> · <a href="/student-login">Student log in</a></p>:!account?<p role="status">Opening your dashboard…</p>:<>
 <div className="accountBar"><p>Signed in as <strong>{account.email}</strong></p>{account.classroom&&<a href="#classrooms">Jump to your classrooms ↓</a>}</div>
 <section className="cards" aria-label="Your VIC tools">
 <a className="toolCard planning" href="/lessonplan"><p className="eyebrow">PLAN &amp; CREATE</p><h2>Lesson Designer</h2><p>Create a new lesson, refresh an existing one, edit individual sections, and download your materials.</p><strong>Open Lesson Designer →</strong></a>
 {account.classroom?<a className="toolCard learning" href="/askvic"><p className="eyebrow">TEACH &amp; SUPPORT</p><h2>VIC Co-Teacher</h2><p>Open VIC for guided learning. Manage your classes, students, and lesson assignments right below.</p><strong>Open VIC Co-Teacher →</strong></a>:<section className="toolCard learning"><p className="eyebrow">TEACH &amp; SUPPORT</p><h2>VIC Co-Teacher</h2><p>School classroom access is available when your administrator links your educator account to a school.</p><a href="mailto:drrobfurman@gmail.com?subject=VIC%20classroom%20access">Ask about classroom access →</a></section>}
 <a className="toolCard leadership" href="#my-lessons"><p className="eyebrow">PREPARE &amp; FOLLOW THROUGH</p><h2>Teacher Assistant</h2><p>Start with a saved lesson. Prepare materials, draft a family update, adjust tomorrow, or bring instructions into VIC.</p><strong>Choose a lesson below ↓</strong></a>
 </section>
 <div id="my-lessons"><MyEducatorLessons canUseVic={account.classroom} onUseWithVic={useWithVic}/></div>
 <p className="note">For a general weekly plan, message, meeting, or professional learning draft, <a href="/educatorassistant">open your personal assistant</a>.</p>
 {account.manageAccounts&&<section className="adminTools" aria-label="School administration"><div><p className="eyebrow">SCHOOL ADMINISTRATION</p><h2>People &amp; classrooms</h2><p>Edit individual accounts, reset passwords, manage class membership, or upload a roster.</p></div><nav aria-label="Administration tools"><a href="/admin/accounts">Manage accounts →</a><a href="/admin/classrooms">Manage all classrooms →</a><a href="/admin/import-roster">Bulk roster upload →</a></nav></section>}
 {account.classroom&&<section id="classrooms" aria-label="Classroom management"><VICClassroomWorkspace prefillLesson={vicPrefill}/></section>}
 <p className="note">Students use <a href="/student-login">their separate student login</a> to learn with VIC.</p>
 </>}
 <style jsx>{`main{max-width:1240px;margin:auto;padding:24px;color:var(--vic-text-primary)}.dashboardHeading{padding:36px 0 18px}.eyebrow{color:var(--vic-primary);font-weight:800;font-size:10px;letter-spacing:.1em;margin:0 0 14px}h1{font-size:42px;line-height:1.1;letter-spacing:-.035em;margin:12px 0}.dashboardHeading>p:last-child{max-width:750px;font-size:16px;line-height:1.7;color:var(--vic-text-secondary)}.accountBar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 0;border-top:1px solid var(--vic-border-soft);font-size:13px}.accountBar p{margin:0}.accountBar a{color:var(--vic-primary);font-weight:700;text-decoration:none}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin:20px 0 30px}.toolCard{padding:26px;border:1px solid var(--vic-border);border-radius:18px;text-decoration:none;color:var(--vic-text-primary);display:flex;flex-direction:column}.planning{background:#f2e6d6}.learning{background:#edf0e4}.leadership{background:#f0ede6}.toolCard:hover{border-color:var(--vic-primary)}h2{font-size:25px;line-height:1.2;margin:0 0 14px;letter-spacing:-.025em}.toolCard>p:not(.eyebrow),.adminTools p,.note{line-height:1.7;color:var(--vic-text-secondary);font-size:13px}.toolCard strong,.toolCard>a{margin-top:auto;padding-top:16px;color:var(--vic-primary);font-size:13px;font-weight:750;text-decoration:none}.adminTools{display:flex;justify-content:space-between;align-items:center;gap:30px;padding:26px;border:1px solid var(--vic-border);border-radius:18px;background:var(--vic-surface);margin-bottom:30px}.adminTools p:last-child{margin-bottom:0;max-width:550px}.adminTools nav{display:grid;gap:12px;flex-shrink:0}.adminTools a{font-size:13px;font-weight:750;color:var(--vic-primary);text-decoration:none}#classrooms{scroll-margin-top:24px}.note{padding:20px 0;border-top:1px solid var(--vic-border-soft)}.note a{color:var(--vic-primary)}@media(max-width:800px){main{padding:16px}.cards{grid-template-columns:1fr}.adminTools{align-items:flex-start;flex-direction:column}.accountBar{align-items:flex-start;flex-direction:column}h1{font-size:34px}.toolCard{padding:24px}}`}</style>
 </main>
}
