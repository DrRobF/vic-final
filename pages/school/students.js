import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import VICHeader from '../../components/VICHeader'
import { supabase } from '../../lib/supabase'

// "What is Johnny's username?" answered in one place, and downloadable.

async function get(path) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/school-login?next=/school/students'); throw new Error('Please sign in.') }
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}
async function post(body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch('/api/school/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load your school.')
 return d
}
const csvCell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '')

export default function Students() {
 const [rows, setRows] = useState(null), [error, setError] = useState(''), [find, setFind] = useState(''), [cls, setCls] = useState('')

 useEffect(() => {
  post({}).then(d => {
   const first = d.schools?.[0]
   if (!first) throw new Error('No school found on your account.')
   return get(`/api/school/students?schoolId=${encodeURIComponent(first.id)}`)
  }).then(d => setRows(d.students)).catch(e => setError(e.message))
 }, [])

 const classNames = useMemo(() => [...new Set((rows || []).flatMap(s => s.classes.map(c => c.name)))].sort(), [rows])
 const shown = useMemo(() => {
  const q = find.trim().toLowerCase()
  return (rows || []).filter(s =>
   (!q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)) &&
   (!cls || s.classes.some(c => c.name === cls)))
 }, [rows, find, cls])

 function download() {
  const head = ['Student', 'Username', 'Classes', 'Teachers', 'Parent email']
  const body = shown.map(s => [s.name, s.username, s.classes.map(c => c.name).join('; '), [...new Set(s.classes.map(c => c.teacher).filter(Boolean))].join('; '), s.parentEmail])
  const csv = [head, ...body].map(r => r.map(csvCell).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'askvic-student-logins.csv'
  a.click()
  URL.revokeObjectURL(a.href)
 }

 const noClass = (rows || []).filter(s => !s.classes.length).length

 return <div className="st">
  <Head><title>Student logins | AskVic</title></Head>
  <div className="wrap"><VICHeader currentPath="/school/students" /></div>
  <main>
   <p className="kicker">Students &amp; classes</p>
   <h1>Student logins</h1>
   <p className="lede">Every student, the username they sign in with, and whose class they are in. Students sign in at <strong>askvic.ai</strong> with their username and the password you gave them.</p>

   {error && <p className="alert" role="alert">{error}</p>}
   {!rows && !error && <p role="status">Loading your students…</p>}

   {rows && <>
    <div className="bar">
     <label>Find a student<input value={find} onChange={e => setFind(e.target.value)} placeholder="Name or username" /></label>
     <label>Class<select value={cls} onChange={e => setCls(e.target.value)}><option value="">All classes</option>{classNames.map(n => <option key={n} value={n}>{n}</option>)}</select></label>
     <button type="button" className="btn" onClick={download} disabled={!shown.length}>Download {shown.length === rows.length ? 'all' : 'these'} as CSV</button>
    </div>

    <p className="count">{shown.length} of {rows.length} students{noClass ? ` · ${noClass} not in any class yet` : ''}</p>

    <div className="tablewrap"><table>
     <thead><tr><th>Student</th><th>Username</th><th>Classes</th></tr></thead>
     <tbody>{shown.map(s => <tr key={s.id}>
      <td>{s.name || <em>Unnamed</em>}</td>
      <td className="user">{s.username}</td>
      <td>{s.classes.length ? s.classes.map(c => `${c.name}${c.teacher ? ` (${c.teacher})` : ''}`).join(', ') : <span className="none">Not in a class yet</span>}</td>
     </tr>)}</tbody>
    </table></div>
    {!shown.length && <p className="none">Nobody matches that.</p>}

    <p className="note">Forgotten password? Reset it under <a href="/admin/accounts">Logins &amp; passwords</a>. Adding a whole class at once is on <a href="/admin/import-roster">Upload a roster</a>.</p>
   </>}
  </main>

  <style jsx>{`
   .st{min-height:100vh;background:var(--vic-bg);color:var(--vic-text-primary)}
   .wrap,main{max-width:1060px;margin:0 auto;padding:0 20px}
   main{padding-bottom:72px}
   .kicker{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;letter-spacing:.04em;color:var(--vic-primary);margin:22px 0 0}
   h1{font-size:clamp(30px,4.4vw,42px);margin:6px 0 10px}
   .lede{font-size:19px;line-height:1.6;color:var(--vic-text-secondary);max-width:70ch;margin:0 0 22px}
   .bar{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:14px}
   label{display:grid;gap:6px;font-weight:700;font-size:15px}
   input,select{font:inherit;padding:11px 12px;border:2px solid var(--vic-field-border);border-radius:10px;background:var(--vic-surface);min-width:220px}
   .btn{min-height:48px;padding:12px 18px;border-radius:11px;border:0;background:var(--vic-primary);color:#fff;font-weight:800;font-size:16px;cursor:pointer}
   .btn:disabled{opacity:.5;cursor:default}
   .count{color:var(--vic-text-secondary);margin:0 0 10px}
   .tablewrap{overflow:auto;background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:16px;box-shadow:var(--vic-shadow-soft)}
   table{width:100%;border-collapse:collapse;font-size:16px}
   th,td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--vic-border-soft);vertical-align:top}
   th{font-family:var(--font-mono);text-transform:uppercase;font-size:13px;letter-spacing:.04em;color:var(--vic-text-secondary);background:var(--vic-surface-muted)}
   tr:last-child td{border-bottom:0}
   .user{font-family:var(--font-mono);font-weight:700}
   .none{color:var(--vic-text-muted)}
   .alert{padding:14px 16px;border-radius:12px;background:var(--vic-danger-soft);color:#912018;font-weight:700}
   .note{margin-top:20px;color:var(--vic-text-secondary);line-height:1.6}
  `}</style>
 </div>
}
