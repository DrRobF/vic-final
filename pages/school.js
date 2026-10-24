import { useCallback, useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import StaffPanel from '../components/StaffPanel'
import { useAccount } from '../lib/use-account'
import { saveMode } from '../lib/view-mode'
import { supabase } from '../lib/supabase'
import { defaultWeekOf } from '../lib/lesson-week.mjs'
import { displayName, byLastName, tileState, fmtDay, plural, MARK_OPTIONS } from '../lib/staff-ui.mjs'

const MARK_LABEL = Object.fromEntries(MARK_OPTIONS)

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}
async function post(body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch('/api/school/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'That didn’t go through.')
 return d
}
const greeting = h => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
const nextWeekday = today => { const d = new Date(`${today}T12:00:00Z`); do d.setUTCDate(d.getUTCDate() + 1); while ([0, 6].includes(d.getUTCDay())); return d.toISOString().slice(0, 10) }
const weekStartIso = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString() }

// The principal's home. Two things earn permanent space: what needs a decision from him
// today, and who is in the building. Everything else is a door with its state on the front,
// so the page never grows as AskVic does.
export default function SchoolDashboard() {
 const { account, error: accountError } = useAccount({ next: '/school' })
 const [schools, setSchools] = useState(null), [schoolId, setSchoolId] = useState(''), [att, setAtt] = useState(null), [walks, setWalks] = useState(null), [plans, setPlans] = useState(null), [cover, setCover] = useState(null), [error, setError] = useState('')
 const [open, setOpen] = useState(null), [privacy, setPrivacy] = useState(false), [deciding, setDeciding] = useState(0), [order, setOrder] = useState(null), [saving, setSaving] = useState(false), [dismissed, setDismissed] = useState({}), [showHidden, setShowHidden] = useState(false)
 const [now, setNow] = useState(null)
 const weekOf = defaultWeekOf()

 // The clock is the one thing on this page that is useful before you have read anything.
 // Rendered only after mount, so the server and the browser never disagree about the time.
 useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])

 useEffect(() => { try { setPrivacy(localStorage.getItem('askvic-privacy') === '1') } catch {} }, [])
 const togglePrivacy = () => { const v = !privacy; setPrivacy(v); try { localStorage.setItem('askvic-privacy', v ? '1' : '0') } catch {} }

 useEffect(() => {
  if (!account) return
  if (!account.leader) { if (!account.manageAccounts) window.location.replace('/teach'); setSchools([]); return }
  api('/api/assistantprincipal/lessonplans').then(d => { setSchools(d.schools || []); setSchoolId(d.schools?.[0]?.id || '') }).catch(e => { setSchools([]); setError(e.message) })
 }, [account])

 const loadAtt = useCallback(() => {
  if (!schoolId) return
  return api(`/api/school/attendance?schoolId=${encodeURIComponent(schoolId)}`).then(setAtt).catch(e => setError(e.message))
 }, [schoolId])
 const loadRest = useCallback(() => {
  if (!schoolId) return
  const q = `schoolId=${encodeURIComponent(schoolId)}`
  api(`/api/assistantprincipal/walkthroughs?${q}`).then(setWalks).catch(() => setWalks({}))
  api(`/api/assistantprincipal/lessonplans?${q}&week=${weekOf}`).then(setPlans).catch(() => setPlans({}))
  api(`/api/school/cover?${q}`).then(setCover).catch(() => setCover({}))
 }, [schoolId])
 useEffect(() => { setAtt(null); setWalks(null); setPlans(null); setCover(null); loadAtt(); loadRest() }, [schoolId])

 const today = att?.today
 const dkey = `askvic-dismissed-${schoolId}`
 useEffect(() => { try { setDismissed(JSON.parse(localStorage.getItem(dkey) || '{}')) } catch { setDismissed({}) } }, [dkey])
 function dismiss(n) { const next = { ...dismissed, [n.key]: String(n.sig ?? today) }; setDismissed(next); try { localStorage.setItem(dkey, JSON.stringify(next)) } catch {} }
 function undismissAll() { setDismissed({}); setShowHidden(false); try { localStorage.removeItem(dkey) } catch {} }
 useEffect(() => { if (!schoolId) return; const t = setInterval(() => { if (!document.hidden && !open) loadAtt() }, 60000); return () => clearInterval(t) }, [schoolId, open, loadAtt])
 useEffect(() => { const q = new URLSearchParams(window.location.search), s = q.get('staff'); if (s) setOpen({ id: s, tab: ['overview', 'attendance', 'growth', 'profile'].includes(q.get('tab')) ? q.get('tab') : 'overview' }) }, [])

 const byBoard = (a, b) => (a.boardOrder ?? 9e8) - (b.boardOrder ?? 9e8) || byLastName(a, b)
 const people = order ?? (att?.people || []).slice().sort(byBoard)
 const schoolName = att?.school?.name || schools?.find(s => s.id === schoolId)?.name || 'Your school'
 const count = k => people.filter(p => tileState(p).cls === k).length

 // "Needs you" holds only what Rob can settle from here, and every item carries the button
 // that settles it. Reading an item never fixes it, so an item with no way out just repeats
 // itself at him every morning -- those belong on a door instead, where the number sits
 // quietly until he chooses to go and deal with it.
 // How many classes each staff member teaches, so "out today" can say what that costs.
 // The cover endpoint already works this out; the attendance one has no idea about classes.
 const classesByStaff = new Map()
 for (const c of cover?.classes || []) if (c.staffId) classesByStaff.set(c.staffId, (classesByStaff.get(c.staffId) || 0) + 1)

 const needs = []
 if (att) {
  for (const p of people.filter(p => p.today.kind === 'absent_no_form')) {
   needs.push({ key: `m${p.id}`, icon: '!', text: <><b>{displayName(p.name)}</b> has not checked in today.</>, do: { label: 'Say why', open: p.id, tab: 'attendance' } })
  }
  for (const p of people.filter(p => p.today.kind === 'absent_form' && p.today.needsSub)) {
   needs.push({ key: `s${p.id}`, icon: '✉', text: <><b>{displayName(p.name)}</b> is out today{classesByStaff.get(p.id) ? ` · ${classesByStaff.get(p.id)} ${classesByStaff.get(p.id) === 1 ? 'class' : 'classes'} to cover` : ''}.</>, do: { label: 'Make a cover slip →', href: `/school/cover?staffId=${encodeURIComponent(p.id)}` } })
  }
  const tomorrow = nextWeekday(today)
  for (const p of people) for (const x of p.planned || []) if (x.day === tomorrow && x.needsSub) {
   needs.push({ key: `t${p.id}`, icon: '✉', text: <><b>{displayName(p.name)}</b> is out {fmtDay(tomorrow, { weekday: 'long' })} ({x.label}).</>, do: { label: 'Make a cover slip →', href: `/school/cover?staffId=${encodeURIComponent(p.id)}&day=${tomorrow}` } })
  }
  if (!privacy) for (const p of people.filter(p => p.leave?.paidLeft != null && p.leave.paidLeft <= 0)) {
   needs.push({ key: `d${p.id}`, icon: '◔', text: <><b>{displayName(p.name)}</b> is out of paid days. More absences are unpaid.</>, do: { label: 'Open', open: p.id } })
  }
 }
 const isHidden = n => dismissed[n.key] === String(n.sig ?? today)
 const shown = showHidden ? needs : needs.filter(n => !isHidden(n)), hiddenCount = needs.filter(isHidden).length
 const requests = att?.requests || []

 // Doors: everything that is not today's decision, each wearing its own state so going
 // through one is a choice rather than a search.
 const toReview = (plans?.weeks || []).filter(w => w.status === 'submitted').length
 const sentIds = new Set((plans?.weeks || []).map(w => w.staffId).filter(Boolean)), teachers = plans?.teachers || []
 const ws = weekStartIso()
 const walkCount = (walks?.walkthroughs || []).length
 const walksThisWeek = (walks?.walkthroughs || []).filter(w => w.created_at >= ws).length
 const outs = people.filter(p => p.missingOut?.length).length
 const slipsToday = (cover?.grants || []).filter(g => g.day === today && !g.revoked).length
 const uncovered = people.filter(p => p.today?.needsSub && p.today.kind?.startsWith('absent')).length

 const doors = [
  { href: '/school/cover', title: 'Sub coverage', note: uncovered ? `${plural(uncovered, 'teacher')} out today · ${slipsToday ? `${plural(slipsToday, 'slip')} made` : 'no slips yet'}` : slipsToday ? `${plural(slipsToday, 'slip')} out today` : 'Nobody out · make a slip any time', lead: uncovered > slipsToday },
  { href: `/weeklyplans?school=${schoolId}&week=${weekOf}`, title: 'Lesson plans', note: plans ? `${toReview ? `${plural(toReview, 'plan')} to review · ` : ''}${teachers.filter(t => sentIds.has(t.id)).length} of ${teachers.length} sent this week` : '…' },
  { href: '/walkthroughs', title: 'Walkthroughs', note: walks ? (walkCount ? `${plural(walksThisWeek, 'visit')} this week · ${walkCount} this year` : 'Not started yet · start your first') : '…' },
  { href: '/school/payroll', title: 'Payroll', note: outs ? `${outs === 1 ? '1 person' : `${outs} people`} missing a clock-out` : 'Hours and pay periods' },
  { href: '/school/attendance', title: 'Attendance detail', note: att?.unmatched?.length ? `${plural(att.unmatched.length, 'name')} don’t match anyone` : 'Fix a day, check-in sheet, planned absences' },
 ]

 function move(i, step) {
  setOrder(list => { const next = [...(list || [])]; const j = i + step; if (j < 0 || j >= next.length) return next;[next[i], next[j]] = [next[j], next[i]]; return next })
 }
 async function saveOrder() {
  setSaving(true); setError('')
  try { await post({ schoolId, action: 'board_order', order: order.map(p => p.id) }); setOrder(null); await loadAtt() }
  catch (e) { setError(e.message) } finally { setSaving(false) }
 }
 async function decide(id, decision) {
  setDeciding(id); setError('')
  try { await post({ schoolId, action: 'decide_request', requestId: id, decision }); await loadAtt() }
  catch (e) { setError(e.message) } finally { setDeciding(0) }
 }
 function teach() { saveMode('teacher'); window.location.href = '/teach' }

 const hours = now ? now.getHours() : 0
 const clock = now ? `${((hours % 12) || 12)}:${String(now.getMinutes()).padStart(2, '0')}` : ''

 return <PageShell title="School dashboard" currentPath="/school">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account || schools === null ? <p role="status">Opening your school…</p> : <>
   <header className="top">
    <div>
     <h1>{now ? `${greeting(hours)}, ${(account.name || '').split(' ')[0] || 'there'}` : ' '}</h1>
     <p className="sub">{schoolName}{att ? ` · ${plural(people.length, 'staff member')}` : ''}</p>
     {schools.length > 1 && <label className="pick">School <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
     <div className="topbtns">
      <button type="button" className={`btn btn-outline ${privacy ? 'on' : ''}`} onClick={togglePrivacy} aria-pressed={privacy}>{privacy ? '🔒 Privacy on' : '🔓 Privacy off'}</button>
      <a className="btn btn-outline" href="/school/setup">⚙ Setup</a>
     </div>
    </div>
    <div className="clock" aria-hidden={!now}>
     <p className="time"><span>{clock}</span><em>{now ? (hours < 12 ? 'AM' : 'PM') : ''}</em></p>
     <p className="date">{now ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ' '}</p>
    </div>
   </header>
   {error && <p className="alert" role="alert">{error}</p>}

   {account.leader && !schools.length ? <section className="dark-panel"><h2 className="dh">Set up your school</h2><p>Create your school, add staff and share a join code so teachers can send lesson plans.</p><div className="row"><a className="btn btn-cyan" href="/assistantprincipal">Set up my school</a></div></section>
    : account.leader && <>

     <section className="panel needs" aria-label="Needs you">
      {!att ? <p className="muted">Checking today…</p>
       : !shown.length && !requests.length ? <p className="calm"><span className="tick" aria-hidden="true">✓</span> Nothing needs you right now.</p>
       : <>
        <div className="shead"><h2>Needs you <span className="count">{shown.length + requests.length}</span></h2></div>
        <ul>
         {shown.map(n => <li key={n.key} className={isHidden(n) ? 'dim' : ''}>
          <span className="ni" aria-hidden="true">{n.icon}</span>
          <span className="what">{n.text}</span>
          <span className="acts">
           {n.do.href ? <a className="btn btn-primary sm" href={n.do.href}>{n.do.label}</a>
            : <button type="button" className="btn btn-primary sm" onClick={() => setOpen({ id: n.do.open, tab: n.do.tab || 'overview' })}>{n.do.label}</button>}
           {!isHidden(n) && <button type="button" className="btn btn-outline sm" onClick={() => dismiss(n)}>Handled it</button>}
          </span>
         </li>)}
         {requests.map(r => <li key={`q${r.id}`} id="day-off-requests">
          <span className="ni" aria-hidden="true">✉</span>
          <span className="what"><b>{displayName(r.name)}</b> asked for {fmtDay(r.day)}{r.endDay && r.endDay !== r.day ? ` – ${fmtDay(r.endDay)}` : ''} off ({MARK_LABEL[r.kind] || r.kind}){r.needsSub ? ' · needs a sub' : ''}{r.note ? <em> — {r.note}</em> : ''}</span>
          <span className="acts">
           <button type="button" className="btn btn-primary sm" disabled={deciding === r.id} onClick={() => decide(r.id, 'approved')}>{deciding === r.id ? '…' : 'Approve'}</button>
           <button type="button" className="btn btn-outline sm" disabled={deciding === r.id} onClick={() => decide(r.id, 'declined')}>Decline</button>
          </span>
         </li>)}
        </ul>
        <p className="muted small">Everything here has a button that clears it. {hiddenCount > 0 && <>{hiddenCount} hidden today · <button className="linkish" onClick={() => showHidden ? undismissAll() : setShowHidden(true)}>{showHidden ? 'bring them back' : 'show'}</button></>}</p>
       </>}
     </section>

     <section aria-label="Staff today">
      <div className="shead">
       <h2>Staff today</h2>
       {att && !order && <p className="tally"><b>{count('here')}</b> here · <b>{count('late')}</b> late · <b>{count('missing')}</b> no check-in · <b>{count('told')}</b> out · <b>{count('waiting')}</b> not due yet</p>}
       {order && <span className="askbtns">
        <button type="button" className="btn btn-primary sm" disabled={saving} onClick={saveOrder}>{saving ? 'Saving…' : 'Save this order'}</button>
        <button type="button" className="btn btn-outline sm" disabled={saving} onClick={() => setOrder(people.slice().sort((a, b) => (a.role === 'teacher' ? 0 : 1) - (b.role === 'teacher' ? 0 : 1) || byLastName(a, b)))}>Teachers first</button>
        <button type="button" className="btn btn-outline sm" disabled={saving} onClick={() => setOrder(null)}>Cancel</button>
       </span>}
      </div>
      {!att ? <p className="muted">Loading your staff…</p> : !people.length ? <p className="muted">No staff yet. <a href="/school/setup">Add your first staff member</a></p> :
       <ul className="grid">{people.map((p, i) => { const s = tileState(p); return <li key={p.id}>
        {order ? <div className={`tile ${s.cls} reorder`}>
         <span className="nm">{displayName(p.name)}</span>
         <span className="arrows">
          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${displayName(p.name)} earlier`}>↑</button>
          <button type="button" onClick={() => move(i, 1)} disabled={i === people.length - 1} aria-label={`Move ${displayName(p.name)} later`}>↓</button>
         </span>
        </div> :
        <button className={`tile ${s.cls}`} onClick={() => setOpen({ id: p.id, tab: 'overview' })} aria-label={`${displayName(p.name)}: ${s.word}, ${s.text}. Open details.`}>
         <span className="ic" aria-hidden="true">{s.icon}</span>
         <span className="nm">{displayName(p.name)}</span>
         <span className="st">{s.text}</span>
         {!privacy && p.leave?.paidLeft != null && <span className="dl">{p.leave.paidLeft} days left</span>}
        </button>}</li> })}
       </ul>}
      {/* Reordering and adding people are a few-times-a-year job, so they sit under the
          board rather than in the header above it, where they were charged daily rent. */}
      {att && !order && <p className="muted small under">Tiles sit in your order. <button className="linkish" onClick={() => setOrder(people.slice())}>Change the order</button> · <a href="/school/setup">Add someone</a></p>}
      {order && <p className="muted small under">Move people with the arrows, then save. New staff go in by last name until you move them.</p>}
     </section>

     <section aria-label="Everywhere else">
      <div className="shead"><h2>Everywhere else</h2></div>
      <div className="doors">
       {doors.map(d => <a key={d.href} href={d.href} className={d.lead ? 'door lead' : 'door'}>
        <strong>{d.title} →</strong>
        <span>{d.note}</span>
       </a>)}
       <button type="button" className="door teach" onClick={teach}>
        <strong>My teaching →</strong>
        <span>Your own classes, week and lessons</span>
       </button>
      </div>
     </section>
    </>}
   {open && schoolId && <StaffPanel schoolId={schoolId} staffId={open.id} startTab={open.tab} startNotice={open.message || ''} privacy={privacy} canManageAccounts={!!account.manageAccounts} joinCode={walks?.school?.joinCode || ''} onClose={() => setOpen(null)} onChanged={() => { loadAtt(); loadRest() }} onOpen={(id, tab, message) => setOpen({ id, tab, message })} />}
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0;font-size:clamp(26px,3vw,34px);line-height:1.1}
   h2{margin:0;font-size:21px}
   .sub{margin:6px 0 0;color:var(--vic-text-secondary);font-size:17px}
   .topbtns{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
   .on{background:var(--vic-ink)!important;color:#fff!important}
   .pick{display:flex;gap:8px;align-items:center;font-weight:800;margin-top:10px}
   .pick select{padding:9px 12px;border-radius:10px;border:1px solid var(--vic-field-border);font-size:16px}
   .clock{text-align:right;flex-shrink:0;min-width:210px}
   .time{margin:0;display:flex;align-items:baseline;justify-content:flex-end;gap:8px}
   .time span{font-size:clamp(46px,7vw,72px);line-height:.95;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
   .time em{font-style:normal;font-size:clamp(18px,2.4vw,26px);font-weight:800;color:var(--vic-text-secondary)}
   .date{margin:6px 0 0;color:var(--vic-text-secondary);font-size:18px;font-weight:700}
   .dh{color:#fff;margin:0 0 6px}
   .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}
   section{margin-top:18px}
   .shead{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}
   .count{display:inline-flex;min-width:28px;height:28px;align-items:center;justify-content:center;border-radius:99px;background:var(--vic-ink);color:#fff;font-size:15px;margin-left:6px;padding:0 8px}
   .needs ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
   .needs li{display:flex;gap:13px;align-items:center;flex-wrap:wrap;font-size:17px;line-height:1.45;background:var(--vic-surface-muted);border-radius:13px;padding:14px 16px}
   .needs li.dim{opacity:.5}
   .what{flex:999 1 320px;min-width:0}
   .what em{font-style:normal;color:var(--vic-text-secondary)}
   .acts{display:flex;gap:9px;flex-wrap:wrap;align-items:center}
   .needs :global(.sm){min-height:42px;padding:9px 15px;font-size:15px}
   .calm{margin:0;font-weight:800;font-size:18px;display:flex;align-items:center;gap:11px}
   .tick{width:32px;height:32px;border-radius:9px;background:var(--vic-primary-soft,#E7F1FB);color:var(--vic-primary);display:inline-flex;align-items:center;justify-content:center;font-weight:900}
   .ni{flex:none;width:32px;height:32px;border-radius:9px;background:var(--vic-ink);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900}
   .linkish{background:none;border:0;padding:0;font:inherit;color:var(--vic-primary);text-align:left;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
   .askbtns{display:flex;gap:8px}
   .reorder{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:default}
   .arrows{display:flex;gap:4px;flex:none}
   .arrows button{width:34px;height:34px;border-radius:8px;border:1px solid var(--vic-border);background:var(--vic-surface);font-size:15px;font-weight:900;cursor:pointer;color:var(--vic-text-primary)}
   .arrows button:disabled{opacity:.35;cursor:not-allowed}
   .tally{margin:0;color:var(--vic-text-secondary)}
   .tally b{color:var(--vic-text-primary)}
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
   .under{margin:11px 2px 0}
   .doors{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
   .door{display:flex;flex-direction:column;gap:4px;padding:17px 19px;min-height:86px;border-radius:14px;border:1px solid var(--vic-border-soft);background:var(--vic-surface);text-decoration:none;color:var(--vic-text-primary);text-align:left;font:inherit;cursor:pointer}
   .door:hover{border-color:var(--vic-primary)}
   .door strong{font-size:17px}
   .door span{font-size:15px;color:var(--vic-text-secondary)}
   .door.lead{border:2px solid var(--vic-primary);padding:16px 18px}
   .door.lead strong{color:var(--vic-primary)}
   .small{font-size:14px}
   @media(max-width:900px){.doors{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:760px){.grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}.clock{text-align:left;min-width:0}.time{justify-content:flex-start}.doors{grid-template-columns:1fr}}
  `}</style>
 </PageShell>
}
