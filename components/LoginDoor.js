import Head from 'next/head'
import { useEffect } from 'react'
import VICHeader from './VICHeader'
import EducatorAuth from './EducatorAuth'
import SchoolAccountLogin from './SchoolAccountLogin'
import { saveMode } from '../lib/view-mode'

const DOORS = {
 teacher: { title: 'Teacher log in', eyebrow: 'For teachers', h1: <>Plan it. Print it.<br />Teach it with <em>VIC</em>.</>, intro: 'Your week, your lessons and your classes in one place.' },
 school: { title: 'School leader log in', eyebrow: 'For principals & school leaders', h1: <>Your school,<br /><em>this week</em>.</>, intro: 'Lesson plans, walkthroughs, staff and accounts. Teach a class too? Switch any time.' },
 student: { title: 'Student log in', eyebrow: 'For students', h1: <>Ready to learn?</>, intro: 'Type the username and password your teacher gave you.' },
}
export const DOOR_LINKS = [['teacher', '/login', 'Teacher'], ['school', '/school-login', 'School leader'], ['student', '/student-login', 'Student']]

// One of the three front doors. Teachers and school leaders share an account system; the door decides where they land.
export default function LoginDoor({ kind }) {
 const door = DOORS[kind]
 useEffect(() => { if (kind === 'school') saveMode('school'); else if (kind === 'teacher') saveMode('teacher') }, [kind])
 return <div className={`door ${kind}`}>
  <Head><title>{`${door.title} | AskVic`}</title></Head>
  <div className="wrap"><VICHeader currentPath="/login" /></div>
  <main>
   <section className="hero">
    <p className="eyebrow">{door.eyebrow}</p>
    <h1>{door.h1}</h1>
    <p className="intro">{door.intro}</p>
    <nav className="switch" aria-label="Choose your log in">{DOOR_LINKS.map(([k, href, label]) => <a key={k} href={href} aria-current={k === kind ? 'page' : undefined} className={k === kind ? 'on' : ''}>{label}</a>)}</nav>
   </section>
   <section className="card">
    {kind === 'student' ? <SchoolAccountLogin student /> : <>
     <EducatorAuth mode="login" />
     <details><summary>Use my school password instead</summary><SchoolAccountLogin /></details>
    </>}
   </section>
  </main>
  <style jsx>{`
   .door{min-height:100vh;background:radial-gradient(1200px 500px at 85% -10%,rgba(34,211,238,.18),transparent 60%),var(--vic-ink);color:var(--vic-ink-text)}
   .door.student{background:radial-gradient(1000px 500px at 80% -10%,rgba(167,139,250,.3),transparent 60%),var(--vic-ink)}
   .wrap{max-width:1240px;margin:0 auto;padding:16px 24px 0}
   main{max-width:1100px;margin:0 auto;padding:48px 24px 72px;display:grid;grid-template-columns:1fr minmax(0,480px);gap:48px;align-items:center}
   .eyebrow{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;color:var(--vic-cyan);margin:0 0 12px}
   .student .eyebrow{color:var(--vic-vic-glow)}
   h1{font-family:var(--font-head);font-size:clamp(38px,5vw,60px);line-height:1.04;margin:0 0 16px;color:#fff}
   h1 :global(em){font-style:normal;color:var(--vic-volt)}
   .intro{font-size:19px;line-height:1.6;color:var(--vic-ink-muted);max-width:480px;margin:0}
   .student h1,.student .intro{font-family:var(--font-read)}
   .switch{display:inline-flex;gap:4px;padding:5px;margin-top:28px;border-radius:14px;background:var(--vic-ink-2);border:1px solid var(--vic-ink-line)}
   .switch a{padding:10px 16px;border-radius:10px;color:var(--vic-ink-muted);font-weight:800;text-decoration:none;font-size:15px}
   .switch a.on{background:#fff;color:var(--vic-ink)}
   .card{background:var(--vic-surface);color:var(--vic-text-primary);border-radius:20px;padding:28px;box-shadow:0 30px 80px rgba(0,0,0,.35)}
   .student .card{font-family:var(--font-read);font-size:20px}
   details{margin-top:18px;padding-top:16px;border-top:1px solid var(--vic-border-soft)}
   summary{font-weight:800;cursor:pointer;margin-bottom:12px}
   @media(max-width:860px){main{grid-template-columns:1fr;gap:28px;padding:28px 16px 56px}.wrap{padding:10px 14px 0}}
  `}</style>
 </div>
}
