import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import { useAccount } from '../lib/use-account'
import { saveMode } from '../lib/view-mode'
import { supabase } from '../lib/supabase'
import { defaultWeekOf, formatDay } from '../lib/lesson-week.mjs'

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}

// School dashboard: the leader's home. This week at a glance, then every school tool in one place.
export default function SchoolDashboard() {
 const { account, error: accountError } = useAccount({ next: '/school' })
 const [schools, setSchools] = useState(null), [schoolId, setSchoolId] = useState(''), [plans, setPlans] = useState(null), [walks, setWalks] = useState(null), [error, setError] = useState(''), [copied, setCopied] = useState(false)
 const weekOf = defaultWeekOf()

 useEffect(() => {
  if (!account) return
  if (!account.leader) { if (!account.manageAccounts) window.location.replace('/teach'); setSchools([]); return }
  api('/api/assistantprincipal/lessonplans').then(d => { setSchools(d.schools || []); setSchoolId(d.schools?.[0]?.id || '') }).catch(e => { setSchools([]); setError(e.message) })
 }, [account])

 useEffect(() => {
  if (!schoolId) return
  setPlans(null); setWalks(null)
  const q = `schoolId=${encodeURIComponent(schoolId)}`
  api(`/api/assistantprincipal/lessonplans?${q}&week=${weekOf}`).then(setPlans).catch(e => setError(e.message))
  api(`/api/assistantprincipal/walkthroughs?${q}`).then(setWalks).catch(() => setWalks({}))
 }, [schoolId])

 const teachers = plans?.teachers || []
 const sentIds = new Set((plans?.weeks || []).map(w => w.staffId).filter(Boolean))
 const sent = teachers.filter(t => sentIds.has(t.id)).length
 const toReview = (plans?.weeks || []).filter(w => w.status === 'submitted').length
 const missing = teachers.filter(t => !sentIds.has(t.id))
 const monthAgo = Date.now() - 30 * 864e5
 const recentWalks = (walks?.walkthroughs || []).filter(w => Date.parse(w.created_at) > monthAgo).length
 const pending = (walks?.suggestions || []).length
 const school = walks?.school
 const schoolName = plans?.school?.name || schools?.find(s => s.id === schoolId)?.name || 'Your school'

 function teach() { saveMode('teacher'); window.location.href = '/teach' }
 async function copyCode() { try { await navigator.clipboard.writeText(school.joinCode); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }

 return <PageShell title="School" currentPath="/school">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account || schools === null ? <p role="status">Opening your school…</p> : <>
   <header className="top">
    <div>
     <p className="label">School dashboard</p>
     <h1>{schoolName}</h1>
     {schools.length > 1 && <label className="pick">School <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    </div>
    <button type="button" className="btn btn-outline" onClick={teach}>Switch to my teaching →</button>
   </header>
   {error && <p className="alert" role="alert">{error}</p>}

   {account.leader && !schools.length ? <section className="dark-panel"><h2 className="dh">Set up your school</h2><p>Create your school, add staff and share a join code so teachers can send lesson plans.</p><div className="row"><a className="btn btn-cyan" href="/assistantprincipal">Set up my school</a></div></section>
    : account.leader && <>
     <section className="dark-panel glance" aria-label="This week">
      <div className="ghead"><p className="label cy">This week · {formatDay(weekOf, { month: 'short', day: 'numeric' })}</p></div>
      <div className="stats">
       <a className="stat" href={`/weeklyplans?school=${schoolId}&week=${weekOf}`}><strong>{plans ? `${sent}/${teachers.length}` : '…'}</strong><span>teachers sent lesson plans</span></a>
       <a className="stat" href={`/weeklyplans?school=${schoolId}&week=${weekOf}`}><strong className={toReview ? 'volt' : ''}>{plans ? toReview : '…'}</strong><span>waiting for your review</span></a>
       <a className="stat" href="/walkthroughs"><strong>{walks ? recentWalks : '…'}</strong><span>walkthroughs in the last 30 days</span></a>
       <a className="stat" href="/walkthroughs"><strong className={pending ? 'volt' : ''}>{walks ? pending : '…'}</strong><span>Learning Path suggestions to review</span></a>
      </div>
      {plans && missing.length > 0 && <p className="missing"><span>Not sent yet:</span> {missing.slice(0, 8).map(t => t.name).join(', ')}{missing.length > 8 ? ` and ${missing.length - 8} more` : ''}</p>}
     </section>
    </>}

   <section>
    <p className="label">School tools</p>
    <div className="grid">
     {account.leader && <a className="panel tile" href={`/weeklyplans${schoolId ? `?school=${schoolId}` : ''}`}><strong>Lesson plans</strong><span>Read the weeks teachers send, leave feedback, mark them reviewed.</span></a>}
     {account.leader && <a className="panel tile" href="/walkthroughs"><strong>Walkthroughs &amp; Learning Paths</strong><span>Record a visit from your phone or tablet, share feedback, assign short practice.</span></a>}
     {account.leader && <a className="panel tile" href="/assistantprincipal"><strong>Staff &amp; deadlines</strong><span>Your staff list, what’s due each week, and the weekly brief.</span></a>}
     {account.manageAccounts && <a className="panel tile" href="/admin/accounts"><strong>Accounts &amp; passwords</strong><span>Create teacher and student logins, reset passwords.</span></a>}
     {account.manageAccounts && <a className="panel tile" href="/admin/classrooms"><strong>Classrooms</strong><span>Create classes for teachers and manage rosters.</span></a>}
     {account.manageAccounts && <a className="panel tile" href="/admin/import-roster"><strong>Upload a roster</strong><span>Add a whole class of students from a spreadsheet.</span></a>}
     {account.manageAccounts && <a className="panel tile" href="/admin/staff-setup"><strong>Staff setup</strong><span>Add staff accounts in bulk.</span></a>}
    </div>
   </section>

   {school?.joinCode && <section className="panel join">
    <div><p className="label">Join code</p><h2 className="code">{school.joinCode}</h2><p>Teachers enter this at askvic.ai/join so their lesson plans come to you. {school.seatsUsed} of {school.seatLimit} seats used.</p></div>
    <button type="button" className="btn btn-volt" onClick={copyCode}>{copied ? '✓ Copied' : 'Copy code'}</button>
   </section>}
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0 0 6px;font-size:clamp(30px,3.4vw,42px);line-height:1.1}
   .pick{display:flex;gap:8px;align-items:center;font-weight:800}
   .pick select{padding:9px 12px;border-radius:10px;border:1px solid var(--vic-field-border);font-size:16px}
   .dh{color:#fff;margin:0 0 6px}
   .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
   .cy{color:var(--vic-cyan)}
   .stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:8px}
   .stat{display:flex;flex-direction:column;gap:4px;padding:16px;border-radius:14px;background:var(--vic-ink-2);border:1px solid var(--vic-ink-line);text-decoration:none;color:var(--vic-ink-text)}
   .stat:hover{border-color:var(--vic-cyan)}
   .stat strong{font-family:var(--font-head);font-size:34px;line-height:1}
   .stat strong.volt{color:var(--vic-volt)}
   .stat span{color:var(--vic-ink-muted);font-size:15px}
   .missing{margin:16px 0 0;font-size:15px}
   .missing span{color:var(--vic-volt);font-weight:800}
   .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
   .tile{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--vic-text-primary);padding:18px}
   .tile strong{font-size:17px}
   .tile span{color:var(--vic-text-secondary);font-size:15px;line-height:1.5}
   .tile:hover{border-color:var(--vic-primary)}
   .join{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
   .code{font-family:var(--font-mono);letter-spacing:.08em;font-size:28px}
   @media(max-width:860px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `}</style>
 </PageShell>
}
