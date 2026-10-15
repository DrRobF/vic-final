import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { useAccount } from '../../lib/use-account'
import { supabase } from '../../lib/supabase'

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}

// Back office: the things you set up once and rarely touch. Daily work stays on the dashboard.
export default function SchoolSetup() {
 const { account, error: accountError } = useAccount({ next: '/school/setup' })
 const [school, setSchool] = useState(null), [copied, setCopied] = useState(false)
 useEffect(() => {
  if (!account?.leader) return
  api('/api/assistantprincipal/walkthroughs').then(d => d.schools?.[0]?.id ? api(`/api/assistantprincipal/walkthroughs?schoolId=${encodeURIComponent(d.schools[0].id)}`) : null).then(d => setSchool(d?.school || {})).catch(() => setSchool({}))
 }, [account])
 async function copy() { try { await navigator.clipboard.writeText(school.joinCode); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }

 const groups = [
  ['People', [
   ['/school?staff=new', '+ Add a staff member', 'One form, then a checklist for code, login and class.', true],
   ['/assistantprincipal', 'Staff list & weekly deadlines', 'Who’s on staff, what’s due each week, the weekly brief.'],
   account?.manageAccounts && ['/admin/accounts', 'Logins & passwords', 'Create teacher and student logins, reset passwords.'],
   account?.manageAccounts && ['/admin/staff-setup', 'Add many staff logins at once', 'Paste a list of names and emails.'],
  ]],
  ['Students & classes', [
   account?.manageAccounts && ['/admin/classrooms', 'Classrooms', 'Create classes for teachers and manage rosters.'],
   account?.manageAccounts && ['/admin/import-roster', 'Upload a roster', 'Add a whole class from a spreadsheet.'],
  ]],
  ['Check-in & pay', [
   ['/school/attendance', 'Check-in kiosks, codes & sheets', 'Set up a check-in computer, staff codes, school hours, announcements, your Google Sheets.'],
   ['/school/payroll', 'Payroll settings', 'Pay periods, max paid hours a day, business manager email.'],
  ]],
  ['Walkthroughs', [
   ['/walkthroughs?tab=staff', 'Walkthrough phone app & join code', 'Put Walkthroughs on your phone’s home screen.'],
  ]],
 ].map(([t, items]) => [t, items.filter(Boolean)]).filter(([, items]) => items.length)

 return <PageShell title="Setup" currentPath="/school/setup">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account ? <p role="status">Opening…</p> : !account.leader && !account.manageAccounts ? <p className="alert">Setup is for school leaders.</p> : <>
   <a className="back" href="/school">← Dashboard</a>
   <header><p className="label">Setup</p><h1>School setup</h1><p className="muted">Things you set up once and come back to now and then. Your daily view is the dashboard.</p></header>
   {groups.map(([title, items]) => <section key={title}>
    <h2>{title}</h2>
    <div className="grid">{items.map(([href, t, d, main]) => <a key={href} className={`panel tile ${main ? 'main' : ''}`} href={href}><strong>{t}</strong><span>{d}</span></a>)}</div>
   </section>)}
   {school?.joinCode && <section className="panel join">
    <div><p className="label">Join code</p><p className="code">{school.joinCode}</p><p>Teachers enter this at askvic.ai/join so their lesson plans come to you. {school.seatsUsed} of {school.seatLimit} seats used by staff who log in. Everyone else on your staff list is free.</p></div>
    <button type="button" className="btn btn-volt" onClick={copy}>{copied ? '✓ Copied' : 'Copy code'}</button>
   </section>}
  </>}
  <style jsx>{`
   .back{font-weight:800;text-decoration:none;display:inline-block;margin-top:12px}
   h1{margin:0 0 6px;font-size:clamp(28px,3.2vw,40px)}
   h2{font-size:19px;margin:24px 0 10px}
   .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
   .tile{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--vic-text-primary);padding:18px}
   .tile strong{font-size:17px}
   .tile span{color:var(--vic-text-secondary);font-size:15px;line-height:1.5}
   .tile:hover{border-color:var(--vic-primary)}
   .main{border:2px solid var(--vic-primary)}
   .join{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;margin-top:24px}
   .code{font-family:var(--font-mono);letter-spacing:.08em;font-size:28px;font-weight:800;color:var(--vic-text-primary)!important}
  `}</style>
 </PageShell>
}
