import Head from 'next/head'
import { useEffect, useState } from 'react'
import VICHeader from '../../components/VICHeader'
import { supabase } from '../../lib/supabase'
import { STAFF_CSV_HEADERS, staffCsvTemplate } from '../../lib/add-person.mjs'

// Add a whole staff list at once. A school arriving with sixty teachers is not typing
// them in one at a time. Runs the same add as the single form, so a person who is
// already on the board keeps their check-in code and their history.

function parseCsv(text) {
 const rows = []
 let row = [], field = '', quoted = false
 const src = String(text || '').replace(/^﻿/, '')
 for (let i = 0; i < src.length; i += 1) {
  const c = src[i]
  if (quoted && c === '"' && src[i + 1] === '"') { field += '"'; i += 1 }
  else if (c === '"') quoted = !quoted
  else if (c === ',' && !quoted) { row.push(field); field = '' }
  else if ((c === '\n' || c === '\r') && !quoted) {
   if (c === '\r' && src[i + 1] === '\n') i += 1
   row.push(field); field = ''
   if (row.some(v => v.trim())) rows.push(row)
   row = []
  } else field += c
 }
 if (quoted) throw new Error('The file has a quote that was never closed.')
 row.push(field)
 if (row.some(v => v.trim())) rows.push(row)
 if (!rows.length) throw new Error('That file looks empty.')

 const header = rows[0].map(h => h.trim())
 const missing = ['Name'].filter(h => !header.some(x => x.toLowerCase() === h.toLowerCase()))
 if (missing.length) throw new Error(`The first row has to name the columns. Missing: ${missing.join(', ')}. Download the template below.`)
 return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

async function post(body) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/school-login?next=/school/staff-upload'); throw new Error('Please sign in.') }
 const r = await fetch('/api/school/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}

export default function StaffUpload() {
 const [schoolId, setSchoolId] = useState('')
 const [schoolName, setSchoolName] = useState('')
 const [text, setText] = useState('')
 const [rows, setRows] = useState(null)
 const [preview, setPreview] = useState(null)
 const [results, setResults] = useState(null)
 const [busy, setBusy] = useState('')
 const [error, setError] = useState('')

 useEffect(() => {
  post({}).then(d => {
   const first = d.schools?.[0]
   if (!first) setError('No school found on your account.')
   else { setSchoolId(first.id); setSchoolName(first.name) }
  }).catch(e => setError(e.message))
 }, [])

 function read(value) {
  setText(value); setPreview(null); setResults(null); setError('')
  if (!value.trim()) { setRows(null); return }
  try { setRows(parseCsv(value)) } catch (e) { setRows(null); setError(e.message) }
 }

 const upload = e => {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => read(String(reader.result || ''))
  reader.onerror = () => setError('That file could not be read.')
  reader.readAsText(file)
 }

 function template() {
  const blob = new Blob([staffCsvTemplate()], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'askvic-staff-template.csv'
  a.click()
  URL.revokeObjectURL(a.href)
 }

 async function review() {
  setBusy('Checking your list…'); setError(''); setResults(null)
  try { setPreview((await post({ schoolId, action: 'add_people', mode: 'preview', rows })).preview) }
  catch (e) { setError(e.message) } finally { setBusy('') }
 }

 async function apply() {
  setBusy('Adding your staff…'); setError('')
  try { const d = await post({ schoolId, action: 'add_people', mode: 'apply', rows }); setResults(d); setPreview(null) }
  catch (e) { setError(e.message) } finally { setBusy('') }
 }

 return <div className="su">
  <Head><title>Upload your staff | AskVic</title></Head>
  <div className="wrap"><VICHeader currentPath="/school/staff-upload" /></div>
  <main>
   <p className="kicker">Setup</p>
   <h1>Upload your staff list</h1>
   <p className="lede">For a whole school at once. Everyone lands on your staff board; tick the columns for anyone who also needs an AskVic login or the school dashboard.{schoolName ? ` Adding to ${schoolName}.` : ''}</p>

   <section className="card">
    <h2>1. Start from the template</h2>
    <p>Seven columns. Only <strong>Name</strong> is required — leave the rest blank and they go on the board with nothing else.</p>
    <p className="cols">{STAFF_CSV_HEADERS.join(' · ')}</p>
    <button type="button" className="btn btn-outline" onClick={template}>Download the CSV template</button>
   </section>

   <section className="card">
    <h2>2. Add your file</h2>
    <label className="file">Choose a CSV<input type="file" accept=".csv,text/csv" onChange={upload} disabled={!!busy} /></label>
    <details><summary>Or paste it instead</summary>
     <label className="sr">Staff CSV<textarea value={text} onChange={e => read(e.target.value)} disabled={!!busy} placeholder={staffCsvTemplate()} /></label>
    </details>
    {rows && <p className="ok" role="status">Read {rows.length} {rows.length === 1 ? 'person' : 'people'}.</p>}
   </section>

   {error && <p className="alert" role="alert">{error}</p>}
   {busy && <p className="muted" role="status">{busy}</p>}

   {rows && !preview && !results && <button className="btn btn-primary" disabled={!!busy || !schoolId} onClick={review}>Check this list</button>}

   {preview && <section className="card">
    <h2>3. Check before anything is saved</h2>
    <p>Anyone already on your board keeps their check-in code and attendance — their record is used rather than a second one.</p>
    <ul className="rows">{preview.map((r, i) => <li key={i}>
     <strong>{r.name}</strong>
     <span className="e">{r.email || 'no email'}</span>
     <span className="tags">{r.role}{r.wantsLogin ? ' · AskVic login' : ''}{r.leader ? ' · dashboard' : ''}</span>
     <span className={r.outcome.startsWith('New') ? 'out new' : 'out same'}>{r.outcome}</span>
    </li>)}</ul>
    <div className="row">
     <button className="btn btn-primary" disabled={!!busy} onClick={apply}>Add these {preview.length} people</button>
     <button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => setPreview(null)}>Back</button>
    </div>
   </section>}

   {results && <section className="card">
    <h2>Done</h2>
    <p>{results.done} added or updated{results.failed ? `, ${results.failed} need another look` : ''}.</p>
    <ul className="rows">{results.results.map((r, i) => <li key={i}>
     <strong>{r.name}</strong>
     <span className={r.ok ? 'out same' : 'out bad'}>{r.ok ? r.message : r.error}</span>
    </li>)}</ul>
    <div className="row">
     <a className="btn btn-primary" href="/school">Back to the dashboard</a>
     <button type="button" className="btn btn-outline" onClick={() => { read(''); setResults(null) }}>Upload another list</button>
    </div>
   </section>}
  </main>

  <style jsx>{`
   .su{min-height:100vh;background:var(--vic-bg);color:var(--vic-text-primary)}
   .wrap,main{max-width:900px;margin:0 auto;padding:0 20px}
   main{padding-bottom:72px}
   .kicker{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;letter-spacing:.04em;color:var(--vic-primary);margin:22px 0 0}
   h1{font-size:clamp(30px,4.4vw,42px);margin:6px 0 10px}
   .lede{font-size:19px;line-height:1.6;color:var(--vic-text-secondary);max-width:68ch;margin:0 0 24px}
   .card{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:18px;padding:24px;margin:0 0 18px;box-shadow:var(--vic-shadow-soft)}
   .card h2{font-size:22px;margin:0 0 8px}
   .card p{line-height:1.6;margin:0 0 14px}
   .cols{font-family:var(--font-mono);font-size:14px;background:var(--vic-surface-muted);padding:12px 14px;border-radius:10px}
   .file{display:block;font-weight:700;margin-bottom:14px}
   .file input{display:block;margin-top:8px;font:inherit}
   details{margin-top:6px}
   summary{font-weight:700;cursor:pointer}
   textarea{width:100%;min-height:180px;margin-top:10px;padding:12px;font-family:var(--font-mono);font-size:14px;border:2px solid var(--vic-field-border);border-radius:10px;background:var(--vic-surface)}
   .sr{display:block;font-weight:700}
   .ok{color:var(--vic-success);font-weight:700;margin:12px 0 0}
   .alert{padding:14px 16px;border-radius:12px;background:var(--vic-danger-soft);color:#912018;font-weight:700}
   .muted{color:var(--vic-text-secondary)}
   .rows{list-style:none;margin:0 0 18px;padding:0}
   .rows li{display:grid;gap:3px;padding:12px 0;border-bottom:1px solid var(--vic-border-soft)}
   .rows .e,.rows .tags{font-size:15px;color:var(--vic-text-secondary)}
   .out{font-size:15px;font-weight:700}
   .out.new{color:var(--vic-primary)}
   .out.same{color:var(--vic-success)}
   .out.bad{color:var(--vic-danger)}
   .row{display:flex;gap:12px;flex-wrap:wrap}
   .btn{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:12px 20px;border-radius:12px;font-weight:800;font-size:17px;cursor:pointer;text-decoration:none;border:2px solid transparent}
   .btn-primary{background:var(--vic-primary);color:#fff}
   .btn-outline{background:var(--vic-surface);border-color:var(--vic-field-border);color:var(--vic-text-primary)}
   .btn:disabled{opacity:.5;cursor:default}
  `}</style>
 </div>
}
