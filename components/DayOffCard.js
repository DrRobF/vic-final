import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmtDay } from '../lib/staff-ui.mjs'

const KINDS = [['sick', 'Sick day'], ['personal', 'Personal day'], ['half', 'Half day'], ['pd', 'PD / school business'], ['unpaid', 'Unpaid day']]
const LABEL = Object.fromEntries(KINDS)
const STATUS = { pending: 'Waiting for your principal', approved: 'Approved', declined: 'Declined', cancelled: 'Cancelled' }

async function call(body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch('/api/educator/day-off', body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'That didn’t go through.')
 return d
}

// A teacher asks for a day off ahead of time. The principal approves it; nothing is automatic.
export default function DayOffCard() {
 const [data, setData] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
 const load = () => call().then(setData).catch(() => setData({ linked: false, requests: [] }))
 useEffect(() => { load() }, [])
 if (!data?.linked) return null

 const blank = { day: '', endDay: '', kind: 'sick', note: '', needsSub: false }
 const pending = data.requests.filter(r => r.status === 'pending')
 const recent = data.requests.filter(r => r.status !== 'pending' && r.status !== 'cancelled').slice(0, 3)

 async function submit(e) {
  e.preventDefault(); setBusy(true); setError(''); setNotice('')
  try { await call({ ...form, endDay: form.endDay || '' }); setForm(null); setNotice('Sent. Your principal will see it on their dashboard.'); await load() }
  catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function cancel(id) {
  setBusy(true); setError('')
  try { await call({ action: 'cancel', id }); await load() } catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 const span = r => r.endDay && r.endDay !== r.day ? `${fmtDay(r.day)} – ${fmtDay(r.endDay)}` : fmtDay(r.day)

 return <section className="panel">
  <p className="label">Time off</p>
  <h2>Ask for a day off</h2>
  <p>Give {data.school} a heads-up and your principal can line up coverage. Nothing changes until they approve it.</p>
  {error && <p className="alert" role="alert">{error}</p>}
  {notice && <p className="notice" role="status">{notice}</p>}

  {!!pending.length && <ul className="list">{pending.map(r => <li key={r.id}>
   <span><b>{span(r)}</b> · {LABEL[r.kind] || r.kind} · <em>{STATUS[r.status]}</em></span>
   <button type="button" className="linkish" disabled={busy} onClick={() => cancel(r.id)}>Cancel</button>
  </li>)}</ul>}
  {!!recent.length && <ul className="list quiet">{recent.map(r => <li key={r.id}>
   <span><b>{span(r)}</b> · {LABEL[r.kind] || r.kind} · <em>{STATUS[r.status]}</em>{r.declineNote ? ` — ${r.declineNote}` : ''}</span>
  </li>)}</ul>}

  {!form ? <button type="button" className="btn btn-outline" onClick={() => { setForm(blank); setNotice('') }}>+ Request a day off</button>
   : <form onSubmit={submit}>
    <div className="two">
     <label>First day<input type="date" required value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} /></label>
     <label>Last day <small>(leave blank for one day)</small><input type="date" value={form.endDay} onChange={e => setForm({ ...form, endDay: e.target.value })} /></label>
    </div>
    <label>What kind<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label>Anything your principal should know <small>(optional)</small><input value={form.note} maxLength={300} placeholder="Doctor at 9, back by noon…" onChange={e => setForm({ ...form, note: e.target.value })} /></label>
    <label className="check"><input type="checkbox" checked={form.needsSub} onChange={e => setForm({ ...form, needsSub: e.target.checked })} />My class will need a substitute</label>
    <div className="row">
     <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Send the request'}</button>
     <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>Never mind</button>
    </div>
   </form>}
  <style jsx>{`
   h2{margin:0 0 6px}
   form{display:flex;flex-direction:column;gap:12px;margin-top:14px}
   .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
   label{display:flex;flex-direction:column;gap:5px;font-weight:700;font-size:15px}
   label small{font-weight:400;color:var(--vic-text-secondary)}
   label.check{flex-direction:row;align-items:center;gap:8px;font-weight:600}
   input,select{padding:10px 12px;border-radius:10px;border:1px solid var(--vic-field-border);font-size:16px;font-family:var(--font-body);background:var(--vic-surface);color:var(--vic-text-primary)}
   .row{display:flex;gap:10px;flex-wrap:wrap}
   .list{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
   .list li{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 14px;border-radius:11px;background:var(--vic-surface-muted);font-size:15px}
   .list.quiet li{background:transparent;border:1px solid var(--vic-border-soft);color:var(--vic-text-secondary)}
   .list em{font-style:normal;font-weight:700}
   .linkish{background:none;border:0;padding:0;font:inherit;font-weight:800;color:var(--vic-primary);cursor:pointer;text-decoration:underline}
  `}</style>
 </section>
}
