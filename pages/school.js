import { useCallback, useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import StaffPanel from '../components/StaffPanel'
import { useAccount } from '../lib/use-account'
import { saveMode } from '../lib/view-mode'
import { supabase } from '../lib/supabase'
import { defaultWeekOf } from '../lib/lesson-week.mjs'
import { displayName, byLastName, tileState, fmtDay, plural } from '../lib/staff-ui.mjs'

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
const nextWeekday = today => { const d = new Date(`${today}T12:00:00Z`); do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay())); return d.toISOString().slice(0, 10) }
const weekStartIso = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString() }
const LEGEND = [['here', '✓', 'Here'], ['late', '⏰', 'Late'], ['missing', '!', 'No check-in'], ['told', '✉', 'Out (told you)'], ['waiting', '·', 'Not due yet / off']]

// The principal's home: who's here, who needs you, and how your staff is growing. Setup lives behind ⚙.
export default function SchoolDashboard() {
 const { account, error: accountError } = useAccount({ next: '/school' })
 const [schools, setSchools] = useState(null), [schoolId, setSchoolId] = useState(''), [att, setAtt] = useState(null), [walks, setWalks] = useState(null), [plans, setPlans] = useState(null), [error, setError] = useState('')
 const [open, setOpen] = useState(null), [privacy, setPrivacy] = useState(false), [updated, setUpdated] = useState(null)
 const weekOf = defaultWeekOf()

 useEffect(() => { try { setPrivacy(localStorage.getItem('askvic-privacy') === '1') } catch {} }, [])
 const togglePrivacy = () => { const v = !privacy; setPrivacy(v); try { localStorage.setItem('askvic-privacy', v ? '1' : '0') } catch {} }

 useEffect(() => {
  if (!account) return
  if (!account.leader) { if (!account.manageAccounts) window.location.replace('/teach'); setSchools([]); return }
  api('/api/assistantprincipal/lessonplans').then(d => { setSchools(d.schools || []); setSchoolId(d.schools?.[0]?.id || '') }).catch(e => { setSchools([]); setError(e.message) })
 }, [account])

 const loadAtt = useCallback(() => {
  if (!schoolId) return
  return api(`/api/school/attendance?schoolId=${encodeURIComponent(schoolId)}`).then(d => { setAtt(d); setUpdated(new Date()) }).catch(e => setError(e.message))
 }, [schoolId])
 const loadGrowth = useCallback(() => {
  if (!schoolId) return
  const q = `schoolId=${encodeURIComponent(schoolId)}`
  api(`/api/assistantprincipal/walkthroughs?${q}`).then(setWalks).catch(() => setWalks({}))
  api(`/api/assistantprincipal/lessonplans?${q}&week=${weekOf}`).then(setPlans).catch(() => setPlans({}))
 }, [schoolId])
 useEffect(() => { setAtt(null); setWalks(null); setPlans(null); loadAtt(); loadGrowth() }, [schoolId])
 // Tiles update on their own every minute while the page is open.
 useEffect(() => { if (!schoolId) return; const t = setInterval(() => { if (!document.hidden && !open) loadAtt() }, 60000); return () => clearInterval(t) }, [schoolId, open, loadAtt])
 // Open a person straight from a link (e.g. /school?staff=ID).
 useEffect(() => { const q = new URLSearchParams(window.location.search), s = q.get('staff'); if (s) setOpen({ id: s, tab: ['overview', 'attendance', 'growth', 'profile'].includes(q.get('tab')) ? q.get('tab') : 'overview' }) }, [])

 const people = (att?.people || []).slice().sort(byLastName)
 const schoolName = att?.school?.name || schools?.find(s => s.id === schoolId)?.name || 'Your school'
 const today = att?.today
 const count = k => people.filter(p => tileState(p).cls === k).length

 // "Needs you": only things that need action, most urgent first.
 const needs = []
 if (att) {
  for (const p of people.filter(p => p.today.kind === 'absent_no_form')) needs.push({ key: `m${p.id}`, icon: '!', text: <><b>{displayName(p.name)}</b>: no check-in today</>, open: p.id, tab: 'attendance' })
  const tomorrow = nextWeekday(today)
  for (const p of people) for (const x of p.planned || []) if (x.day === tomorrow) needs.push({ key: `t${p.id}`, icon: '✉', text: <><b>{displayName(p.name)}</b> is out {fmtDay(tomorrow, { weekday: 'long' })} ({x.label}){x.needsSub ? ' · needs a sub' : ''}</>, open: p.id, tab: 'attendance' })
  for (const p of people.filter(p => p.today.kind === 'absent_form' && p.today.needsSub)) needs.push({ key: `s${p.id}`, icon: '✉', text: <><b>{displayName(p.name)}</b> is out today and needs a sub</>, open: p.id })
  if (!privacy) for (const p of people.filter(p => p.leave?.paidLeft != null && p.leave.paidLeft <= 1)) needs.push({ key: `d${p.id}`, icon: '◔', text: p.leave.paidLeft <= 0 ? <><b>{displayName(p.name)}</b> is out of paid days. More absences are unpaid{p.leave.unpaid ? ` (${plural(p.leave.unpaid, 'unpaid day')} so far)` : ''}.</> : <><b>{displayName(p.name)}</b> has 1 paid day left</>, open: p.id })
  const outs = people.filter(p => p.missingOut?.length)
  if (outs.length) needs.push({ key: 'outs', icon: '⏱', text: <>{plural(outs.length, 'hourly person')} missing a clock-out (payroll)</>, href: '/school/payroll' })
  if (att.unmatched?.length) needs.push({ key: 'unm', icon: '?', text: <>{plural(att.unmatched.length, 'name')} on your check-in sheet don’t match anyone</>, href: '/school/attendance#unmatched' })
 }
 const toReview = (plans?.weeks || []).filter(w => w.status === 'submitted').length
 if (toReview) needs.push({ key: 'plans', icon: '✎', text: <>{plural(toReview, 'lesson plan')} waiting for your review</>, href: `/weeklyplans?school=${schoolId}&week=${weekOf}` })
 const pending = (walks?.suggestions || []).length
 if (pending) needs.push({ key: 'paths', icon: '★', text: <>{plural(pending, 'Learning Path suggestion')} to approve</>, href: '/walkthroughs?tab=suggestions' })

 // Growth this week.
 const ws = weekStartIso()
 const walksThisWeek = (walks?.walkthroughs || []).filter(w => w.created_at >= ws).length
 const pathsActive = (walks?.assignments || []).filter(a => a.status !== 'completed').length
 const pathsDone = (walks?.assignments || []).filter(a => a.status === 'completed' && a.completedAt && Date.now() - Date.parse(a.completedAt) < 30 * 864e5).length
 const stats = walks?.walkStats || {}
 const notVisited = people.filter(p => p.role === 'teacher' && (!stats[p.id]?.last || Date.now() - Date.parse(stats[p.id].last) > 30 * 864e5))
 const sentIds = new Set((plans?.weeks || []).map(w => w.staffId).filter(Boolean)), teachers = plans?.teachers || []

 function teach() { saveMode('teacher'); window.location.href = '/teach' }

 return <PageShell title="School" currentPath="/school">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account || schools === null ? <p role="status">Opening your school…</p> : <>
   <header className="top">
    <div>
     <p className="label">{greeting()} · {fmtDay(today || new Date().toISOString(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
     <h1>{schoolName}</h1>
     {schools.length > 1 && <label className="pick">School <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    </div>
    <div className="topbtns">
     <button type="button" className={`btn btn-outline ${privacy ? 'on' : ''}`} onClick={togglePrivacy} aria-pressed={privacy}>{privacy ? '🔒 Privacy on' : '🔓 Privacy off'}</button>
     <a className="btn btn-outline" href="/school/setup">⚙ Setup</a>
    </div>
   </header>
   {error && <p className="alert" role="alert">{error}</p>}

   {account.leader && !schools.length ? <section className="dark-panel"><h2 className="dh">Set up your school</h2><p>Create your school, add staff and share a join code so teachers can send lesson plans.</p><div className="row"><a className="btn btn-cyan" href="/assistantprincipal">Set up my school</a></div></section>
    : account.leader && <>
     <section className="panel needs" aria-label="Needs you">
      <div className="shead"><h2>Needs you {att && <span className="count">{needs.length}</span>}</h2></div>
      {!att ? <p className="muted">Checking today…</p> : !needs.length ? <p className="calm">✓ Nothing needs you right now.</p> :
       <ul>{needs.slice(0, 6).map(n => <li key={n.key}><span className="ni" aria-hidden="true">{n.icon}</span>{n.href ? <a href={n.href}>{n.text}</a> : <button className="linkish" onClick={() => setOpen({ id: n.open, tab: n.tab || 'overview' })}>{n.text}</button>}</li>)}</ul>}
      {needs.length > 6 && <p className="muted small">and {needs.length - 6} more</p>}
     </section>

     <section aria-label="Staff today">
      <div className="shead">
       <h2>Staff today</h2>
       {att && <p className="tally"><b>{count('here')}</b> here · <b>{count('late')}</b> late · <b>{count('missing')}</b> no check-in · <b>{count('told')}</b> out · <b>{count('waiting')}</b> not due yet</p>}
      </div>
      <ul className="legend" aria-label="What the tiles mean">{LEGEND.map(([c, i, l]) => <li key={c}><span className={`chip ${c}`} aria-hidden="true">{i}</span>{l}</li>)}</ul>
      {!att ? <p className="muted">Loading your staff…</p> : !people.length ? <p className="muted">No staff yet. <button className="linkish" onClick={() => setOpen({ id: 'new' })}>Add your first staff member</button></p> :
       <ul className="grid">{people.map(p => { const s = tileState(p); return <li key={p.id}>
        <button className={`tile ${s.cls}`} onClick={() => setOpen({ id: p.id, tab: 'overview' })} aria-label={`${displayName(p.name)}: ${s.word}, ${s.text}. Open details.`}>
         <span className="ic" aria-hidden="true">{s.icon}</span>
         <span className="nm">{displayName(p.name)}</span>
         <span className="st">{s.text}</span>
         {!privacy && p.leave?.paidLeft != null && <span className="dl">{p.leave.paidLeft} days left</span>}
        </button></li> })}
        <li><button className="tile add" onClick={() => setOpen({ id: 'new' })}><span className="ic" aria-hidden="true">+</span><span className="nm">Add staff</span></button></li>
       </ul>}
      {updated && <p className="muted small">Updates every minute · last {updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} <button className="linkish" onClick={loadAtt}>Refresh now</button></p>}
     </section>

     <section className="panel growth" aria-label="Staff growth">
      <div className="shead"><h2>Staff growth</h2><a className="btn btn-primary" href="/walkthroughs">+ Start a walkthrough</a></div>
      <div className="gstats">
       <a href="/walkthroughs?tab=history"><strong>{walks ? walksThisWeek : '…'}</strong><span>walkthroughs this week</span></a>
       <a href="/walkthroughs?tab=assigned"><strong>{walks ? pathsActive : '…'}</strong><span>Learning Paths in progress</span></a>
       <a href="/walkthroughs?tab=assigned"><strong>{walks ? pathsDone : '…'}</strong><span>finished in the last 30 days</span></a>
       <a href={`/weeklyplans?school=${schoolId}&week=${weekOf}`}><strong>{plans ? `${teachers.filter(t => sentIds.has(t.id)).length}/${teachers.length}` : '…'}</strong><span>sent this week’s lesson plans</span></a>
      </div>
      {walks && notVisited.length > 0 && <p className="nv"><b>No walkthrough in 30+ days:</b> {notVisited.slice(0, 6).map((p, i) => <span key={p.id}>{i ? ', ' : ''}<button className="linkish" onClick={() => setOpen({ id: p.id, tab: 'growth' })}>{displayName(p.name)}</button></span>)}{notVisited.length > 6 ? ` and ${notVisited.length - 6} more` : ''}</p>}
     </section>

     <nav className="quick" aria-label="More">
      <a href="/school/payroll">Payroll</a>
      <a href={`/weeklyplans?school=${schoolId}`}>Lesson plans</a>
      <a href="/school/attendance">Attendance details</a>
      <button className="linkish" onClick={teach}>Switch to my teaching →</button>
     </nav>
    </>}
   {open && schoolId && <StaffPanel schoolId={schoolId} staffId={open.id} startTab={open.tab} privacy={privacy} canManageAccounts={!!account.manageAccounts} joinCode={walks?.school?.joinCode || ''} onClose={() => setOpen(null)} onChanged={() => { loadAtt(); loadGrowth() }} onOpen={(id, tab) => setOpen({ id, tab })} />}
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0;font-size:clamp(28px,3.2vw,40px);line-height:1.1}
   h2{margin:0;font-size:21px}
   .topbtns{display:flex;gap:8px;flex-wrap:wrap}
   .on{background:var(--vic-ink)!important;color:#fff!important}
   .pick{display:flex;gap:8px;align-items:center;font-weight:800;margin-top:6px}
   .pick select{padding:9px 12px;border-radius:10px;border:1px solid var(--vic-field-border);font-size:16px}
   .dh{color:#fff;margin:0 0 6px}
   .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
   section{margin-top:18px}
   .shead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
   .count{display:inline-flex;min-width:28px;height:28px;align-items:center;justify-content:center;border-radius:99px;background:var(--vic-ink);color:#fff;font-size:15px;margin-left:6px;padding:0 8px}
   .needs ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
   .needs li{display:flex;gap:10px;align-items:flex-start;font-size:16px;line-height:1.45}
   .needs a{color:var(--vic-text-primary)}
   .ni{flex:none;width:28px;height:28px;border-radius:8px;background:var(--vic-ink);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900}
   .calm{margin:0;font-weight:800;color:var(--vic-text-secondary)}
   .linkish{background:none;border:0;padding:0;font:inherit;color:inherit;text-align:left;cursor:pointer;text-decoration:underline;text-decoration-color:var(--vic-border);text-underline-offset:3px}
   .linkish:hover{text-decoration-color:var(--vic-primary)}
   .tally{margin:0;color:var(--vic-text-secondary)}
   .tally b{color:var(--vic-text-primary)}
   .legend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 16px;margin:0 0 12px;padding:0;font-size:14px;color:var(--vic-text-secondary)}
   .legend li{display:flex;align-items:center;gap:6px}
   .chip{width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}
   .grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
   .tile{width:100%;min-height:104px;border-radius:14px;padding:12px;text-align:left;display:flex;flex-direction:column;gap:3px;cursor:pointer;font:inherit;border:2px solid transparent;position:relative;transition:transform .08s}
   .tile:hover{transform:translateY(-2px);box-shadow:var(--vic-shadow-card)}
   .tile:focus-visible{outline:3px solid var(--vic-primary);outline-offset:2px}
   .tile .ic{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-weight:900;font-size:15px}
   .tile .nm{font-weight:800;font-size:17px;line-height:1.2;padding-right:28px}
   .tile .st{font-size:14px;font-weight:700}
   .tile .dl{margin-top:auto;font-size:12px;font-weight:700;opacity:.8}
   .here{background:#1E3A8A;color:#fff}.here .ic{background:#fff;color:#1E3A8A}
   .late{background:#F59E0B;color:#2B1700}.late .ic{background:#2B1700;color:#F59E0B}
   .missing{background:#fff;color:#0E1730;border:3px dashed #0E1730}.missing .ic{background:#0E1730;color:#fff}
   .told{background:repeating-linear-gradient(135deg,#DCE7FF 0 8px,#EEF3FF 8px 16px);color:#0E1730;border-color:#9DB4E8}.told .ic{background:#fff;color:#1E3A8A}
   .waiting{background:#EEF1F6;color:#4E5B78}.waiting .ic{background:#fff}
   .off{background:#F6F7FA;color:#8A97B5}
   .chip.here{background:#1E3A8A;color:#fff}.chip.late{background:#F59E0B;color:#2B1700}.chip.missing{background:#fff;border:2px dashed #0E1730}.chip.told{background:repeating-linear-gradient(135deg,#DCE7FF 0 4px,#EEF3FF 4px 8px);border:1px solid #9DB4E8}.chip.waiting{background:#EEF1F6;color:#4E5B78}
   .add{background:var(--vic-surface);border:2px dashed var(--vic-border);color:var(--vic-text-secondary);align-items:center;justify-content:center}
   .add .ic{position:static;font-size:24px;background:none}
   .gstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
   .gstats a{display:flex;flex-direction:column;gap:4px;padding:14px;border-radius:14px;border:1px solid var(--vic-border-soft);text-decoration:none;color:var(--vic-text-primary)}
   .gstats a:hover{border-color:var(--vic-primary)}
   .gstats strong{font-family:var(--font-head);font-size:30px;line-height:1}
   .gstats span{font-size:14px;color:var(--vic-text-secondary)}
   .nv{margin:12px 0 0}
   .quick{display:flex;gap:18px;flex-wrap:wrap;margin:22px 0 8px;font-weight:800}
   .quick a{color:var(--vic-text-secondary)}
   .small{font-size:14px}
   @media(max-width:760px){.gstats{grid-template-columns:repeat(2,minmax(0,1fr))}.grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}}
  `}</style>
 </PageShell>
}
