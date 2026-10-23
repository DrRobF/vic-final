import { useCallback, useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import { useAccount } from '../../lib/use-account'
import { supabase } from '../../lib/supabase'

async function api(path) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token}` } })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Could not load cover.')
 return d
}
async function post(body) {
 const { data: { session } } = await supabase.auth.getSession()
 const r = await fetch('/api/school/cover', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'That didn’t go through.')
 return d
}
const fmt = iso => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''

// Handing a day's lessons to whoever is covering a class.
//
// The slip is the whole idea: a name, a day, the classes, and a code the covering adult types
// at askvic.ai/cover. It works for a teacher down the hall and for a sub nobody has met,
// because it needs no account and nothing set up in advance.
export default function CoverPage() {
 const { account, error: accountError } = useAccount({ next: '/school/cover' })
 const [schools, setSchools] = useState(null), [schoolId, setSchoolId] = useState('')
 const [data, setData] = useState(null), [error, setError] = useState(''), [made, setMade] = useState(null)
 const [day, setDay] = useState(''), [who, setWho] = useState(''), [note, setNote] = useState('')
 const [picked, setPicked] = useState([]), [busy, setBusy] = useState(false), [revoking, setRevoking] = useState('')

 useEffect(() => {
  if (!account) return
  if (!account.leader) { window.location.replace('/teach'); return }
  api('/api/assistantprincipal/lessonplans').then(d => { setSchools(d.schools || []); setSchoolId(d.schools?.[0]?.id || '') }).catch(e => { setSchools([]); setError(e.message) })
 }, [account])

 const load = useCallback(() => {
  if (!schoolId) return
  api(`/api/school/cover?schoolId=${encodeURIComponent(schoolId)}`).then(d => { setData(d); setDay(p => p || d.today) }).catch(e => setError(e.message))
 }, [schoolId])
 useEffect(() => { setData(null); load() }, [schoolId, load])

 function toggle(id) { setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) }
 // Picking a teacher selects every class of theirs; the name of who is covering is separate.
 function coverFor(t) { setPicked(t.classIds) }

 async function create(e) {
  e.preventDefault(); setBusy(true); setError(''); setMade(null)
  try {
   const d = await post({ schoolId, action: 'create', day, classIds: picked, coveringName: who, note })
   setMade(d.grant); setPicked([]); setWho(''); setNote(''); load()
  } catch (e) { setError(e.message) } finally { setBusy(false) }
 }
 async function revoke(id) {
  setRevoking(id); setError('')
  try { await post({ schoolId, action: 'revoke', grantId: id }); load() }
  catch (e) { setError(e.message) } finally { setRevoking('') }
 }

 const classes = data?.classes || []
 const nameOf = id => classes.find(c => Number(c.id) === Number(id))?.name || `Class ${id}`

 return <PageShell title="Cover a class" currentPath="/school/cover">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p>
   : !account || schools === null ? <p role="status">Opening cover…</p>
   : <>
    <header className="top">
     <div>
      <p className="label">Sub coverage</p>
      <h1>Cover a class</h1>
      <p className="muted">Hand one day’s lessons to whoever is covering. They type the code at <strong>askvic.ai/cover</strong> — no account needed.</p>
     </div>
     {schools.length > 1 && <label className="pick">School <select value={schoolId} onChange={e => setSchoolId(e.target.value)}>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
    </header>
    {error && <p className="alert" role="alert">{error}</p>}

    {made && <section className="panel slip" aria-label="The cover slip">
     <p className="label">Give this to {made.coveringName}</p>
     <p className="code">{made.code}</p>
     <p>Go to <strong>askvic.ai/cover</strong> and type this code.</p>
     <p className="muted">{fmt(made.day)} · {made.classIds.map(nameOf).join(' · ')}</p>
     <p className="muted small">The code works today only and shows nothing but the lessons for these classes.</p>
     <div className="row noprint"><button type="button" className="btn btn-primary" onClick={() => window.print()}>Print this slip</button><button type="button" className="btn btn-outline" onClick={() => setMade(null)}>Done</button></div>
    </section>}

    {!data ? <p role="status">Loading your classes…</p> : <>
     <section className="panel" aria-label="Make a cover slip">
      <h2>Make a slip</h2>
      {!classes.length ? <p className="muted">No classes can be covered yet. A class can be covered once AskVic knows which staff member teaches it.</p> : <form onSubmit={create}>
       {!!data.teachers?.length && <>
        <p className="label">Covering for</p>
        <div className="chips">{data.teachers.map(t => <button type="button" key={t.staffId || t.name} className={`chip ${t.classIds.every(i => picked.includes(i)) && t.classIds.length ? 'on' : ''}`} onClick={() => coverFor(t)}>{t.name}<span className="n">{t.classIds.length}</span></button>)}</div>
        <p className="muted small">Picks all of that teacher’s classes. Or choose classes one at a time below — one class is one period.</p>
       </>}

       <p className="label">Classes</p>
       <ul className="classes">{classes.map(c => <li key={c.id}>
        <label><input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} /><span><strong>{c.name}</strong><span className="muted"> · {c.teacher}</span>{!c.plannedToday.length ? <em className="muted"> — nothing planned today</em> : c.plannedToday.some(p => !p.ready) ? <em className="warnish"> — today’s lesson needs a standard and objective</em> : <em className="muted"> — “{c.plannedToday[0].title}” ready</em>}</span></label>
       </li>)}</ul>

       <div className="fields">
        <label>Day<input type="date" required value={day} min={data.today} onChange={e => setDay(e.target.value)} /></label>
        <label>Who is covering<input required value={who} onChange={e => setWho(e.target.value)} placeholder="Amber Manuel, or the agency’s name" maxLength={120} /></label>
       </div>
       <label>Note for them (optional)<input value={note} onChange={e => setNote(e.target.value)} placeholder="Short day — assembly at 1pm" maxLength={300} /></label>
       <button className="btn btn-primary" disabled={busy || !picked.length}>{busy ? 'Making the slip…' : 'Make the slip'}</button>
       {!picked.length && <p className="muted small">Choose at least one class.</p>}
      </form>}
     </section>

     <section className="panel" aria-label="Cover slips">
      <h2>Slips for today and later</h2>
      {!data.grants.length ? <p className="muted">No slips yet.</p> : <ul className="grants">{data.grants.map(g => <li key={g.id} className={g.revoked ? 'dim' : ''}>
       <span>
        <strong>{g.coveringName}</strong> · {fmt(g.day)}
        <span className="muted"> · {g.classIds.map(nameOf).join(', ')}</span>
        <span className="state">{g.revoked ? 'Taken back' : g.opened ? 'Opened' : 'Not opened yet'}</span>
        {g.note && <em className="muted"> — {g.note}</em>}
       </span>
       <span className="row">
        {!g.revoked && <><code className="small-code">{g.code}</code>
         <button type="button" className="btn btn-outline sm" disabled={revoking === g.id} onClick={() => revoke(g.id)}>{revoking === g.id ? '…' : 'Take it back'}</button></>}
       </span>
      </li>)}</ul>}
     </section>
    </>}
   </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:12px}
   h1{margin:4px 0 6px;font-size:clamp(26px,3vw,34px)}
   h2{margin:0 0 12px}
   .pick select{min-height:44px;border-radius:10px;padding:0 10px;font:inherit;margin-left:8px}
   .slip{border:2px solid var(--vic-primary)}
   .code{font-family:var(--font-mono);font-size:clamp(38px,8vw,60px);letter-spacing:.16em;margin:6px 0 10px;font-weight:800}
   .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
   .chips{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 6px}
   .chip{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border-radius:999px;border:2px solid var(--vic-border);background:var(--vic-surface);font:inherit;font-weight:700;cursor:pointer}
   .chip.on{border-color:var(--vic-primary);background:var(--vic-primary);color:#fff}
   .chip .n{font-size:13px;opacity:.75}
   .classes{list-style:none;padding:0;margin:0 0 18px}
   .classes li{border-top:1px solid var(--vic-border-soft);padding:10px 0}
   .classes label{display:flex;gap:12px;align-items:flex-start;font-weight:400;cursor:pointer}
   .classes input{margin-top:5px;width:20px;height:20px;flex-shrink:0}
   .warnish{color:#8a4b00;font-style:normal;font-weight:700}
   .fields{display:grid;grid-template-columns:1fr 1fr;gap:14px}
   label{display:block;font-weight:800;margin:0 0 14px}
   input:not([type=checkbox]){display:block;width:100%;margin-top:6px;padding:12px;border:1px solid var(--vic-border);border-radius:10px;font:inherit;background:var(--vic-surface);color:var(--vic-text-primary)}
   .grants{list-style:none;padding:0;margin:0}
   .grants li{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center;border-top:1px solid var(--vic-border-soft);padding:12px 0}
   .grants li.dim{opacity:.55}
   .state{display:inline-block;margin-left:8px;padding:3px 10px;border-radius:999px;border:1px solid var(--vic-border);font-size:13px;font-weight:800}
   .small-code{font-family:var(--font-mono);font-size:19px;letter-spacing:.1em;font-weight:800}
   .sm{min-height:36px;padding:5px 12px;font-size:14px}
   .small{font-size:14px}
   @media(max-width:700px){.fields{grid-template-columns:1fr}}
   @media print{.noprint{display:none}}
  `}</style>
 </PageShell>
}
