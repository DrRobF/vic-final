import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayName, firstName, fmtDay, fmt12, plural, tileState, MARK_OPTIONS, ROLES, daysAgo } from '../lib/staff-ui.mjs'

async function call(path, body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}
const school = (schoolId, body) => call('/api/school/attendance', { schoolId, ...body })
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri']]
const TABS = [['overview', 'Overview'], ['attendance', 'Attendance'], ['growth', 'Growth'], ['profile', 'Profile & setup']]

// The slide-out panel for one staff member: everything about them in one place.
export default function StaffPanel({ schoolId, staffId, startTab = 'overview', privacy, canManageAccounts, joinCode, onClose, onChanged, onOpen }) {
 const isNew = staffId === 'new'
 const [data, setData] = useState(null), [tab, setTab] = useState(startTab), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reveal, setReveal] = useState(false)
 const [draft, setDraft] = useState(null), [plan, setPlan] = useState(null), [edit, setEdit] = useState(null), [work, setWork] = useState(null), [code, setCode] = useState(''), [fresh, setFresh] = useState({ name: '', email: '', role: 'teacher', payType: 'salaried', sickDays: '10' })
 const hide = privacy && !reveal

 async function load() {
  if (isNew) return
  try { setData(await school(schoolId, { action: 'person', staffId })) } catch (e) { setError(e.message) }
 }
 useEffect(() => { setData(null); setTab(startTab); setDraft(null); setPlan(null); setEdit(null); setWork(null); setNotice(''); setError(''); setReveal(false); load() }, [staffId])
 useEffect(() => { const k = e => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])

 async function run(label, fn, done) {
  setBusy(label); setError(''); setNotice('')
  try { await fn(); if (done) setNotice(done); await load(); onChanged?.() } catch (e) { setError(e.message) } finally { setBusy('') }
 }

 const p = data?.person, prof = data?.profile
 const name = displayName(prof?.name || p?.name || '')
 const st = p ? tileState(p) : null
 const pool = p?.sickDays, left = p?.leave?.paidLeft

 function startEdit() { setEdit({ ...prof }) }
 function startWork() { setWork({ payType: p.payType, flexible: !!p.flexible, shiftStart: p.shiftStart, shiftEnd: p.shiftEnd, workDays: p.workDays || [], maxHours: p.maxHours ?? '', sickDays: pool ?? '' }) }

 const addNew = e => { e.preventDefault(); run('Adding…', async () => { const r = await school(schoolId, { action: 'add_staff', ...fresh }); onChanged?.(); onOpen?.(r.id, 'profile') }) }
 const saveProfile = e => { e.preventDefault(); run('Saving…', async () => { await school(schoolId, { action: 'save_profile', staffId, ...edit }); setEdit(null) }, 'Saved.') }
 const saveWork = e => { e.preventDefault(); run('Saving…', async () => { await school(schoolId, { action: 'update_staff', staffId, ...work, workDays: work.workDays }); setWork(null) }, 'Saved.') }
 const saveCode = e => { e.preventDefault(); run('Saving code…', async () => { await school(schoolId, { action: 'set_code', staffId, code }); setCode('') }, code ? `Check-in code saved. Tell ${firstName(name)} their code is ${code}.` : 'Code removed.') }
 const mark = (day, kind) => run('Saving…', () => school(schoolId, { action: 'mark_day', staffId, day, kind }), 'Day updated.')
 const savePlan = e => { e.preventDefault(); run('Saving…', async () => { await school(schoolId, { action: 'plan_absence', staffId, ...plan }); setPlan(null) }, 'Planned absence saved. It’ll show on your dashboard that day.') }
 const getDraft = topic => run('Writing a draft…', async () => { const r = await school(schoolId, { action: 'draft', staffId, topic }); setDraft({ ...r.draft, to: r.to }) })
 const send = () => run('Sending…', async () => { await school(schoolId, { action: 'send', staffId, subject: draft.subject, body: draft.body }); setDraft(null) }, `Sent to ${draft?.to}.`)
 const remove = () => { if (!window.confirm(`Remove ${name} from your staff list? Their past attendance stays on record, and their check-in code stops working.`)) return; run('Removing…', async () => { await school(schoolId, { action: 'remove_staff', staffId }); onClose() }) }
 const createLogin = () => run('Creating login…', async () => {
  const rows = [{ name, email: prof.email }]
  const pre = await call('/api/admin/create-staff', { mode: 'preview', rows })
  const done = await call('/api/admin/create-staff', { mode: 'apply', rows, confirmation: pre.confirmation })
  if (!done.complete) throw new Error(done.results?.[0]?.error || 'The login wasn’t finished. Try again.')
 }, `Login created for ${prof?.email}. They sign in at askvic.ai with that email (a login link is emailed when they ask for it).`)

 const fix = item => {
  if (item.fix === 'edit') { setTab('profile'); startEdit() }
  else if (item.fix === 'work') { setTab('profile'); startWork() }
  else if (item.fix === 'code') { setTab('profile'); setTimeout(() => document.getElementById('sp-code')?.focus(), 50) }
 }

 return <div className="sp-wrap" role="dialog" aria-modal="true" aria-label={isNew ? 'Add a staff member' : name || 'Staff member'}>
  <button className="sp-scrim" aria-label="Close" onClick={onClose} />
  <aside className="sp">
   <header className="sp-head">
    <div>
     <p className="label">{isNew ? 'New staff member' : (ROLES.find(r => r[0] === prof?.role)?.[1] || 'Staff')}{prof?.assignment ? ` · ${prof.assignment}` : ''}</p>
     <h2>{isNew ? 'Add a staff member' : name || 'Loading…'}</h2>
     {st && <p className={`sp-status ${st.cls}`}><span aria-hidden="true">{st.icon}</span> {st.text}</p>}
    </div>
    <button className="sp-x" onClick={onClose} aria-label="Close panel">✕</button>
   </header>
   {!isNew && <nav className="sp-tabs">{TABS.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => { setTab(k); setNotice(''); setError('') }}>{l}</button>)}</nav>}
   {notice && <p className="notice" role="status">{notice}</p>}
   {error && <p className="alert" role="alert">{error}</p>}
   {busy && <p className="muted" role="status">{busy}</p>}
   {privacy && !isNew && <p className="sp-priv">{reveal ? 'Details showing.' : 'Privacy mode: days off, notes and contacts are hidden.'} <button className="link" onClick={() => setReveal(!reveal)}>{reveal ? 'Hide' : 'Show'}</button></p>}

   {isNew && <form className="sp-body" onSubmit={addNew}>
    <p className="muted">Start with the basics. Next you’ll see a checklist for everything else (check-in code, login, class).</p>
    <label>Full name<input required value={fresh.name} onChange={e => setFresh({ ...fresh, name: e.target.value })} placeholder="Karen Green" /></label>
    <label>Email <small>(for feedback and reminders)</small><input type="email" value={fresh.email} onChange={e => setFresh({ ...fresh, email: e.target.value })} /></label>
    <label>Role<select value={fresh.role} onChange={e => setFresh({ ...fresh, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
    <label>Pay<select value={fresh.payType} onChange={e => setFresh({ ...fresh, payType: e.target.value })}><option value="salaried">Salaried</option><option value="hourly">Hourly</option></select></label>
    <label>Paid days off a year<input inputMode="decimal" value={fresh.sickDays} onChange={e => setFresh({ ...fresh, sickDays: e.target.value })} /></label>
    <div className="sp-row"><button className="btn btn-primary" disabled={!!busy}>Add and continue</button><button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button></div>
   </form>}

   {!isNew && p && <div className="sp-body">
    {tab === 'overview' && <>
     <div className="sp-stats">
      <div className="sp-stat"><span>Paid days off</span>{hide ? <strong>••</strong> : pool == null ? <strong>Not set</strong> : <><strong>{left} <small>of {pool} left</small></strong><div className="bar" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (left / (pool || 1)) * 100))}%` }} /></div></>}{!hide && p.leave.unpaid > 0 && <em className="unpaid">{plural(p.leave.unpaid, 'unpaid day')}</em>}</div>
      <div className="sp-stat"><span>Absences this year</span><strong>{p.absences}</strong>{!hide && p.leave.unexplained > 0 && <em>{p.leave.unexplained} with no reason</em>}</div>
      <div className="sp-stat"><span>Late this year</span><strong>{p.lateCount}</strong>{p.lateCount > 0 && <em>{p.lateMinutes} min total</em>}</div>
      {p.hours && <div className="sp-stat"><span>Hours this week</span><strong>{p.hours.thisWeek}</strong><em>last week {p.hours.lastWeek}</em></div>}
     </div>
     <h3>Growth</h3>
     <ul className="sp-list">
      <li><b>Walkthroughs:</b> {data.walks.length ? `${data.walks.length} this year · last ${fmtDay(data.walks[0].at)} (${daysAgo(data.walks[0].at)} days ago)` : 'none yet'}</li>
      {data.walks[0]?.nextStep && <li><b>Last next step:</b> {data.walks[0].nextStep}</li>}
      <li><b>Learning Path:</b> {data.paths.find(x => x.status !== 'done') ? `${data.paths.find(x => x.status !== 'done').topic} (${data.paths.find(x => x.status !== 'done').status})` : data.paths.length ? `all ${data.paths.length} done ✓` : 'none assigned'}</li>
      {p.lessonPlan && <li><b>This week’s lesson plans:</b> {p.lessonPlan === 'none' ? 'not sent yet' : p.lessonPlan}</li>}
     </ul>
     {p.planned.length > 0 && <><h3>Coming up</h3><ul className="sp-list">{p.planned.map(x => <li key={x.day + x.source}>{fmtDay(x.day)}: {x.label}{x.needsSub ? ' · needs a sub' : ''}{x.source === 'form' ? ' (from form)' : ''}</li>)}</ul></>}
     <h3>Quick actions</h3>
     <div className="sp-actions">
      <a className="btn btn-primary" href={`/walkthroughs?staff=${staffId}`}>Start a walkthrough</a>
      <a className="btn btn-outline" href={`/walkthroughs?tab=assigned&staff=${staffId}`}>Assign a Learning Path</a>
      <button className="btn btn-outline" onClick={() => { setTab('attendance'); setPlan({ from: '', to: '', kind: 'personal', needsSub: false, note: '' }) }}>Plan an absence</button>
      <button className="btn btn-outline" onClick={() => getDraft('days_left')} disabled={!prof.email}>Days-left reminder</button>
     </div>
     {!prof.email && <p className="muted small">Add an email (Profile &amp; setup) to send reminders.</p>}
     {draft && <Draft draft={draft} setDraft={setDraft} send={send} busy={busy} />}
    </>}

    {tab === 'attendance' && <>
     <div className="sp-row"><button className="btn btn-outline" onClick={() => setPlan(plan ? null : { from: '', to: '', kind: 'personal', needsSub: false, note: '' })}>{plan ? 'Cancel' : '+ Plan an absence'}</button>{p.payType === 'hourly' && <a className="btn btn-outline" href="/school/payroll">Fix clock-in times</a>}</div>
     {plan && <form className="sp-box" onSubmit={savePlan}>
      <div className="sp-two"><label>From<input type="date" required value={plan.from} onChange={e => setPlan({ ...plan, from: e.target.value })} /></label><label>To <small>(optional)</small><input type="date" value={plan.to} onChange={e => setPlan({ ...plan, to: e.target.value })} /></label></div>
      <label>What kind<select value={plan.kind} onChange={e => setPlan({ ...plan, kind: e.target.value })}>{MARK_OPTIONS.filter(([k]) => k !== 'present').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={plan.needsSub} onChange={e => setPlan({ ...plan, needsSub: e.target.checked })} /> Needs a sub</label>
      <label>Note <small>(optional)</small><input value={plan.note} onChange={e => setPlan({ ...plan, note: e.target.value })} placeholder="Doctor’s appointment" /></label>
      <button className="btn btn-primary" disabled={!!busy}>Save</button>
     </form>}
     {p.planned.length > 0 && <><h3>Planned</h3><ul className="sp-days">{p.planned.map(x => <li key={x.day + x.source}><span className="d">{fmtDay(x.day)}</span><span className="k told">✉ {x.label}{x.needsSub ? ' · needs a sub' : ''}</span>{x.source === 'you' ? <button className="link" onClick={() => mark(x.day, '')}>Remove</button> : <small>from form</small>}</li>)}</ul></>}
     <h3>Day by day</h3>
     {hide ? <p className="muted">Hidden in privacy mode.</p> : !p.history?.length ? <p className="muted">No school days recorded yet.</p> :
      <ul className="sp-days">{p.history.map(h => <li key={h.day}>
       <span className="d">{fmtDay(h.day)}</span>
       <span className={`k ${h.kind === 'in' ? 'here' : h.kind === 'late' ? 'late' : h.kind === 'absent' ? 'missing' : h.kind === 'present' ? 'here' : 'told'}`}>
        {h.in ? <>{h.kind === 'late' ? '⏰' : '✓'} {fmt12(h.in)}{h.out ? `–${fmt12(h.out)}` : ''}{h.late ? ` · ${h.late} min late` : ''}{h.label ? ` · ${h.label}` : ''}</> : <>{h.kind === 'absent' ? '!' : h.kind === 'present' ? '✓' : '✉'} {h.kind === 'absent' ? 'Absent, no reason' : h.label}</>}
        {(h.paid > 0 || h.unpaid > 0) && <small> · {h.unpaid ? (h.paid ? `${h.paid} paid, ${h.unpaid} unpaid` : 'unpaid') : `${h.paid} paid day`}</small>}
       </span>
       {!h.in || h.kind === 'half' ? <select aria-label={`Change ${fmtDay(h.day)}`} value={h.source === 'you' ? h.kind : ''} onChange={e => mark(h.day, e.target.value)} disabled={!!busy}>
        <option value="">{h.source === 'you' ? 'Undo my change' : 'Change…'}</option>
        {MARK_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
       </select> : <select aria-label={`Change ${fmtDay(h.day)}`} value={h.marked || ''} onChange={e => mark(h.day, e.target.value)} disabled={!!busy}><option value="">{h.marked ? 'Undo my change' : 'Change…'}</option><option value="half">Half day</option><option value="pd">PD / school business</option><option value="excused">Excused (late doesn’t count)</option></select>}
      </li>)}</ul>}
     <p className="muted small">No check-in on a school day counts as absent and uses a paid day. Change any day with the menu. After the paid days run out, more absences are unpaid and show that way on payroll.</p>
    </>}

    {tab === 'growth' && <>
     <div className="sp-actions"><a className="btn btn-primary" href={`/walkthroughs?staff=${staffId}`}>Start a walkthrough</a><a className="btn btn-outline" href={`/walkthroughs?tab=assigned&staff=${staffId}`}>Assign a Learning Path</a></div>
     <h3>Learning Paths</h3>
     {!data.paths.length ? <p className="muted">None assigned yet.</p> : <ul className="sp-list">{data.paths.map(x => <li key={x.id}><b>{x.topic}</b> · {x.status === 'done' ? '✓ done' : x.status === 'started' ? 'in progress' : 'not started'}{x.due ? ` · due ${fmtDay(x.due)}` : ''}</li>)}</ul>}
     <h3>Walkthroughs ({data.walks.length})</h3>
     {!data.walks.length ? <p className="muted">No walkthroughs yet this year.</p> : <ul className="sp-list">{data.walks.map(w => <li key={w.id}><b>{fmtDay(w.at)}</b>{w.subject ? ` · ${w.subject}` : ''}{w.emailed ? ' · ✉ feedback sent' : ''}{w.strength && <div className="small">Strength: {w.strength}</div>}{w.nextStep && <div className="small">Next step: {w.nextStep}</div>}</li>)}</ul>}
     {data.reminders.length > 0 && <><h3>Reminders you sent</h3><ul className="sp-list">{data.reminders.map((r, i) => <li key={i}>{fmtDay(r.sent_at)} · {r.subject}</li>)}</ul></>}
    </>}

    {tab === 'profile' && <>
     <h3>Onboarding checklist</h3>
     <ul className="sp-check">{data.checklist.map(c => <li key={c.key} className={c.done ? 'done' : ''}>
      <span className="box" aria-hidden="true">{c.done ? '✓' : ''}</span>
      <span>{c.label}{!c.done && c.optional ? <small> (optional)</small> : ''}</span>
      {!c.done && c.fix === 'login' && (canManageAccounts && prof.email && prof.role === 'teacher' ?<button className="link" onClick={createLogin} disabled={!!busy}>Create login</button> : <a className="link" href="/admin/accounts">{prof.email ? 'Set up' : 'Add email first'}</a>)}
      {!c.done && c.fix === 'join' && <small className="hint">{joinCode ? `They go to askvic.ai/join and enter ${joinCode}` : 'Share your join code'}</small>}
      {!c.done && c.fix === 'class' && <a className="link" href="/admin/classrooms">Set up class</a>}
      {!c.done && ['edit', 'work', 'code'].includes(c.fix) && <button className="link" onClick={() => fix(c)}>Fix</button>}
     </li>)}</ul>
     {data.classes.length > 0 && <p className="muted small">Classes: {data.classes.join(', ')}</p>}

     <div className="sp-sec"><h3>Profile</h3>{!edit && <button className="link" onClick={startEdit}>Edit</button>}</div>
     {!edit ? <dl className="sp-dl">
      <dt>Email</dt><dd>{prof.email || '—'}</dd>
      <dt>Phone</dt><dd>{hide ? '••' : prof.phone || '—'}</dd>
      <dt>Start date</dt><dd>{prof.startDate ? fmtDay(prof.startDate, { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}</dd>
      <dt>Emergency contact</dt><dd>{hide ? '••' : [prof.emergencyName, prof.emergencyPhone].filter(Boolean).join(' · ') || '—'}</dd>
      <dt>Notes</dt><dd>{hide ? '••' : prof.notes || '—'}</dd>
     </dl> : <form className="sp-box" onSubmit={saveProfile}>
      <label>Full name<input required value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} /></label>
      <div className="sp-two"><label>Role<select value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><label>Grade / subject<input value={edit.assignment} onChange={e => setEdit({ ...edit, assignment: e.target.value })} placeholder="3rd grade" /></label></div>
      <div className="sp-two"><label>Email<input type="email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} /></label><label>Phone<input type="tel" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} /></label></div>
      <label>Start date<input type="date" value={edit.startDate} onChange={e => setEdit({ ...edit, startDate: e.target.value })} /></label>
      <div className="sp-two"><label>Emergency contact<input value={edit.emergencyName} onChange={e => setEdit({ ...edit, emergencyName: e.target.value })} /></label><label>Their phone<input type="tel" value={edit.emergencyPhone} onChange={e => setEdit({ ...edit, emergencyPhone: e.target.value })} /></label></div>
      <label>Notes<textarea rows={3} value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} /></label>
      <div className="sp-row"><button className="btn btn-primary" disabled={!!busy}>Save</button><button type="button" className="btn btn-outline" onClick={() => setEdit(null)}>Cancel</button></div>
     </form>}

     <div className="sp-sec"><h3>Work schedule &amp; pay</h3>{!work && <button className="link" onClick={startWork}>Edit</button>}</div>
     {!work ? <dl className="sp-dl">
      <dt>Pay</dt><dd>{p.payType === 'hourly' ? `Hourly${p.maxHours ? ` · max ${p.maxHours} h a day` : ''}` : 'Salaried'}</dd>
      <dt>Hours</dt><dd>{p.flexible ? 'Flexible (never late or absent)' : p.shiftStart ? `${fmt12(p.shiftStart)}–${fmt12(p.shiftEnd)}` : 'School hours'}{p.workDays?.length ? ` · ${p.workDays.map(d => DAYS.find(x => x[0] === d)?.[1]).filter(Boolean).join(', ')}` : ''}</dd>
      <dt>Paid days off</dt><dd>{hide ? '••' : pool == null ? 'Not set' : `${pool} a year`}</dd>
     </dl> : <form className="sp-box" onSubmit={saveWork}>
      <div className="sp-two"><label>Pay<select value={work.payType} onChange={e => setWork({ ...work, payType: e.target.value })}><option value="salaried">Salaried</option><option value="hourly">Hourly</option></select></label>{work.payType === 'hourly' && <label>Max paid hours a day<input inputMode="decimal" value={work.maxHours} onChange={e => setWork({ ...work, maxHours: e.target.value })} placeholder="School default" /></label>}</div>
      <label className="check"><input type="checkbox" checked={work.flexible} onChange={e => setWork({ ...work, flexible: e.target.checked })} /> Flexible hours (never marked late or absent)</label>
      {!work.flexible && <><div className="sp-two"><label>Starts<input type="time" value={work.shiftStart} onChange={e => setWork({ ...work, shiftStart: e.target.value })} /></label><label>Ends<input type="time" value={work.shiftEnd} onChange={e => setWork({ ...work, shiftEnd: e.target.value })} /></label></div>
       <fieldset className="sp-daysel"><legend>Works on <small>(leave all off for every weekday)</small></legend>{DAYS.map(([n, l]) => <label key={n} className="check"><input type="checkbox" checked={work.workDays.includes(n)} onChange={e => setWork({ ...work, workDays: e.target.checked ? [...work.workDays, n] : work.workDays.filter(x => x !== n) })} />{l}</label>)}</fieldset></>}
      <label>Paid days off a year<input inputMode="decimal" value={work.sickDays} onChange={e => setWork({ ...work, sickDays: e.target.value })} /></label>
      <div className="sp-row"><button className="btn btn-primary" disabled={!!busy}>Save</button><button type="button" className="btn btn-outline" onClick={() => setWork(null)}>Cancel</button></div>
     </form>}

     <h3>Check-in code</h3>
     <form className="sp-row" onSubmit={saveCode}><input id="sp-code" className="code" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} placeholder={p.hasCode ? 'New code' : '4–6 digits'} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} aria-label="Check-in code" /><button className="btn btn-outline" disabled={!!busy || (!code && !p.hasCode)}>{code ? 'Save code' : p.hasCode ? 'Remove code' : 'Save code'}</button></form>
     <p className="muted small">{p.hasCode ? 'Has a code. Codes are stored scrambled, so type a new one to change it.' : 'No code yet. They need one to check in at the kiosk.'}</p>

     <div className="sp-danger"><button className="link danger" onClick={remove}>Remove from staff list</button></div>
    </>}
   </div>}
  </aside>
  <style jsx>{`
   .sp-wrap{position:fixed;inset:0;z-index:80;display:flex;justify-content:flex-end}
   .sp-scrim{position:absolute;inset:0;background:rgba(10,19,48,.35);border:0;cursor:pointer}
   .sp{position:relative;width:min(560px,100%);height:100%;overflow-y:auto;background:var(--vic-surface);box-shadow:var(--vic-shadow-raised);padding:22px 22px 60px;animation:slide .18s ease-out}
   @keyframes slide{from{transform:translateX(40px);opacity:.4}to{transform:none;opacity:1}}
   @media (prefers-reduced-motion:reduce){.sp{animation:none}}
   .sp-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
   h2{margin:0;font-size:28px;line-height:1.15}
   h3{margin:22px 0 8px;font-size:17px}
   .sp-x{border:1px solid var(--vic-border);background:var(--vic-surface);border-radius:10px;width:44px;height:44px;font-size:18px;cursor:pointer}
   .sp-status{display:inline-flex;gap:8px;align-items:center;margin:8px 0 0;padding:5px 12px;border-radius:999px;font-weight:800}
   .here{background:#1E3A8A;color:#fff}.late{background:#F59E0B;color:#2B1700}.missing{background:#fff;color:#0E1730;outline:3px dashed #0E1730;outline-offset:-3px}
   .told{background:repeating-linear-gradient(135deg,#DCE7FF 0 8px,#EEF3FF 8px 16px);color:#0E1730}.waiting,.off{background:#EEF1F6;color:#4E5B78}
   .sp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:16px 0 10px}
   .sp-tabs button{border:1px solid var(--vic-border);background:var(--vic-surface);border-radius:999px;padding:8px 14px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}
   .sp-tabs button[aria-pressed=true]{background:var(--vic-ink);color:#fff;border-color:var(--vic-ink)}
   .sp-priv{font-size:14px;color:var(--vic-text-secondary);background:var(--vic-surface-muted);padding:8px 12px;border-radius:10px}
   .sp-body{display:flex;flex-direction:column}
   form.sp-body,.sp-box{display:flex;flex-direction:column;gap:12px}
   .sp-box{background:var(--vic-bg);border:1px solid var(--vic-border-soft);border-radius:14px;padding:14px;margin:8px 0}
   label{display:flex;flex-direction:column;gap:5px;font-weight:800;font-size:15px}
   label small,legend small{font-weight:600;color:var(--vic-text-muted)}
   input,select,textarea{font:inherit;font-weight:500;padding:10px 12px;border-radius:10px;border:1px solid var(--vic-field-border);background:#fff;min-height:44px}
   .check{flex-direction:row;align-items:center;gap:8px}
   .check input{min-height:auto;width:20px;height:20px}
   .sp-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
   .sp-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
   .sp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:6px}
   .sp-stat{border:1px solid var(--vic-border-soft);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:4px}
   .sp-stat span{font-size:13px;font-weight:800;color:var(--vic-text-secondary);text-transform:uppercase;letter-spacing:.02em}
   .sp-stat strong{font-family:var(--font-head);font-size:28px;line-height:1.1}
   .sp-stat strong small{font-size:15px;color:var(--vic-text-secondary)}
   .sp-stat em{font-style:normal;font-size:14px;color:var(--vic-text-secondary)}
   .unpaid{color:#9A3412!important;font-weight:800}
   .bar{height:8px;border-radius:99px;background:var(--vic-surface-subtle);overflow:hidden}.bar i{display:block;height:100%;background:#1E3A8A}
   .sp-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px;line-height:1.5}
   .sp-actions{display:flex;flex-wrap:wrap;gap:8px}
   .sp-days{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
   .sp-days li{display:grid;grid-template-columns:96px 1fr auto;gap:10px;align-items:center;font-size:15px}
   .sp-days .d{font-weight:800}
   .sp-days .k{padding:5px 10px;border-radius:8px;font-weight:700}
   .sp-days select{min-height:38px;padding:6px 8px;font-size:14px;max-width:150px}
   .sp-check{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
   .sp-check li{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
   .sp-check .box{width:24px;height:24px;border:2px solid var(--vic-field-border);border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;flex:none}
   .sp-check li.done .box{background:#1E3A8A;border-color:#1E3A8A;color:#fff}
   .sp-check li.done{color:var(--vic-text-secondary)}
   .hint{color:var(--vic-text-secondary)}
   .sp-sec{display:flex;justify-content:space-between;align-items:baseline}
   .sp-dl{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;margin:0}
   .sp-dl dt{font-weight:800;color:var(--vic-text-secondary)}.sp-dl dd{margin:0}
   .sp-daysel{border:0;padding:0;margin:0;display:flex;gap:12px;flex-wrap:wrap}
   .sp-daysel legend{font-weight:800;font-size:15px;margin-bottom:6px}
   .code{font-family:var(--font-mono);letter-spacing:.2em;width:140px}
   .link{background:none;border:0;padding:4px;color:var(--vic-primary);font-weight:800;cursor:pointer;font:inherit;font-weight:800;text-decoration:underline}
   .danger{color:var(--vic-danger)}
   .sp-danger{margin-top:28px;padding-top:14px;border-top:1px solid var(--vic-border-soft)}
   .small{font-size:14px}
   @media(max-width:520px){.sp-two{grid-template-columns:1fr}.sp-days li{grid-template-columns:80px 1fr}.sp-days select{grid-column:1/-1;max-width:none}.sp-dl{grid-template-columns:1fr}}
  `}</style>
 </div>
}

function Draft({ draft, setDraft, send, busy }) {
 return <div className="sp-draft">
  <p className="label">Draft to {draft.to || 'no email on file'} · you decide whether to send</p>
  <label>Subject<input value={draft.subject} onChange={e => setDraft({ ...draft, subject: e.target.value })} /></label>
  <label>Message<textarea rows={8} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} /></label>
  <div className="row"><button className="btn btn-primary" onClick={send} disabled={!!busy || !draft.to}>Send</button><button className="btn btn-outline" onClick={() => setDraft(null)}>Cancel</button></div>
  <style jsx>{`
   .sp-draft{margin-top:14px;padding:14px;border-radius:14px;background:var(--vic-bg);border:1px solid var(--vic-border-soft);display:flex;flex-direction:column;gap:10px}
   label{display:flex;flex-direction:column;gap:5px;font-weight:800}
   input,textarea{font:inherit;padding:10px 12px;border-radius:10px;border:1px solid var(--vic-field-border)}
   .row{display:flex;gap:10px}
  `}</style>
 </div>
}
