import Head from 'next/head'
import { useEffect, useMemo, useState } from 'react'
import VICHeader from '../../components/VICHeader'
import { supabase } from '../../lib/supabase'
import { groupByGrade, NO_CLASS, NO_GRADE } from '../../lib/grades.mjs'

// "What is Johnny's username?" and "he's forgotten his password" answered in one place,
// sorted by grade, because a thousand children in one alphabetical list is unusable.

async function api(path, body) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/school-login?next=/school/students'); throw new Error('Please sign in.') }
 const r = await fetch(path, {
  method: body ? 'POST' : 'GET',
  headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
 })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}
const csvCell = v => /[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? '')

export default function Students() {
 const [schoolId, setSchoolId] = useState('')
 const [rows, setRows] = useState(null)
 const [error, setError] = useState(''), [find, setFind] = useState(''), [only, setOnly] = useState('')
 const [busy, setBusy] = useState(0), [fresh, setFresh] = useState(null), [shut, setShut] = useState({})
 const [snagsOnly, setSnagsOnly] = useState(false)
 const [sheet, setSheet] = useState(null)   // a whole group's new passwords, to print once

 useEffect(() => {
  api('/api/school/attendance', {}).then(d => {
   const first = d.schools?.[0]
   if (!first) throw new Error('No school found on your account.')
   setSchoolId(first.id)
   return api(`/api/school/students?schoolId=${encodeURIComponent(first.id)}`)
  }).then(d => setRows(d.students)).catch(e => setError(e.message))
 }, [])

 const groups = useMemo(() => {
  const q = find.trim().toLowerCase()
  const kept = (rows || []).filter(s =>
   (!q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q)) &&
   (!snagsOnly || !s.allSet))
  return groupByGrade(kept).filter(g => !only || g.grade === only)
 }, [rows, find, only, snagsOnly])

 const allGrades = useMemo(() => groupByGrade(rows || []).map(g => g.grade), [rows])
 const total = useMemo(() => groups.reduce((n, g) => n + g.students.length, 0), [groups])
 const notReady = useMemo(() => (rows || []).filter(s => !s.allSet).length, [rows])

 async function reset(s) {
  if (!window.confirm(`Give ${s.name || s.username} a new password? Their old one stops working straight away.`)) return
  setBusy(s.id); setError(''); setFresh(null)
  try { setFresh(await api('/api/school/students', { schoolId, action: 'reset_password', studentId: s.id })) }
  catch (e) { setError(e.message) } finally { setBusy(0) }
 }

 // One touch for a whole year group. The teacher prints the sheet, cuts the cards up and
 // tapes them inside desks -- the passwords live in her classroom, not in a lookup screen.
 async function resetGroup(g) {
  if (!window.confirm(`Give all ${g.students.length} children in ${g.grade} new passwords?\n\nEvery old password stops working straight away, so only do this when you can hand out the new ones. You will get a sheet to print.`)) return
  setBusy(-1); setError(''); setFresh(null); setSheet(null)
  try {
   const r = await api('/api/school/students', { schoolId, action: 'reset_many', studentIds: g.students.map(s => s.id) })
   setSheet({ grade: g.grade, cards: r.cards })
  } catch (e) { setError(e.message) } finally { setBusy(0) }
 }

 function download() {
  const head = ['Grade', 'Student', 'Username', 'Classes', 'Teachers', 'Parent email']
  const body = groups.flatMap(g => g.students.map(s => [g.grade, s.name, s.username, s.classes.map(c => c.name).join('; '), [...new Set(s.classes.map(c => c.teacher).filter(Boolean))].join('; '), s.parentEmail]))
  const csv = [head, ...body].map(r => r.map(csvCell).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'askvic-student-logins.csv'
  a.click()
  URL.revokeObjectURL(a.href)
 }

 return <div className="st">
  <Head><title>Student logins | AskVic</title></Head>
  <div className="wrap"><VICHeader currentPath="/school/students" /></div>
  <main>
   <p className="kicker">Students &amp; classes</p>
   <h1>Student logins</h1>
   <p className="lede">By grade. Children sign in at <strong>askvic.ai</strong> with the username below and the password you gave them — no email address, no @ sign.</p>

   <details className="why">
    <summary>What has to be true before a child can do anything</summary>
    <p>Three things — and if any one is missing the child opens AskVic to the same empty screen, which is why “it isn’t working” is so hard to pin down.</p>
    <ol>
     <li><strong>A login</strong> — their username and password exist.</li>
     <li><strong>A class</strong> — they are on a teacher’s roster.</li>
     <li><strong>Work waiting</strong> — that teacher has actually assigned them a lesson. This is the one that gets missed: a child can have the first two and still see nothing.</li>
    </ol>
   </details>

   <details className="why">
    <summary>Why can’t I see their passwords?</summary>
    <p>Nobody can, including us: only a scrambled version is stored, which is what stops anyone reading a child’s password out of the database. If a child forgets theirs, use <strong>New password</strong> beside their name — you get a fresh one on screen to hand them, like <code>happy-tiger-47</code>.</p>
    <p>When you upload a roster you choose the starting passwords yourself, so that spreadsheet is your own copy of them. Keep it somewhere safe.</p>
   </details>

   {error && <p className="alert" role="alert">{error}</p>}
   {!rows && !error && <p role="status">Loading your students…</p>}

   {sheet && <section className="sheet">
    <div className="shead">
     <div>
      <h2>{sheet.grade} — new passwords</h2>
      <p>Print this now. It is the only time these are shown, and the old ones have already stopped working.</p>
     </div>
     <div className="sbtns">
      <button type="button" className="btn" onClick={() => window.print()}>Print</button>
      <button type="button" className="btn tiny" onClick={() => setSheet(null)}>Close</button>
     </div>
    </div>
    <div className="cards">{sheet.cards.map(c => <div key={c.id} className={`card${c.error ? ' bad' : ''}`}>
     <p className="cname">{c.name || c.username}</p>
     {c.error ? <p className="cerr">{c.error}</p> : <>
      <p className="crow"><span>username</span><code>{c.username}</code></p>
      <p className="crow"><span>password</span><code>{c.password}</code></p>
     </>}
    </div>)}</div>
    <p className="snote">Sign in at <strong>askvic.ai</strong> → Student log in. Type the username, no @ sign.</p>
   </section>}

   {fresh && <div className="fresh" role="status">
    <p><strong>{fresh.name || fresh.username} has a new password.</strong> Write it down now — this is the only time it is shown.</p>
    <p className="creds"><span>Username</span><code>{fresh.username}</code><span>Password</span><code>{fresh.password}</code></p>
    <button type="button" className="btn sm" onClick={() => setFresh(null)}>Done</button>
   </div>}

   {rows && <>
    <div className="bar">
     <label>Find a student<input value={find} onChange={e => setFind(e.target.value)} placeholder="Name or username" /></label>
     <label>Grade<select value={only} onChange={e => setOnly(e.target.value)}><option value="">All grades</option>{allGrades.map(g => <option key={g} value={g}>{g}</option>)}</select></label>
     <button type="button" className="btn" onClick={download} disabled={!total}>Download as CSV</button>
    </div>
    <label className="snags"><input type="checkbox" checked={snagsOnly} onChange={e => setSnagsOnly(e.target.checked)} /> Only show children who can’t do anything yet{notReady ? ` (${notReady})` : ''}</label>
    <p className="count">{total} {total === 1 ? 'student' : 'students'} in {groups.length} {groups.length === 1 ? 'group' : 'groups'}{notReady ? ` · ${notReady} cannot do anything yet` : ' · everyone is set up'}</p>

    {groups.map(g => <section key={g.grade} className={`grade${g.grade === NO_CLASS || g.grade === NO_GRADE ? ' odd' : ''}`}>
     <button type="button" className="ghead" aria-expanded={!shut[g.grade]} onClick={() => setShut(v => ({ ...v, [g.grade]: !v[g.grade] }))}>
      <span className="gname">{g.grade}</span>
      <span className="gnum">{g.students.length}</span>
      <span className="gcaret" aria-hidden="true">{shut[g.grade] ? '▸' : '▾'}</span>
     </button>
     {!shut[g.grade] && <div className="gtools">
      <button type="button" className="btn tiny" disabled={busy !== 0} onClick={() => resetGroup(g)}>New passwords for all {g.students.length} →  one printable sheet</button>
     </div>}
     {!shut[g.grade] && <div className="tablewrap"><table>
      <thead><tr><th>Student</th><th>Username</th><th>Ready?</th><th>Classes</th><th><span className="sr">Password</span></th></tr></thead>
      <tbody>{g.students.map(s => <tr key={s.id}>
       <td>{s.name || <em>Unnamed</em>}</td>
       <td className="user">{s.username}</td>
       <td className="rdy">{s.allSet
        ? <span className="all">✓ Ready</span>
        : <span className="miss">Needs {[!s.ready.login && 'a login', !s.ready.inClass && 'a class', !s.ready.hasWork && 'work assigned'].filter(Boolean).join(', ')}</span>}</td>
       <td className="cls">{s.classes.length ? s.classes.map(c => `${c.name}${c.teacher ? ` (${c.teacher})` : ''}`).join(', ') : <span className="none">Not in a class yet</span>}</td>
       <td><button type="button" className="btn tiny" disabled={busy === s.id} onClick={() => reset(s)}>{busy === s.id ? 'Working…' : 'New password'}</button></td>
      </tr>)}</tbody>
     </table></div>}
    </section>)}

    {!total && <p className="none">{snagsOnly ? 'Every child is set up. Nothing to fix.' : 'Nobody matches that.'}</p>}
    <p className="note">Adding a whole class at once is on <a href="/admin/import-roster">Upload a roster</a>. Classes and who is in them are on <a href="/admin/classrooms">Classrooms</a>.</p>
   </>}
  </main>

  <style jsx>{`
   .st{min-height:100vh;background:var(--vic-bg);color:var(--vic-text-primary)}
   .wrap,main{max-width:1060px;margin:0 auto;padding:0 20px}
   main{padding-bottom:72px}
   .kicker{font-family:var(--font-mono);text-transform:uppercase;font-size:14px;letter-spacing:.04em;color:var(--vic-primary);margin:22px 0 0}
   h1{font-size:clamp(30px,4.4vw,42px);margin:6px 0 10px}
   .lede{font-size:19px;line-height:1.6;color:var(--vic-text-secondary);max-width:70ch;margin:0 0 16px}
   .why{margin:0 0 20px;padding:14px 18px;background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:14px}
   .why summary{font-weight:800;cursor:pointer}
   .why p{line-height:1.6;margin:12px 0 0;max-width:72ch}
   .why code,.creds code{font-family:var(--font-mono);background:var(--vic-surface-muted);padding:3px 8px;border-radius:7px}
   .bar{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px}
   label{display:grid;gap:6px;font-weight:700;font-size:15px}
   input,select{font:inherit;padding:11px 12px;border:2px solid var(--vic-field-border);border-radius:10px;background:var(--vic-surface);min-width:210px}
   .btn{min-height:48px;padding:12px 18px;border-radius:11px;border:0;background:var(--vic-primary);color:#fff;font-weight:800;font-size:16px;cursor:pointer}
   .btn.sm{min-height:42px;font-size:15px}
   .btn.tiny{min-height:40px;padding:9px 13px;font-size:14px;background:var(--vic-surface);color:var(--vic-text-primary);border:2px solid var(--vic-field-border)}
   .btn:disabled{opacity:.5;cursor:default}
   .count{color:var(--vic-text-secondary);margin:0 0 14px}
   .snags{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;margin:0 0 12px;cursor:pointer}
   .snags input{width:22px;height:22px}
   .why ol{margin:12px 0 0;padding-left:24px;line-height:1.7;max-width:72ch}
   .why li{margin:5px 0}
   .rdy{white-space:nowrap;font-size:15px}
   .rdy .all{color:var(--vic-success);font-weight:800}
   .rdy .miss{color:var(--vic-warning);font-weight:700}
   .grade{margin:0 0 14px;background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:16px;overflow:hidden;box-shadow:var(--vic-shadow-soft)}
   .grade.odd{border-style:dashed}
   .ghead{display:flex;align-items:center;gap:12px;width:100%;padding:14px 18px;background:var(--vic-surface-muted);border:0;cursor:pointer;text-align:left;font:inherit}
   .gname{font-weight:800;font-size:19px;flex:1}
   .gnum{font-family:var(--font-mono);font-size:14px;background:var(--vic-ink);color:#fff;padding:3px 10px;border-radius:999px}
   .gcaret{color:var(--vic-text-secondary)}
   .tablewrap{overflow:auto}
   table{width:100%;border-collapse:collapse;font-size:16px}
   th,td{text-align:left;padding:12px 18px;border-top:1px solid var(--vic-border-soft);vertical-align:middle}
   th{font-family:var(--font-mono);text-transform:uppercase;font-size:12px;letter-spacing:.04em;color:var(--vic-text-secondary)}
   .user{font-family:var(--font-mono);font-weight:700;white-space:nowrap}
   .cls{color:var(--vic-text-secondary);font-size:15px}
   .none{color:var(--vic-text-muted)}
   .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
   .fresh{margin:0 0 18px;padding:18px 20px;border-radius:14px;background:var(--vic-success-soft);border:2px solid var(--vic-success)}
   .fresh p{margin:0 0 10px;line-height:1.6}
   .creds{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:15px}
   .creds span{font-family:var(--font-mono);text-transform:uppercase;font-size:12px;color:var(--vic-text-secondary)}
   .creds code{font-size:18px;font-weight:700}
   .alert{padding:14px 16px;border-radius:12px;background:var(--vic-danger-soft);color:#912018;font-weight:700}
   .note{margin-top:20px;color:var(--vic-text-secondary);line-height:1.6}
   .gtools{padding:12px 18px;border-top:1px solid var(--vic-border-soft);background:var(--vic-surface)}
   .sheet{margin:0 0 20px;padding:20px;border:3px solid var(--vic-success);border-radius:16px;background:var(--vic-surface)}
   .shead{display:flex;gap:18px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
   .shead h2{margin:0 0 6px;font-size:24px}
   .shead p{margin:0;color:var(--vic-text-secondary);line-height:1.6;max-width:56ch}
   .sbtns{display:flex;gap:10px;flex:none}
   .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin:18px 0 0}
   .card{padding:14px 16px;border:2px dashed var(--vic-border);border-radius:12px}
   .card.bad{border-color:var(--vic-danger)}
   .cname{margin:0 0 8px;font-weight:800;font-size:18px}
   .crow{display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:15px}
   .crow span{font-family:var(--font-mono);font-size:11px;text-transform:uppercase;color:var(--vic-text-secondary);min-width:68px}
   .crow code{font-family:var(--font-mono);font-size:17px;font-weight:700}
   .cerr{margin:0;color:var(--vic-danger);font-weight:700;font-size:15px}
   .snote{margin:16px 0 0;color:var(--vic-text-secondary)}
   @media print{
    .wrap,.bar,.why,.snags,.count,.grade,.note,.sbtns,.fresh{display:none !important}
    .sheet{border:0;padding:0;margin:0}
    .cards{grid-template-columns:repeat(3,1fr)}
    .card{border:1px dashed #999;break-inside:avoid}
   }
  `}</style>
 </div>
}
