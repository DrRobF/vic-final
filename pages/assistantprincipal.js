import { useEffect, useMemo, useState } from 'react'
import VICHeader from '../components/VICHeader'
import { supabase } from '../lib/supabase'
import { parseStaffCsv, parseCommitmentsCsv } from '../lib/assistant-principal-import.mjs'
import { appliesTo as commitmentAppliesTo, commitmentStatus, periodFor, planningWeekFor, schoolClock } from '../lib/assistant-principal-rules.mjs'

const SOURCE_TYPES = [
  ['attendance', 'Check-in and check-out'], ['lesson_plans', 'Lesson plans'],
  ['grades', 'Grades'], ['walkthroughs', 'Walkthroughs'], ['absences', 'Staff absences'],
]
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function AssistantPrincipalPage() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [schools, setSchools] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [view, setView] = useState('staff')
  const [expanded, setExpanded] = useState('')
  const [reminder, setReminder] = useState(null)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [clockNow, setClockNow] = useState(() => new Date())
  const [schoolName, setSchoolName] = useState('')
  const [timeZone, setTimeZone] = useState('America/New_York')
  const [staffName, setStaffName] = useState('')
  const [staffRole, setStaffRole] = useState('teacher')
  const [staffEmail, setStaffEmail] = useState('')
  const [title, setTitle] = useState('')
  const [cadence, setCadence] = useState('weekly')
  const [dueWeekday, setDueWeekday] = useState(1)
  const [dueTime, setDueTime] = useState('10:00')
  const [targetGroup, setTargetGroup] = useState('teachers')
  const [sourceKind, setSourceKind] = useState('attendance')
  const [sourceLabel, setSourceLabel] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [draftEdit, setDraftEdit] = useState('')
  const [imports, setImports] = useState({ staff: { text: '', preview: null, error: '' }, commitments: { text: '', preview: null, error: '' } })

  async function request(method, body, schoolId, accessToken = session?.access_token) {
    const url = schoolId ? `/api/assistantprincipal?schoolId=${encodeURIComponent(schoolId)}` : '/api/assistantprincipal'
    const response = await fetch(url, {
      method, headers: { Authorization: `Bearer ${accessToken}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'Could not load Assistant Principal.')
    return data
  }

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      const current = data?.session
      setSession(current || null)
      if (current) {
        try {
          const result = await request('GET', null, null, current.access_token)
          if (active) { setSchools(result.schools || []); setDashboard(result.dashboard || null) }
        } catch (error) { if (active) setAccessError(error.message) }
      }
      if (active) setReady(true)
    })
    const timer = setInterval(() => setClockNow(new Date()), 60000)
    return () => { active = false; clearInterval(timer) }
  }, [])

  useEffect(() => {
    const currentDate = schoolClock(new Date(), dashboard?.school?.time_zone || 'America/New_York').date
    const brief = dashboard?.briefs?.find(item => item.week_start === planningWeekFor(currentDate))
    setNotes(brief?.notes || '')
    setDraftEdit(brief?.draft || '')
  }, [dashboard?.school?.id, dashboard?.briefs?.[0]?.id, dashboard?.briefs?.[0]?.draft, dashboard?.briefs?.[0]?.notes])

  async function mutate(body, success) {
    setMessage(''); setBusy(true)
    try {
      const result = await request('POST', { ...body, ...(dashboard?.school?.id ? { schoolId: dashboard.school.id } : {}) })
      if (result.schoolId) {
        const refreshed = await request('GET', null, result.schoolId)
        setSchools(refreshed.schools || [])
        setDashboard(refreshed.dashboard)
      } else setDashboard(result.dashboard)
      setMessage(success)
      return true
    } catch (error) { setMessage(error.message); return false }
    finally { setBusy(false) }
  }

  async function switchSchool(id) {
    setMessage(''); setBusy(true)
    try { const result = await request('GET', null, id); setDashboard(result.dashboard); setExpanded('') }
    catch (error) { setMessage(error.message) }
    finally { setBusy(false) }
  }

  async function chooseImport(kind, file) {
    setImports(current => ({ ...current, [kind]: { text: '', preview: null, error: '' } })); setMessage('')
    if (!file) return
    if (file.size > 524288) { setImports(current => ({ ...current, [kind]: { text: '', preview: null, error: 'Choose a CSV smaller than 512 KB.' } })); return }
    try {
      const text = await file.text()
      const preview = kind === 'staff' ? parseStaffCsv(text) : parseCommitmentsCsv(text)
      setImports(current => ({ ...current, [kind]: { text, preview, error: '' } }))
    } catch (error) { setImports(current => ({ ...current, [kind]: { text: '', preview: null, error: error.message } })) }
  }

  async function importBatch(kind) {
    const selected = imports[kind]
    if (!selected.preview || selected.preview.errors.length || !selected.text) return
    setBusy(true); setMessage('')
    try {
      const result = await request('POST', { action: kind === 'staff' ? 'import_staff' : 'import_commitments', schoolId: dashboard.school.id, csvText: selected.text })
      setDashboard(result.dashboard)
      const count = result.import || {}
      setMessage(kind === 'staff' ? `Added ${count.staffAdded || 0} staff; skipped ${count.staffSkipped || 0} already present.` : `Added ${count.commitmentsAdded || 0} commitments; skipped ${count.commitmentsSkipped || 0} already present.`)
      setImports(current => ({ ...current, [kind]: { text: '', preview: null, error: '' } }))
    } catch (error) { setImports(current => ({ ...current, [kind]: { ...current[kind], error: error.message } })) }
    finally { setBusy(false) }
  }

  const clock = useMemo(() => {
    try { return schoolClock(clockNow, dashboard?.school?.time_zone || 'America/New_York') }
    catch { return schoolClock(clockNow) }
  }, [clockNow, dashboard?.school?.time_zone])
  const cards = useMemo(() => (dashboard?.staff || []).map(person => {
    const items = (dashboard?.commitments || []).filter(item => commitmentAppliesTo(item, person)).map(item => {
      const evidence = dashboard.evidence.find(record => record.staff_id === person.id && record.commitment_id === item.id && record.period_start === periodFor(item, clock.date))
      return { ...item, evidence, status: commitmentStatus(item, evidence, clock) }
    })
    return { ...person, items, needsAttention: items.some(item => item.status === 'overdue') }
  }), [dashboard, clock])
  const visibleCards = attentionOnly ? cards.filter(card => card.needsAttention) : cards
  const latestBrief = dashboard?.briefs?.find(item => item.week_start === planningWeekFor(clock.date))
  const source = kind => dashboard?.sources?.find(item => item.kind === kind)

  if (!ready) return <main className="ap-page"><div className="ap-shell"><p>Loading Assistant Principal…</p></div></main>
  if (!session) return (
    <main className="ap-page"><div className="ap-shell"><VICHeader currentPath="/assistantprincipal" />
      <section className="ap-hero"><p className="ap-eyebrow">Ask VIC for school leaders</p><h1>Meet your Assistant Principal.</h1>
        <p>Bring your school’s roster, weekly commitments, and the tools you already use. Plan the week, track follow-through, and review every draft before it goes to anyone.</p>
        <div className="ap-actions"><a className="ap-primary" href="/login?next=/assistantprincipal">Sign in</a><a className="ap-outline" href="/signup">Request school access</a></div>
      </section><Styles /></div></main>
  )
  if (accessError) return <main className="ap-page"><div className="ap-shell"><VICHeader currentPath="/assistantprincipal" /><section className="ap-panel"><h1>Assistant Principal access</h1><p role="alert">{accessError}</p><a href="/signup">Request principal access</a></section><Styles /></div></main>
  if (!dashboard) return (
    <main className="ap-page"><div className="ap-shell"><VICHeader currentPath="/assistantprincipal" /><section className="ap-panel ap-setup">
      <p className="ap-eyebrow">School setup</p><h1>Start with your school</h1><p>Each school has its own staff, commitments, and source links. You can add people and connections after this step.</p>
      <form onSubmit={async event => { event.preventDefault(); await mutate({ action: 'create_school', name: schoolName, timeZone }, 'School created. Add your staff and commitments next.') }}>
        <label>School name<input value={schoolName} onChange={e => setSchoolName(e.target.value)} required minLength="2" maxLength="120" /></label>
        <label>School time zone<input value={timeZone} onChange={e => setTimeZone(e.target.value)} required /></label>
        <button className="ap-primary" disabled={busy}>Create school workspace</button>
      </form>{message && <p role="status">{message}</p>}
    </section><Styles /></div></main>
  )

  return (
    <main className="ap-page"><div className="ap-shell"><VICHeader currentPath="/assistantprincipal" />
      <header className="ap-heading"><div><p className="ap-eyebrow">Assistant Principal</p><h1>{dashboard.school.name}</h1><p>{clock.date} · {dashboard.school.time_zone} · principal review</p></div>
        {schools.length > 1 && <label>School<select value={dashboard.school.id} onChange={e => switchSchool(e.target.value)}>{schools.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      </header>
      <nav className="ap-tabs" aria-label="Assistant Principal"><button className={view === 'staff' ? 'selected' : ''} onClick={() => setView('staff')}>Staff pulse</button><button className={view === 'week' ? 'selected' : ''} onClick={() => setView('week')}>Weekly brief</button><button className={view === 'setup' ? 'selected' : ''} onClick={() => setView('setup')}>School setup</button></nav>
      {message && <p className="ap-message" role="status">{message}</p>}
      {view === 'staff' && <section>
        <div className="ap-section-title"><div><h2>Staff pulse</h2><p>{cards.length} active staff · {cards.filter(item => item.needsAttention).length} with an overdue commitment</p></div><label className="ap-inline"><input type="checkbox" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} /> Needs attention</label></div>
        {!cards.length && <div className="ap-panel"><h3>Add your staff to begin</h3><p>Open School setup to add a roster. Cards will show only commitments that apply to each role.</p><button className="ap-outline" onClick={() => setView('setup')}>Open setup</button></div>}
        {cards.length > 0 && visibleCards.length === 0 && <div className="ap-panel">No staff have an overdue commitment right now.</div>}
        <div className="ap-card-list">{visibleCards.map(person => <article className="ap-panel ap-person" key={person.id}>
          <button className="ap-person-top" aria-expanded={expanded === person.id} onClick={() => setExpanded(expanded === person.id ? '' : person.id)}><strong>{person.display_name}<small>{person.role}</small></strong><span>{person.items.length} tracked</span><span className={person.needsAttention ? 'ap-tag warning' : 'ap-tag'}>{person.needsAttention ? 'Needs review' : 'No overdue items'}</span><span aria-hidden="true">{expanded === person.id ? '−' : '+'}</span></button>
          {expanded === person.id && <div className="ap-person-body">
            {!person.items.length && <p>No commitments apply to this role yet.</p>}
            {person.items.map(item => <div className="ap-item" key={item.id}><div><strong>{item.title}</strong><small>{item.cadence === 'weekly' ? `${DAYS[item.due_weekday]} by ${item.due_time.slice(0, 5)}` : `Daily by ${item.due_time.slice(0, 5)}`} · {item.status}</small></div><div className="ap-actions"><button className="ap-outline" disabled={busy} onClick={() => mutate({ action: 'record_evidence', staffId: person.id, commitmentId: item.id, state: 'received' }, 'Receipt recorded for this period.')}>Mark received</button><button className="ap-outline" disabled={busy || !item.evidence} onClick={() => mutate({ action: 'record_evidence', staffId: person.id, commitmentId: item.id, state: 'reviewed' }, 'Review recorded for this period.')}>Mark reviewed</button></div></div>)}
            {person.role === 'teacher' && source('grades') && <p><a href={source('grades').url} target="_blank" rel="noreferrer noopener">Open grade source ↗</a> <small>Source link only; teacher-specific gradebook import is next.</small></p>}
            {source('attendance') && <p><a href={source('attendance').url} target="_blank" rel="noreferrer noopener">Open attendance source ↗</a> <small>Live check-in sync is not active yet.</small></p>}
            {person.needsAttention && <button className="ap-outline" onClick={() => setReminder({ name: person.display_name, email: person.email, items: person.items.filter(item => item.status === 'overdue').map(item => item.title) })}>Preview reminder</button>}
          </div>}
        </article>)}</div>
      </section>}
      {reminder && <div className="ap-overlay" role="presentation"><div className="ap-dialog ap-panel" role="dialog" aria-modal="true" aria-labelledby="ap-reminder-title"><h3 id="ap-reminder-title">Reminder draft for {reminder.name}</h3><p>Our records show that the following {reminder.items.length === 1 ? 'item is' : 'items are'} still due: {reminder.items.join(', ')}. Please submit the work or let me know if the record needs correcting. Thank you.</p><p className="ap-small">Recipient: {reminder.email || 'Email not supplied'} · Preview only. Sending is not connected.</p><button className="ap-primary" onClick={() => setReminder(null)}>Close preview</button></div></div>}
      {view === 'week' && <section><div className="ap-section-title"><div><h2>Weekly brief</h2><p>Friday before leaving or Monday morning. Enter non-confidential notes and review the result.</p></div></div>
        <div className="ap-grid"><form className="ap-panel" onSubmit={async e => { e.preventDefault(); await mutate({ action: 'draft_brief', notes }, 'Draft saved privately for your review.') }}><h3>Your notes</h3><textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength="5000" placeholder="Goals, dates, loose ends, staff meeting topics…" rows="12" /><button className="ap-primary" disabled={busy || latestBrief?.state === 'approved'}>Draft weekly brief</button><p className="ap-small">Do not include student names, confidential evaluations, or private personnel details.</p></form>
          <div className="ap-panel"><h3>Review draft</h3>{latestBrief ? <><p className="ap-small">Week of {latestBrief.week_start} · {latestBrief.state}</p><textarea value={draftEdit} onChange={e => setDraftEdit(e.target.value)} rows="16" disabled={latestBrief.state === 'approved'} /><button className="ap-primary" disabled={busy || latestBrief.state === 'approved'} onClick={() => mutate({ action: 'approve_brief', briefId: latestBrief.id, draft: draftEdit }, 'Brief approved. Nothing has been sent or assigned.')}>Approve this brief</button></> : <p>Your first draft will appear here. Approval does not send it to staff.</p>}</div></div>
      </section>}
      {view === 'setup' && <section><div className="ap-section-title"><div><h2>School setup</h2><p>Bring your own staff, rules, and data sources. Linked sheets remain under your school’s control.</p></div></div>
        <div className="ap-grid">
          <div className="ap-panel"><h3>1. Add your staff list</h3><p>One row per person. Paste names from your roster, add a role, and include email if you have it.</p>
            <a className="ap-outline" href="/assistant-principal-staff-template.csv" download>Download staff sheet</a>
            <p className="ap-small">Columns: Staff name · Role · Email (optional). Roles: teacher, office, support, leader, or other.</p>
            <label>Upload completed staff CSV<input type="file" accept=".csv,text/csv" onChange={e => chooseImport('staff', e.target.files?.[0])} /></label>
            {imports.staff.error && <p role="alert">{imports.staff.error}</p>}
            {imports.staff.preview && <div className="ap-import-preview"><h4>Preview: {imports.staff.preview.staff.length} staff</h4>
              {imports.staff.preview.errors.length ? <><p role="alert">Fix these rows and choose the file again:</p><ul>{imports.staff.preview.errors.slice(0, 12).map((error, i) => <li key={i}>{error}</li>)}</ul></> : <><p>{imports.staff.preview.staff.slice(0, 5).map(item => item.display_name).join(', ')}{imports.staff.preview.staff.length > 5 ? '…' : ''}</p><button className="ap-primary" disabled={busy} onClick={() => importBatch('staff')}>Import {imports.staff.preview.staff.length} staff</button></>}
            </div>}
          </div>
          <div className="ap-panel"><h3>2. Add recurring commitments</h3><p>One row per schoolwide rule, such as weekly grades or daily check-in. Set these up once; the assistant tracks each cycle.</p>
            <a className="ap-outline" href="/assistant-principal-commitments-template.csv" download>Download commitments sheet</a>
            <p className="ap-small">Columns: Commitment · Applies to (Teachers or All staff) · Repeats (Daily or Weekly) · Due day (for weekly rules) · Due time (for example, 10:00 AM). Leave Due day blank for daily rules.</p>
            <label>Upload completed commitments CSV<input type="file" accept=".csv,text/csv" onChange={e => chooseImport('commitments', e.target.files?.[0])} /></label>
            {imports.commitments.error && <p role="alert">{imports.commitments.error}</p>}
            {imports.commitments.preview && <div className="ap-import-preview"><h4>Preview: {imports.commitments.preview.commitments.length} commitments</h4>
              {imports.commitments.preview.errors.length ? <><p role="alert">Fix these rows and choose the file again:</p><ul>{imports.commitments.preview.errors.slice(0, 12).map((error, i) => <li key={i}>{error}</li>)}</ul></> : <><p>{imports.commitments.preview.commitments.slice(0, 5).map(item => item.title).join(', ')}{imports.commitments.preview.commitments.length > 5 ? '…' : ''}</p><button className="ap-primary" disabled={busy} onClick={() => importBatch('commitments')}>Import {imports.commitments.preview.commitments.length} commitments</button></>}
            </div>}
          </div>
        </div>
        <p className="ap-small">Open a downloaded CSV in Numbers, Excel, or Google Sheets. When finished, export or download it as CSV for upload. Existing rows are skipped on repeat uploads. Keep student records and kiosk codes out of these sheets.</p>
        <div className="ap-grid"><form className="ap-panel" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: 'add_staff', displayName: staffName, role: staffRole, email: staffEmail }, 'Staff card added.')) { setStaffName(''); setStaffEmail('') } }}><h3>Add staff</h3><label>Name<input value={staffName} onChange={e => setStaffName(e.target.value)} required /></label><label>Role<select value={staffRole} onChange={e => setStaffRole(e.target.value)}>{['teacher', 'office', 'support', 'leader', 'other'].map(role => <option key={role} value={role}>{role}</option>)}</select></label><label>Email (optional)<input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} /></label><button className="ap-primary" disabled={busy}>Add staff card</button></form>
          <form className="ap-panel" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: 'add_commitment', title, cadence, appliesTo: targetGroup, dueWeekday, dueTime }, 'Commitment added.')) setTitle('') }}><h3>Add a commitment</h3><label>What is due?<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly grades" required /></label><label>Applies to<select value={targetGroup} onChange={e => setTargetGroup(e.target.value)}><option value="teachers">Teachers</option><option value="all">All staff</option></select></label><label>Repeats<select value={cadence} onChange={e => setCadence(e.target.value)}><option value="weekly">Weekly</option><option value="daily">Daily</option></select></label>{cadence === 'weekly' && <label>Due day<select value={dueWeekday} onChange={e => setDueWeekday(Number(e.target.value))}>{DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}<label>Due time<input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} required /></label><button className="ap-primary" disabled={busy}>Add commitment</button></form>
        </div><div className="ap-panel"><h3>Current commitments</h3>{dashboard.commitments.length ? <ul>{dashboard.commitments.map(item => <li key={item.id}>{item.title} · {item.applies_to} · {item.cadence === 'weekly' ? DAYS[item.due_weekday] : 'daily'} {item.due_time.slice(0, 5)}</li>)}</ul> : <p>None yet. Your school sets its own requirements.</p>}</div>
        <div className="ap-grid"><form className="ap-panel" onSubmit={async e => { e.preventDefault(); if (await mutate({ action: 'save_source', kind: sourceKind, label: sourceLabel, url: sourceUrl }, 'Source link saved. Automatic import is not active yet.')) { setSourceLabel(''); setSourceUrl('') } }}><h3>Data source links</h3><p>Save a link now. We will verify permissions and field mapping before any automatic import.</p><label>Source<select value={sourceKind} onChange={e => setSourceKind(e.target.value)}>{SOURCE_TYPES.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label><label>Label<input value={sourceLabel} onChange={e => setSourceLabel(e.target.value)} placeholder="Staff attendance sheet" required /></label><label>Secure URL<input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://…" required /></label><button className="ap-primary" disabled={busy}>Save source link</button></form>
          <div className="ap-panel"><h3>Your sources</h3>{dashboard.sources.length ? <ul>{dashboard.sources.map(item => <li key={item.id}><a href={item.url} target="_blank" rel="noreferrer noopener">{item.label} ↗</a><small> {item.kind.replace('_', ' ')} · link saved, import pending</small></li>)}</ul> : <p>Every school may bring its own Sheets, forms, or later an approved integration.</p>}<p className="ap-small">Never paste passwords, access tokens, or private student records here.</p></div>
        </div>
      </section>}
      <footer className="ap-footer">Assistant Principal prepares and tracks work. The school leader approves decisions and sharing.</footer>
    </div><Styles /></main>
  )
}

function Styles() { return <style jsx global>{`
  .ap-page { min-height: 100vh; background: var(--vic-bg); color: var(--vic-text-primary); padding: 20px 18px 50px; }
  .ap-shell { max-width: 1160px; margin: auto; }
  .ap-heading { display: flex; justify-content: space-between; gap: 20px; align-items: end; margin: 26px 0 18px; }
  .ap-heading h1, .ap-hero h1 { margin: 4px 0 8px; font-size: clamp(30px, 5vw, 48px); line-height: 1.08; }
  .ap-heading p, .ap-hero p, .ap-panel p, .ap-section-title p { color: var(--vic-text-secondary); line-height: 1.5; }
  .ap-eyebrow { color: var(--vic-primary) !important; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; font-weight: 800; }
  .ap-tabs { display: flex; flex-wrap: wrap; gap: 7px; border-bottom: 1px solid var(--vic-border); margin-bottom: 22px; }
  .ap-tabs button { padding: 12px 16px; border: 0; background: transparent; color: var(--vic-text-secondary); cursor: pointer; font-weight: 700; }
  .ap-tabs button.selected { color: var(--vic-primary); border-bottom: 3px solid var(--vic-primary); }
  .ap-section-title { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin: 14px 0; }
  .ap-section-title h2 { margin: 0; font-size: 25px; }.ap-section-title p { margin: 5px 0; }
  .ap-panel, .ap-hero { background: var(--vic-surface); border: 1px solid var(--vic-border-soft); border-radius: 16px; padding: 20px; box-shadow: var(--vic-shadow-soft); margin-bottom: 14px; }
  .ap-hero { max-width: 760px; margin: 62px auto; padding: clamp(28px, 5vw, 52px); }.ap-hero p { font-size: 18px; }
  .ap-setup { max-width: 620px; margin: 40px auto; }.ap-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; align-items: start; }
  .ap-panel h3 { margin: 0 0 12px; font-size: 18px; }.ap-panel ul { padding-left: 20px; }.ap-panel li { margin: 9px 0; }
  .ap-page label { display: grid; gap: 5px; margin: 10px 0; font-weight: 600; font-size: 13px; }
  .ap-page input:not([type=checkbox]), .ap-page select, .ap-page textarea { width: 100%; padding: 10px 11px; border: 1px solid var(--vic-border); background: var(--vic-surface); color: var(--vic-text-primary); border-radius: 8px; }
  .ap-page textarea { resize: vertical; line-height: 1.5; }.ap-inline { display: flex !important; align-items: center; gap: 7px; }
  .ap-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }.ap-actions a { text-decoration: none; }
  .ap-primary, .ap-outline { display: inline-flex; align-items: center; justify-content: center; margin-top: 8px; padding: 10px 14px; border-radius: 9px; font-weight: 700; cursor: pointer; border: 1px solid var(--vic-primary); }
  .ap-primary { background: var(--vic-primary); color: var(--vic-surface) !important; }.ap-outline { background: var(--vic-surface); color: var(--vic-primary); }
  .ap-page button:disabled { opacity: .55; cursor: not-allowed; }.ap-card-list { display: grid; gap: 9px; }
  .ap-import-preview { margin-top: 14px; padding: 14px; border: 1px solid var(--vic-border); border-radius: 9px; }.ap-import-preview h4 { margin: 0 0 8px; }
  .ap-person { margin: 0; padding: 0; overflow: hidden; }.ap-person-top { width: 100%; display: grid; grid-template-columns: minmax(160px, 1fr) 100px 140px 20px; align-items: center; gap: 10px; padding: 17px 18px; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .ap-person-top small, .ap-item small, .ap-panel small { display: block; font-size: 12px; color: var(--vic-text-secondary); font-weight: 400; }.ap-tag { background: var(--vic-success-soft); color: var(--vic-text-primary); border-radius: 7px; padding: 6px 8px; font-size: 12px; }.ap-tag.warning { background: var(--vic-danger-soft); }
  .ap-person-body { border-top: 1px solid var(--vic-border-soft); padding: 8px 18px 18px; }.ap-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; border-bottom: 1px solid var(--vic-border-soft); padding: 10px 0; }
  .ap-item:last-child { border-bottom: 0; }.ap-item .ap-outline { margin: 0; white-space: nowrap; font-size: 12px; }.ap-message { padding: 10px 14px; border-radius: 8px; background: var(--vic-accent-soft); }.ap-small { font-size: 12px; }.ap-footer { margin-top: 32px; padding: 18px 0; color: var(--vic-text-secondary); font-size: 13px; }
  .ap-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 20px; background: rgba(43,36,31,.55); }.ap-dialog { width: min(520px, 100%); margin: 0; }
  @media (max-width: 730px) { .ap-grid { grid-template-columns: 1fr; }.ap-heading { align-items: start; flex-direction: column; }.ap-person-top { grid-template-columns: 1fr 110px; }.ap-person-top > span:nth-child(2) { display: none; }.ap-item { display: block; }.ap-item .ap-actions { margin-top: 10px; } }
`}</style> }
