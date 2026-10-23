import Head from 'next/head'
import { useCallback, useEffect, useRef, useState } from 'react'
import { tidyCoverCode, COVER_CODE } from '../lib/cover.mjs'

// The screen for whoever is covering a class today. It is the first AskVic screen many of
// these adults will ever see, often at 7:30 with children arriving, so it asks for one code
// and then shows one button per class. No account, no menu, nothing to explore.
//
// The code is held in memory and in this tab only: close the tab and it is gone, which is
// the right lifetime for something printed on a slip and handed over for a day.
const KEY = 'askvic-cover-code'
const readCode = () => { try { return sessionStorage.getItem(KEY) || '' } catch { return '' } }
const saveCode = v => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY) } catch {} }

export default function Cover() {
 const [code, setCode] = useState(''), [typed, setTyped] = useState('')
 const [data, setData] = useState(null), [error, setError] = useState(''), [msg, setMsg] = useState('')
 const [busy, setBusy] = useState(''), [loading, setLoading] = useState(false)
 const timer = useRef(null)

 useEffect(() => { setCode(readCode()) }, [])

 const load = useCallback(async (withCode, { quiet = false } = {}) => {
  if (!withCode) return
  if (!quiet) setLoading(true)
  try {
   const r = await fetch('/api/cover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: withCode }) })
   const d = await r.json().catch(() => ({}))
   if (!r.ok) {
    // A code that is wrong, spent or for another day should not stay in the tab.
    if ([403, 404, 400].includes(r.status)) { saveCode(''); setCode(''); setData(null) }
    setError(d.error || 'That code is not working. Check it with the office.')
    return
   }
   setData(d); setError('')
  } catch { setError('Check the internet connection, then try again.') }
  finally { if (!quiet) setLoading(false) }
 }, [])

 useEffect(() => { if (code) load(code) }, [code, load])
 // Keeps "already on screens" honest if the teacher's own screen launches something too.
 useEffect(() => {
  if (!code) return
  clearInterval(timer.current)
  timer.current = setInterval(() => { if (document.visibilityState === 'visible') load(code, { quiet: true }) }, 30000)
  return () => clearInterval(timer.current)
 }, [code, load])

 function submitCode(e) {
  e.preventDefault()
  const c = tidyCoverCode(typed)
  if (!COVER_CODE.test(c)) { setError('The code on your slip has 8 letters and numbers.'); return }
  saveCode(c); setCode(c); setError(''); setTyped('')
 }
 async function launch(classId, lessonId, title) {
  setBusy(`${classId}:${lessonId}`); setMsg(''); setError('')
  try {
   const r = await fetch('/api/cover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, action: 'launch', classId, lessonId }) })
   const d = await r.json().catch(() => ({}))
   if (!r.ok) { setError(d.error || 'That did not go through. Try again.'); return }
   setMsg(`“${title}” is on ${d.launched === 1 ? 'the screen of 1 student' : `the screens of ${d.launched} students`}.`)
   await load(code, { quiet: true })
  } catch { setError('Check the internet connection, then try again.') }
  finally { setBusy('') }
 }
 function signOut() { saveCode(''); setCode(''); setData(null); setMsg(''); setError('') }

 const dayLabel = data?.day ? new Date(`${data.day}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : ''

 return <>
  <Head><title>Covering a class | AskVic</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
  <main>
   <h1>Covering a class</h1>
   {!code ? <section className="card">
    <p className="lead">Type the code from the slip the office gave you.</p>
    <form onSubmit={submitCode}>
     <label htmlFor="cover-code">Your code</label>
     <input id="cover-code" value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} autoComplete="off" autoCapitalize="characters" spellCheck="false" inputMode="text" maxLength={12} placeholder="ABCD2345" />
     <button className="go" type="submit">Open today’s lessons</button>
    </form>
    {error && <p className="bad" role="alert">{error}</p>}
   </section>
   : loading && !data ? <p role="status">Opening today’s lessons…</p>
   : !data ? <section className="card">{error && <p className="bad" role="alert">{error}</p>}<button className="go" onClick={signOut}>Try a different code</button></section>
   : <>
    <section className="who">
     <p><strong>{data.coveringName}</strong>{data.school ? ` · ${data.school}` : ''}</p>
     <p className="muted">{dayLabel}</p>
     {data.note && <p className="note">From the office: {data.note}</p>}
    </section>
    {msg && <p className="good" role="status">{msg}</p>}
    {error && <p className="bad" role="alert">{error}</p>}

    {!data.classes.length ? <section className="card"><p>There are no classes on this slip. Check with the office.</p></section>
     : data.classes.map(c => <section key={c.id} className="card">
      <h2>{c.name}</h2>
      <p className="muted">{c.teacher ? `${c.teacher}’s class` : 'This class'}{c.grade != null ? ` · Grade ${c.grade}` : ''}</p>
      {!c.lessons.length ? <p className="fallback"><strong>No lesson was planned for today.</strong> The children can still work with VIC on their own reading and math practice — they will find it when they log in. Nothing for you to start.</p>
       : c.lessons.map(l => <div key={l.lessonId} className="lesson">
        <div className="about">
         <strong>{l.title}</strong>
         {l.objective && <span className="obj">{l.objective}</span>}
        </div>
        {l.live ? <span className="on">✓ On their screens</span>
         : !l.ready ? <span className="notready">Not ready for VIC to teach. The children can use VIC for their own practice instead — ask the office if you need {c.teacher || 'the teacher'}.</span>
         : <button className="go" disabled={busy === `${c.id}:${l.lessonId}`} onClick={() => launch(c.id, l.lessonId, l.title)}>{busy === `${c.id}:${l.lessonId}` ? 'Starting…' : 'Start this lesson'}</button>}
       </div>)}
     </section>)}
    <p className="out"><button className="plain" onClick={signOut}>Finished — close this</button></p>
   </>}
  </main>
  <style jsx>{`
   main{max-width:760px;margin:0 auto;padding:24px 18px 64px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#15202b;line-height:1.6}
   h1{font-size:30px;margin:0 0 18px}
   h2{font-size:22px;margin:0 0 2px}
   .lead{font-size:18px}
   .card{background:#fff;border:2px solid #d8dee7;border-radius:16px;padding:22px;margin:0 0 16px}
   .who{background:#10213a;color:#fff;border-radius:16px;padding:18px 22px;margin:0 0 16px}
   .who p{margin:0}
   .who .muted{color:#b9c6da}
   .note{margin-top:10px !important;background:rgba(255,255,255,.12);padding:10px 12px;border-radius:10px}
   .muted{color:#5a6a7d}
   label{display:block;font-weight:800;margin:0 0 8px}
   input{display:block;width:100%;padding:16px;font-size:26px;letter-spacing:.18em;text-align:center;border:2px solid #b9c3d0;border-radius:12px;font-family:ui-monospace,monospace;text-transform:uppercase}
   .go{margin-top:14px;width:100%;min-height:56px;padding:14px 20px;border:0;border-radius:12px;background:#1d4ed8;color:#fff;font-size:18px;font-weight:800;cursor:pointer}
   .go:disabled{opacity:.6;cursor:wait}
   .lesson{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;border-top:2px solid #eef1f5;padding-top:14px;margin-top:14px}
   .lesson .go{width:auto;margin-top:0;flex-shrink:0}
   .about{display:flex;flex-direction:column;min-width:min(100%,240px)}
   .obj{color:#5a6a7d;font-size:15px}
   .on{color:#15607a;font-weight:800}
   .notready{color:#8a4b00;font-weight:700;max-width:420px}
   .fallback{background:#eef4fb;border-radius:12px;padding:14px 16px;margin:12px 0 0}
   .good{background:#e7f1fb;color:#15405f;font-weight:800;padding:14px 16px;border-radius:12px}
   .bad{background:#fbebeb;color:#8a1c13;font-weight:800;padding:14px 16px;border-radius:12px}
   .out{margin-top:26px;text-align:center}
   .plain{background:none;border:0;color:#1d4ed8;text-decoration:underline;font:inherit;cursor:pointer;padding:10px}
   @media(max-width:600px){h1{font-size:25px}.card{padding:17px}}
  `}</style>
 </>
}
