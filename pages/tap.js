import Head from 'next/head'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Tap your name. No password.
//
// This is the student door on a classroom computer. A third grader forgets a password
// daily, so they do not get one: the teacher sets this computer up once, and after that
// children tap their own name and start work.
//
// The device remembers which class it belongs to, in this browser only. Clearing the
// browser's data unsets it, and the teacher can set it up again in ten seconds.

const KEY = 'askvic.classDevice'
const read = () => { try { return localStorage.getItem(KEY) || '' } catch { return '' } }
const save = t => { try { localStorage.setItem(KEY, t) } catch {} }
const forget = () => { try { localStorage.removeItem(KEY) } catch {} }

async function tap(body) {
 const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: {} }))
 const r = await fetch('/api/student/tap', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
  body: JSON.stringify(body),
 })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) { const e = new Error(d.error || 'Something went wrong.'); e.status = r.status; throw e }
 return d
}

export default function Tap() {
 const [token, setToken] = useState(null)       // null = still looking
 const [klass, setKlass] = useState('')
 const [kids, setKids] = useState(null)
 const [error, setError] = useState('')
 const [going, setGoing] = useState(0)

 // Teacher setup, only used when this computer has not been set up yet.
 const [who, setWho] = useState(null)
 const [classes, setClasses] = useState([])
 const [pick, setPick] = useState('')
 const [busy, setBusy] = useState(false)

 useEffect(() => { setToken(read()) }, [])

 useEffect(() => {
  if (token === null) return
  if (!token) { whoIsHere(); return }
  tap({ action: 'list', token })
   .then(d => { setKlass(d.className); setKids(d.students) })
   .catch(e => { if (e.status === 401) { forget(); setToken(''); whoIsHere() } else setError(e.message) })
 }, [token])

 // Is a teacher signed in on this computer right now? If so, offer to set it up.
 async function whoIsHere() {
  try {
   const { data: { session } } = await supabase.auth.getSession()
   if (!session) { setWho(false); return }
   const { data: rows } = await supabase.from('users').select('id,name,role').eq('auth_user_id', session.user.id).limit(1)
   const me = rows?.[0]
   if (String(me?.role || '').toLowerCase() !== 'teacher') { setWho(false); return }
   setWho(me)
   const { data: mine } = await supabase.from('classes').select('id,class_name').eq('teacher_id', me.id).order('class_name')
   setClasses(mine || [])
   if (mine?.length === 1) setPick(String(mine[0].id))
  } catch { setWho(false) }
 }

 async function setUp(e) {
  e.preventDefault(); setBusy(true); setError('')
  try {
   const d = await tap({ action: 'register', classId: Number(pick), label: navigator.platform || '' })
   save(d.token); setToken(d.token); setKids(null); setWho(null)
  } catch (e) { setError(e.message) } finally { setBusy(false) }
 }

 async function enter(kid) {
  setGoing(kid.id); setError('')
  try {
   const d = await tap({ action: 'enter', token, studentId: kid.id })
   const { error: vErr } = await supabase.auth.verifyOtp({ token_hash: d.tokenHash, type: 'magiclink' })
   if (vErr) throw new Error('Could not start your lesson. Tap your name again.')
   window.location.replace('/learn')
  } catch (e) { setError(e.message); setGoing(0) }
 }

 return <div className="tap">
  <Head><title>Tap your name | AskVic</title></Head>

  {/* ---- not set up, and a teacher is here: offer setup ---- */}
  {!token && who && <main className="setup">
   <p className="eyebrow">Set up this computer</p>
   <h1>Which class uses this computer?</h1>
   <p>Pick the class once. After that your students just tap their name — no passwords, nothing to type.</p>
   {!classes.length
    ? <p className="warn">You have no classes yet. Set one up first, then come back.</p>
    : <form onSubmit={setUp}>
      <label>Class
       <select value={pick} onChange={e => setPick(e.target.value)} required>
        <option value="">Choose a class…</option>
        {classes.map(c => <option key={c.id} value={c.id}>{c.class_name}</option>)}
       </select>
      </label>
      <button className="go" disabled={busy || !pick}>{busy ? 'Setting up…' : 'Use this computer for that class'}</button>
     </form>}
   {error && <p className="alert" role="alert">{error}</p>}
   <p className="small">Only this browser on this computer remembers it. Sign out afterwards — your students do not need your account.</p>
  </main>}

  {/* ---- not set up, nobody signed in ---- */}
  {!token && who === false && <main className="ask">
   <h1>Ask your teacher</h1>
   <p>This computer has not been set up for a class yet.</p>
   <p className="small">Teachers: sign in on this computer and come back to this page.</p>
   <a className="go" href="/login?next=/tap">Teacher sign in</a>
  </main>}

  {/* ---- set up: the names ---- */}
  {token && <main className="names">
   <header>
    <p className="eyebrow">{klass}</p>
    <h1>Tap your name</h1>
   </header>
   {error && <p className="alert" role="alert">{error}</p>}
   {!kids && !error && <p className="loading" role="status">Getting your class…</p>}
   {kids && !kids.length && <p className="loading">Nobody is in this class yet. Ask your teacher.</p>}
   {kids && !!kids.length && <ul className="grid">
    {kids.map(k => <li key={k.id}>
     <button type="button" disabled={!!going} onClick={() => enter(k)} className={going === k.id ? 'on' : ''}>
      <span className="initial" aria-hidden="true">{(k.name || '?').trim()[0]?.toUpperCase()}</span>
      <span className="kname">{k.name}</span>
      {going === k.id && <span className="sr">Starting…</span>}
     </button>
    </li>)}
   </ul>}
  </main>}

  {token === null && <main className="ask"><p className="loading" role="status">One moment…</p></main>}

  <style jsx>{`
   .tap{min-height:100vh;background:radial-gradient(900px 420px at 80% -10%,rgba(167,139,250,.28),transparent 60%),var(--vic-ink);color:var(--vic-ink-text);font-family:var(--font-read)}
   main{max-width:1100px;margin:0 auto;padding:40px 24px 72px}
   .eyebrow{font-family:var(--font-mono);text-transform:uppercase;font-size:15px;letter-spacing:.05em;color:var(--vic-vic-glow);margin:0 0 10px}
   h1{font-family:var(--font-read);font-size:clamp(34px,6vw,58px);line-height:1.05;margin:0 0 16px;color:#fff}
   p{font-size:20px;line-height:1.6;color:var(--vic-ink-muted);max-width:60ch}
   .small{font-size:17px}
   .loading{font-size:22px}
   .alert{padding:16px 18px;border-radius:14px;background:#fff;color:#912018;font-weight:800;max-width:60ch}
   .warn{color:#fff;font-weight:700}

   /* Names: big targets, three across on a Chromebook, two on a tablet. */
   .grid{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin:28px 0 0;padding:0}
   .grid button{display:flex;align-items:center;gap:18px;width:100%;min-height:104px;padding:18px 22px;border-radius:22px;border:4px solid transparent;background:#fff;color:var(--vic-ink);font-family:var(--font-read);font-size:26px;font-weight:800;text-align:left;cursor:pointer}
   .grid button:hover{border-color:var(--vic-vic-glow)}
   .grid button:focus-visible{outline:5px solid var(--vic-vic-glow);outline-offset:4px}
   .grid button.on{background:var(--vic-vic-glow);border-color:#fff}
   .grid button:disabled{opacity:.55;cursor:default}
   .initial{display:grid;place-items:center;width:62px;height:62px;border-radius:999px;background:var(--vic-vic);color:#fff;font-size:30px;flex:none}
   .kname{min-width:0;overflow-wrap:anywhere}

   form{margin:24px 0 18px;max-width:460px}
   label{display:grid;gap:8px;font-weight:800;font-size:18px;color:#fff}
   select{font:inherit;font-size:19px;padding:14px;border-radius:12px;border:3px solid var(--vic-ink-line);background:#fff;color:var(--vic-ink)}
   .go{display:inline-flex;align-items:center;justify-content:center;min-height:60px;margin-top:18px;padding:14px 26px;border:0;border-radius:14px;background:var(--vic-vic-glow);color:var(--vic-ink);font-family:var(--font-read);font-size:21px;font-weight:800;cursor:pointer;text-decoration:none}
   .go:disabled{opacity:.5;cursor:default}
   .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
   @media (max-width:560px){ .grid{grid-template-columns:1fr} }
  `}</style>
 </div>
}
