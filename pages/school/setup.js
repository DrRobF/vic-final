import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { useAccount } from '../../lib/use-account'
import { supabase } from '../../lib/supabase'

async function post(body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch('/api/school/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'That didn’t save.')
 return d
}
async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}

const fmtFirst = d => new Date(`${String(d).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

// Back office: the things you set up once and rarely touch. Daily work stays on the dashboard.
export default function SchoolSetup() {
 const { account, error: accountError } = useAccount({ next: '/school/setup' })
 const [school, setSchool] = useState(null), [copied, setCopied] = useState(false)
 const [att, setAtt] = useState(null), [from, setFrom] = useState(''), [saving, setSaving] = useState(false), [saved, setSaved] = useState(''), [oops, setOops] = useState('')
 useEffect(() => {
  if (!account?.leader) return
  api('/api/assistantprincipal/walkthroughs').then(d => d.schools?.[0]?.id ? api(`/api/assistantprincipal/walkthroughs?schoolId=${encodeURIComponent(d.schools[0].id)}`) : null).then(d => setSchool(d?.school || {})).catch(() => setSchool({}))
 }, [account])
 // The date AskVic starts counting days off from. Before AskVic, those days lived on paper.
 useEffect(() => {
  if (!account?.leader) return
  api('/api/school/attendance').then(d => d.schools?.[0]?.id ? api(`/api/school/attendance?schoolId=${encodeURIComponent(d.schools[0].id)}`) : null)
   .then(d => { if (d) { setAtt(d); setFrom(d.school?.leaveFrom || '') } }).catch(() => {})
 }, [account])
 async function saveFrom(e) {
  e.preventDefault(); setSaving(true); setSaved(''); setOops('')
  try { await post({ schoolId: att.school.id, action: 'leave_from', from }); setSaved('Saved.') }
  catch (e) { setOops(e.message) } finally { setSaving(false) }
 }

 async function copy() { try { await navigator.clipboard.writeText(school.joinCode); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }

 const groups = [
  ['People', [
   ['/school?staff=new', '+ Add a staff member', 'One form, then a checklist for code, login and class.', true],
   ['/school/staff-upload', 'Upload a whole staff list', 'A CSV for a new school, or a batch of new hires. Nobody already on the board is duplicated.'],
   ['/assistantprincipal', 'Staff list & weekly deadlines', 'Who’s on staff, what’s due each week, the weekly brief.'],
   // Called "Logins & passwords" until 29 October, which is why nobody could find where to
   // edit a child. It is the only screen that edits a student at all -- name, their grade,
   // parent email, interests -- and the sign on the door mentioned none of it.
   account?.manageAccounts && ['/admin/accounts', 'Students & staff', 'Edit a child’s name, grade, parent email and interests. Create logins and reset passwords.'],
  ]],
  ['Students & classes', [
   ['/school/students', 'Student logins', 'Every student and the username they sign in with. Downloadable.'],
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
   {att && <section className="panel">
    <p className="label">Days off</p>
    <h2>When should AskVic start counting days off?</h2>
    <p className="muted">AskVic can only count days it has check-ins for. Your check-ins start {att.firstDay ? fmtFirst(att.firstDay) : 'when your kiosk went in'}. Set the date the count should start from, then type each person’s days already used under their Hours and days off.</p>
    <form className="dateform" onSubmit={saveFrom}>
     <label>Start counting from<input type="date" value={from} onChange={e => { setFrom(e.target.value); setSaved('') }} /></label>
     <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
     {from && <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setFrom('')}>Clear</button>}
    </form>
    {saved && <p className="notice" role="status">{saved}</p>}
    {oops && <p className="alert" role="alert">{oops}</p>}
    <p className="muted small">Leave it blank to count from July 1, the start of the school year.</p>
   </section>}

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
   .dateform{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:12px}
   .dateform label{display:flex;flex-direction:column;gap:5px;font-weight:700;font-size:15px}
   .dateform input{padding:10px 12px;border-radius:10px;border:1px solid var(--vic-field-border);font-size:16px;font-family:var(--font-body)}
   .join{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;margin-top:24px}
   .code{font-family:var(--font-mono);letter-spacing:.08em;font-size:28px;font-weight:800;color:var(--vic-text-primary)!important}
  `}</style>
 </PageShell>
}
