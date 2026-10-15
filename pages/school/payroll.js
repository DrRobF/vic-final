import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { supabase } from '../../lib/supabase'
import { payrollCsv, fmt12 } from '../../lib/payroll.mjs'

async function api(method, body, query = '') {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/school-login'); throw new Error('Please log in.') }
 const r = await fetch(`/api/school/attendance${query}`, { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong.')
 return d
}
const iso = d => d.toISOString().slice(0, 10)
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const fmtDay = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
const today = () => { const n = new Date(); return iso(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12))) }

const monthEnd = day => { const [y, m] = day.split('-').map(Number); return iso(new Date(Date.UTC(y, m, 0, 12))) }
// The pay period containing a day: twice a month (1st–15th, 16th–end) or every two weeks from a known start.
function periodFor(day, anchor, schedule) {
 if (schedule === 'semimonthly') { const ym = day.slice(0, 8); return Number(day.slice(8)) <= 15 ? { from: `${ym}01`, to: `${ym}15` } : { from: `${ym}16`, to: monthEnd(day) } }
 if (!anchor) return { from: addDays(day, -13), to: day }
 const diff = Math.round((Date.parse(`${day}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 864e5)
 const from = addDays(anchor, Math.floor(diff / 14) * 14)
 return { from, to: addDays(from, 13) }
}

// Payroll for a pay period: hourly hours day by day (with corrections), salaried days and leave. Print, download or email.
export default function Payroll() {
 const [schoolId, setSchoolId] = useState(''), [school, setSchool] = useState(null), [period, setPeriod] = useState(null), [report, setReport] = useState(null)
 const [error, setError] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(''), [editing, setEditing] = useState(null), [settings, setSettings] = useState(null)

 useEffect(() => {
  (async () => {
   const q = new URLSearchParams(window.location.search)
   let id = q.get('school')
   if (!id) { const d = await api('GET'); id = d.schools[0]?.id }
   if (!id) { setError('Set up your school first on Staff & deadlines.'); return }
   setSchoolId(id)
   const d = await api('GET', null, `?schoolId=${encodeURIComponent(id)}`)
   setSchool(d.school); setSettings({ paySchedule: d.school.paySchedule, payPeriodStart: d.school.payPeriodStart, payrollEmail: d.school.payrollEmail })
   setPeriod(periodFor(today(), d.school.payPeriodStart, d.school.paySchedule))
  })().catch(e => setError(e.message))
 }, [])

 async function load() { if (!period || !schoolId) return; setError(''); try { setReport(await api('POST', { schoolId, action: 'payroll', ...period })) } catch (e) { setError(e.message) } }
 useEffect(() => { load() }, [period?.from, period?.to, schoolId])

 const move = n => setPeriod(p => school?.paySchedule === 'semimonthly' ? periodFor(n < 0 ? addDays(p.from, -1) : addDays(p.to, 1), null, 'semimonthly') : { from: addDays(p.from, 14 * n), to: addDays(p.to, 14 * n) })
 function download() {
  const csv = payrollCsv(report.report, report.from, report.to, report.school)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), a = document.createElement('a')
  a.href = url; a.download = `Payroll-${report.from}-to-${report.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
 }
 async function email() { setBusy('email'); setError(''); setMsg(''); try { const d = await api('POST', { schoolId, action: 'payroll_email', ...period }); setMsg(`Sent to ${d.to}.`) } catch (e) { setError(e.message) } finally { setBusy('') } }
 async function saveSettings() { setError(''); try { await api('POST', { schoolId, action: 'school_settings', dayStart: school.dayStart, dayEnd: school.dayEnd, ...settings }); setSchool({ ...school, ...settings }); setPeriod(periodFor(today(), settings.payPeriodStart, settings.paySchedule)); setMsg('Payroll settings saved.') } catch (e) { setError(e.message) } }
 async function saveEdit() { setBusy('edit'); setError(''); try { const { adding, ...edit } = editing; await api('POST', { schoolId, action: 'edit_punch', ...edit }); setEditing(null); setMsg('Time corrected. The original is kept with the record.'); await load() } catch (e) { setError(e.message) } finally { setBusy('') } }

 const hourly = report?.report.filter(p => p.payType === 'hourly') || [], salaried = report?.report.filter(p => p.payType !== 'hourly') || []
 const left = id => report?.people.find(p => p.id === id) || {}

 return <PageShell title="Payroll" currentPath="/school/attendance">
  <PanelStyles />
  <a className="back noprint" href="/school/attendance">← Staff attendance</a>
  <header className="top">
   <div><p className="label">Payroll</p><h1>{school?.name || 'Payroll'}</h1>{period && <p className="muted">{fmtDay(period.from)} – {fmtDay(period.to)}</p>}</div>
   {period && <div className="row noprint">
    <button type="button" className="btn btn-outline" onClick={() => move(-1)}>← Previous</button>
    <button type="button" className="btn btn-outline" onClick={() => move(1)}>Next →</button>
   </div>}
  </header>
  {error && <p className="alert" role="alert">{error}</p>}{msg && <p className="notice" role="status">{msg}</p>}
  {period && !report && !error && <p role="status">Adding up hours…</p>}

  {report && <>
   <div className="row noprint">
    <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print</button>
    <button type="button" className="btn btn-outline" onClick={download}>Download for Excel</button>
    <button type="button" className="btn btn-outline" disabled={!!busy || !school?.payrollEmail} onClick={email} title={school?.payrollEmail ? '' : 'Add the business manager’s email below'}>{busy === 'email' ? 'Sending…' : school?.payrollEmail ? `Email to ${school.payrollEmail}` : 'Email to business manager'}</button>
   </div>

   <section className="panel">
    <p className="label">Hourly staff</p>
    {!hourly.length && <p>No one is marked hourly. Set pay type with Edit on the Staff attendance page.</p>}
    {hourly.map(p => <div key={p.id} className="person">
     <div className="ph"><h2>{p.name}</h2><strong className="tot">{p.totalHours} hours</strong>{left(p.id).paidLeft != null && <span className="muted">{left(p.id).paidLeft} paid days left</span>}{p.issues > 0 && <span className="warn">{p.issues} day{p.issues === 1 ? '' : 's'} need a look</span>}</div>
     <table>
      <thead><tr><th>Day</th><th>In</th><th>Out</th><th>Hours</th><th>Note</th><th className="noprint" /></tr></thead>
      <tbody>{p.rows.map(r => editing?.staffId === p.id && editing.day === r.day ? <tr key={r.day} className="ed"><td>{fmtDay(r.day)}</td>
       <td><input type="time" value={editing.clockIn} onChange={e => setEditing({ ...editing, clockIn: e.target.value })} /></td>
       <td><input type="time" value={editing.clockOut} onChange={e => setEditing({ ...editing, clockOut: e.target.value })} /></td>
       <td colSpan={2}><input className="why" placeholder="Reason (kept with the record)" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} /></td>
       <td><button type="button" className="btn btn-primary sm" disabled={busy === 'edit'} onClick={saveEdit}>Save</button> <button type="button" className="linkbtn" onClick={() => setEditing(null)}>Cancel</button></td></tr>
       : <tr key={r.day}><td>{fmtDay(r.day)}</td><td>{fmt12(r.in)}</td><td>{fmt12(r.out)}</td><td>{r.in ? r.hours : ''}</td>
        <td className="note">{[r.absence, r.flag, r.edited ? 'Corrected' : ''].filter(Boolean).join(' · ')}</td>
        <td className="noprint">{!r.absence && <button type="button" className="linkbtn" onClick={() => setEditing({ staffId: p.id, day: r.day, clockIn: r.in, clockOut: r.out, note: '' })}>Fix</button>}</td></tr>)}
       {editing?.staffId === p.id && editing.adding && <tr className="ed"><td><input type="date" min={period.from} max={period.to} value={editing.day} onChange={e => setEditing({ ...editing, day: e.target.value })} /></td>
        <td><input type="time" value={editing.clockIn} onChange={e => setEditing({ ...editing, clockIn: e.target.value })} /></td>
        <td><input type="time" value={editing.clockOut} onChange={e => setEditing({ ...editing, clockOut: e.target.value })} /></td>
        <td colSpan={2}><input className="why" placeholder="Reason (kept with the record)" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} /></td>
        <td><button type="button" className="btn btn-primary sm" disabled={busy === 'edit' || !editing.day} onClick={saveEdit}>Save</button> <button type="button" className="linkbtn" onClick={() => setEditing(null)}>Cancel</button></td></tr>}</tbody>
     </table>
     {!(editing?.staffId === p.id && editing.adding) && <button type="button" className="linkbtn noprint" onClick={() => setEditing({ staffId: p.id, day: '', clockIn: '', clockOut: '', note: '', adding: true })}>+ Add a missing day</button>}
    </div>)}
    <p className="muted small">Every correction keeps the original time, who changed it, and your reason.</p>
   </section>

   <section className="panel">
    <p className="label">Salaried staff</p>
    <table>
     <thead><tr><th>Name</th><th>Days worked</th><th>Absences this period</th><th>Paid days left</th></tr></thead>
     <tbody>{salaried.map(p => <tr key={p.id}><td className="nm">{p.name}</td><td>{p.daysWorked}</td><td>{Object.entries(p.absences).map(([k, n]) => `${n} ${k}`).join(', ') || '—'}</td><td>{left(p.id).paidLeft ?? '—'}</td></tr>)}</tbody>
    </table>
   </section>

   {settings && <section className="panel noprint">
    <p className="label">Payroll settings</p>
    <div className="row">
     <label className="f">Pay periods<select value={settings.paySchedule || 'biweekly'} onChange={e => setSettings({ ...settings, paySchedule: e.target.value })}><option value="semimonthly">Twice a month (1st–15th and 16th–end)</option><option value="biweekly">Every two weeks</option></select></label>
     {settings.paySchedule !== 'semimonthly' && <label className="f">A pay period starts on<input type="date" value={settings.payPeriodStart || ''} onChange={e => setSettings({ ...settings, payPeriodStart: e.target.value })} /></label>}
     <label className="f">Business manager’s email<input type="email" value={settings.payrollEmail || ''} placeholder="business@school.org" onChange={e => setSettings({ ...settings, payrollEmail: e.target.value })} /></label>
     <button type="button" className="btn btn-outline" onClick={saveSettings}>Save</button>
    </div>
    <small className="muted">For every two weeks, pick the first day of any pay period; AskVic counts from there.</small>
   </section>}
  </>}
  <style jsx>{`
   .back{font-weight:800;text-decoration:none}
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
   h1{margin:0 0 4px;font-size:clamp(28px,3.2vw,40px)}
   .row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}
   .person{padding:14px 0;border-top:1px solid var(--vic-border-soft)}
   .ph{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
   .ph h2{margin:0;font-size:20px}
   .tot{font-family:var(--font-head);font-size:22px;color:var(--vic-primary)}
   .warn{color:var(--vic-danger);font-weight:800;font-size:14px}
   table{width:100%;border-collapse:collapse;font-size:15px;margin-top:8px}
   th{text-align:left;font-family:var(--font-mono);font-size:12px;text-transform:uppercase;color:var(--vic-text-secondary);padding:6px 8px;border-bottom:2px solid var(--vic-border)}
   td{padding:7px 8px;border-bottom:1px solid var(--vic-border-soft)}
   .note{color:var(--vic-text-secondary);font-size:14px}
   .nm{font-weight:800}
   .ed td{background:var(--vic-surface-muted)}
   .ed input{padding:6px;border-radius:7px;border:1px solid var(--vic-border);font:inherit}
   .why{width:100%}
   .linkbtn{background:none;border:0;color:var(--vic-primary);text-decoration:underline;cursor:pointer;font-weight:700}
   .f{display:flex;flex-direction:column;gap:4px;font-weight:800;font-size:14px}
   .f input{padding:9px;border-radius:9px;border:1px solid var(--vic-field-border);font:inherit;min-width:220px}
   .small{font-size:14px;margin-top:10px}
   @media print{
    :global(.vicHeader),.noprint{display:none!important}
    :global(.panel){box-shadow:none!important;border:0!important;padding:0!important}
    .person{break-inside:avoid}
    table{font-size:12px}
   }
  `}</style>
 </PageShell>
}
