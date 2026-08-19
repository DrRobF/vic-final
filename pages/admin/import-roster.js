import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import VICHeader from '../../components/VICHeader'
import { REQUIRED_ROSTER_FIELDS } from '../../lib/roster-import'

function parseCsv(text) {
  const records = []
  let record = [], field = '', quoted = false
  const source = String(text || '').replace(/^\uFEFF/, '')
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted && char === '"' && source[index + 1] === '"') { field += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === ',' && !quoted) { record.push(field); field = '' }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[index + 1] === '\n') index += 1
      record.push(field); field = ''
      if (record.some((value) => value.trim())) records.push(record)
      record = []
    } else field += char
  }
  if (quoted) throw new Error('The CSV contains an unclosed quoted field.')
  record.push(field)
  if (record.some((value) => value.trim())) records.push(record)
  if (records.length < 2) throw new Error('The CSV must include a header and at least one student row.')
  const headers = records[0].map((header) => header.trim())
  const missing = REQUIRED_ROSTER_FIELDS.filter((required) => !headers.includes(required))
  if (missing.length) throw new Error(`Missing required column(s): ${missing.join(', ')}`)
  return records.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

async function authorizedRequest(body) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Please sign in as the roster administrator.')
  const response = await fetch('/api/admin/import-roster', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'The roster request failed.')
  return payload
}

function downloadFailures(results) {
  const quote = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const failures = results.filter((row) => ['failed', 'skipped'].includes(row.status))
  const csv = [['CSV row', 'Username', 'System login email', 'Status', 'Error'], ...failures.map((row) => [row.rowNumber, row.username, row.email, row.status, row.error])]
    .map((line) => line.map(quote).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = 'ask-vic-roster-errors.csv'; link.click()
  URL.revokeObjectURL(url)
}

export default function ImportRosterPage() {
  const router = useRouter()
  const [access, setAccess] = useState('checking')
  const [rows, setRows] = useState([])
  const [preview, setPreview] = useState(null)
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    authorizedRequest({ mode: 'preview', rows: [] })
      .catch((requestError) => {
        if (/does not contain any student rows/.test(requestError.message)) setAccess('allowed')
        else { setAccess('denied'); setError(requestError.message); setTimeout(() => router.replace('/login'), 1600) }
      })
  }, [router])

  const failures = useMemo(() => results?.results?.filter((row) => ['failed', 'skipped'].includes(row.status)) || [], [results])

  async function chooseFile(event) {
    setError(''); setPreview(null); setResults(null)
    try {
      const file = event.target.files?.[0]
      if (!file) return
      if (file.size > 2_000_000) throw new Error('Choose a CSV smaller than 2 MB.')
      const parsed = parseCsv(await file.text())
      setBusy(true)
      const nextPreview = await authorizedRequest({ mode: 'preview', rows: parsed })
      setRows(parsed); setPreview(nextPreview)
    } catch (fileError) { setRows([]); setError(fileError.message) }
    finally { setBusy(false); event.target.value = '' }
  }

  async function confirmImport() {
    if (!preview?.summary?.valid || busy) return
    setBusy(true); setError('')
    try {
      const outcome = await authorizedRequest({ mode: 'import', rows })
      setResults(outcome); setRows([]); setPreview(null)
    } catch (requestError) { setError(requestError.message) }
    finally { setBusy(false) }
  }

  if (access !== 'allowed') return <main className="shell"><p>{access === 'checking' ? 'Verifying administrator access…' : error}</p><style jsx>{`.shell{padding:48px;font:16px system-ui;color:#242a38}`}</style></main>

  return <main className="page"><Head><title>Student Roster Import | Ask VIC</title></Head><div className="shell"><VICHeader currentPath="/admin/import-roster" />
    <header><p className="eyebrow">Import Student Roster</p><h1>Student Roster Import</h1><p>Validate student accounts and class enrollments before making any changes.</p></header>
    <section className="card">
      {!results && <><h2>1. Select the student roster CSV</h2><p className="help">Required columns: {REQUIRED_ROSTER_FIELDS.join(', ')}. The file stays in this browser until you confirm.</p>
        <label className="picker">Choose student roster CSV<input type="file" accept=".csv,text/csv" onChange={chooseFile} disabled={busy} /></label></>}
      {busy && <p role="status">Working securely…</p>}{error && <p className="error" role="alert">{error}</p>}
    </section>
    {preview && <section className="card"><h2>2. Review and confirm</h2>
      <div className="counts"><strong>{preview.summary.total} rows</strong><span>{preview.summary.valid} ready</span><span>{preview.summary.skipped} skipped</span></div>
      <div className="tableWrap"><table><thead><tr><th>CSV row</th><th>Student</th><th>VIC login</th><th>Grade/classes</th><th>Validation</th></tr></thead><tbody>
        {preview.rows.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.name || '—'}</td><td>{row.email || '—'}</td><td>{row.grade || '—'}<small>{row.classCodes.join(', ')}</small></td><td className={row.valid ? 'ok' : 'bad'}>{row.valid ? 'Ready' : row.errors.join(' ')}</td></tr>)}
      </tbody></table></div><p className="privacy">Passwords are intentionally masked and will not appear in the results.</p>
      <button className="primary" onClick={confirmImport} disabled={busy || !preview.summary.valid}>Confirm and import {preview.summary.valid} students</button>
    </section>}
    {results && <section className="card"><h2>Import results</h2><div className="counts"><span>Created: {results.counts.created}</span><span>Already existing: {results.counts.alreadyExisting}</span><span>Updated: {results.counts.updated}</span><span>Skipped: {results.counts.skipped}</span><span>Failed: {results.counts.failed}</span></div>
      <div className="tableWrap"><table><thead><tr><th>CSV row</th><th>Username</th><th>System login email</th><th>Result</th><th>Details</th></tr></thead><tbody>{results.results.map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.username || '—'}</td><td>{row.email || '—'}</td><td>{row.status}</td><td>{row.error || 'Complete'}</td></tr>)}</tbody></table></div>
      {failures.length > 0 && <button onClick={() => downloadFailures(results.results)}>Download error CSV</button>} <button onClick={() => setResults(null)}>Import another roster</button>
    </section>}
  </div><style jsx>{`
    .page{min-height:100vh;background:var(--vic-bg);color:var(--vic-text-primary);padding:28px 16px 60px}.shell{max-width:1120px;margin:auto}header{padding:44px 4px 20px}h1{font-size:clamp(34px,5vw,52px);margin:3px 0 8px}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-weight:800;color:var(--vic-primary);font-size:12px}.card{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:16px;padding:24px;margin:18px 0;box-shadow:var(--vic-shadow-raised)}h2{margin-top:0}.help,.privacy,header p{color:var(--vic-text-secondary);line-height:1.5}.picker,button{display:inline-block;border:1px solid var(--vic-border-soft);border-radius:10px;padding:11px 16px;font-weight:700;background:var(--vic-surface-muted);cursor:pointer}.picker input{display:none}.primary{background:var(--vic-primary);color:white;margin-top:16px}.counts{display:flex;gap:12px;flex-wrap:wrap;margin:14px 0}.counts>*{background:var(--vic-surface-muted);border-radius:20px;padding:7px 12px}.tableWrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:11px;border-bottom:1px solid var(--vic-border-soft);vertical-align:top}small{display:block;color:var(--vic-text-secondary);margin-top:4px}.ok{color:#287a4d;font-weight:700}.bad,.error{color:var(--vic-danger)}button{margin:10px 8px 0 0}button:disabled{opacity:.55;cursor:not-allowed}
  `}</style></main>
}
