import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import VICHeader from '../components/VICHeader'
import { supabase } from '../lib/supabase'

async function call(method, body) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace('/student-login'); throw new Error('Please log in.') }
 const r = await fetch('/api/student/today', { method, headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
 const d = await r.json().catch(() => ({}))
 if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.')
 return d
}
const firstName = name => String(name || '').trim().split(/\s+/)[0] || 'there'

// Student Today: two ways to learn the same goals — with my teacher (handouts + worksheet), or with VIC.
export default function Learn() {
 const [data, setData] = useState(null), [error, setError] = useState(''), [pick, setPick] = useState(0), [open, setOpen] = useState(false)
 useEffect(() => { call('GET').then(setData).catch(e => setError(e.message)) }, [])
 const lessons = data?.lessons || [], lesson = lessons[pick]
 const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

 function updateWork(lessonId, work) { setData(d => ({ ...d, lessons: d.lessons.map(l => l.lessonId === lessonId ? { ...l, work: { ...(l.work || {}), ...work } } : l) })) }

 return <div className="learn">
  <Head><title>Today | AskVic</title></Head>
  <div className="wrap"><VICHeader currentPath="/learn" /></div>
  <main>
   {error ? <p className="alert" role="alert">{error}</p> : !data ? <p role="status" className="big">Getting your lessons…</p> : <>
    <header>
     <p className="date">{today}</p>
     <h1>Hi, {firstName(data.name)}!</h1>
    </header>

    {!lessons.length ? <section className="card empty">
     <h2>No lessons from your teacher yet</h2>
     <p>You can still learn with VIC any time.</p>
     <a className="go vic" href="/askvic">Learn with VIC →</a>
    </section> : <>
     {lessons.length > 1 && <nav className="pick" aria-label="Your lessons">{lessons.slice(0, 6).map((l, i) => <button key={l.lessonId} type="button" aria-pressed={i === pick} className={i === pick ? 'on' : ''} onClick={() => { setPick(i); setOpen(false) }}>{l.title}{l.work?.status === 'turned_in' ? ' ✓' : ''}</button>)}</nav>}

     <section className="card lesson">
      <p className="tag">{lesson.className}{lesson.teacher ? ` · ${lesson.teacher}` : ''}</p>
      <h2>{lesson.title}</h2>
      {lesson.goals.length > 0 && <div className="goals"><p className="gl">Today I am learning to…</p><ul>{lesson.goals.map((g, i) => <li key={i}>{g}</li>)}</ul></div>}
     </section>

     <div className="tracks">
      <section className="track me">
       <p className="tl">With my teacher</p>
       <h3>Learn together</h3>
       <p>Use the handout your teacher gives you.{lesson.worksheet ? ' Your worksheet is right here, too.' : ''}</p>
       {lesson.worksheet ? <button type="button" className="go blue" aria-expanded={open} onClick={() => setOpen(!open)}>{lesson.work?.status === 'turned_in' ? '✓ Worksheet turned in' : open ? 'Hide my worksheet' : lesson.work ? 'Keep working on my worksheet' : 'Open my worksheet'}</button> : <p className="small">Your teacher will hand out today’s work.</p>}
      </section>
      <section className="track vic">
       <p className="tl">With VIC</p>
       <h3>Learn it a new way</h3>
       <p>VIC teaches you the same thing, one step at a time, just for you.</p>
       <a className="go vicbtn" href="/askvic">Start with VIC →</a>
      </section>
     </div>

     {open && lesson.worksheet && <Worksheet key={lesson.lessonId} lesson={lesson} onSaved={w => updateWork(lesson.lessonId, w)} />}
    </>}
   </>}
  </main>
  <style jsx>{`
   .learn{min-height:100vh;background:var(--vic-bg);font-family:var(--font-read);font-size:20px;color:var(--vic-text-primary)}
   .wrap{max-width:1100px;margin:0 auto;padding:16px 24px 0}
   main{max-width:1000px;margin:0 auto;padding:20px 24px 72px;display:flex;flex-direction:column;gap:22px}
   .date{margin:16px 0 4px;color:var(--vic-text-secondary);font-size:18px}
   h1{font-family:var(--font-read);font-size:clamp(34px,5vw,48px);margin:0}
   .big{font-size:22px}
   .alert{padding:16px;border-radius:14px;background:var(--vic-danger-soft);color:#912018;font-weight:700}
   .pick{display:flex;gap:8px;flex-wrap:wrap}
   .pick button{font-family:var(--font-read);font-size:18px;padding:12px 18px;border-radius:999px;border:2px solid var(--vic-border);background:var(--vic-surface);cursor:pointer;color:var(--vic-text-primary);font-weight:700}
   .pick button.on{background:var(--vic-ink);border-color:var(--vic-ink);color:#fff}
   .card{background:var(--vic-surface);border-radius:22px;padding:28px;border:1px solid var(--vic-border-soft);box-shadow:var(--vic-shadow-soft)}
   .card h2{font-family:var(--font-read);font-size:clamp(26px,3.6vw,34px);margin:4px 0 0;line-height:1.2}
   .tag{margin:0;color:var(--vic-text-secondary);font-size:18px}
   .goals{margin-top:18px;padding:18px 20px;border-radius:16px;background:var(--vic-primary-soft)}
   .gl{margin:0 0 6px;font-weight:700;color:var(--vic-primary)}
   .goals ul{margin:0;padding-left:24px;line-height:1.6}
   .empty p{line-height:1.6}
   .tracks{display:grid;grid-template-columns:1fr 1fr;gap:18px}
   .track{border-radius:22px;padding:26px;display:flex;flex-direction:column;gap:10px}
   .track h3{font-family:var(--font-read);font-size:28px;margin:0}
   .track p{margin:0;line-height:1.6}
   .tl{font-family:var(--font-mono);text-transform:uppercase;font-size:15px;letter-spacing:.04em}
   .me{background:var(--vic-surface);border:3px solid var(--vic-primary)}
   .me .tl{color:var(--vic-primary)}
   .vic{background:var(--vic-vic);color:#fff;box-shadow:0 18px 40px rgba(91,33,182,.35)}
   .vic .tl{color:var(--vic-vic-glow)}
   .small{font-size:18px;color:var(--vic-text-secondary)}
   .go{margin-top:auto;display:inline-flex;justify-content:center;align-items:center;min-height:56px;padding:14px 22px;border-radius:16px;font-family:var(--font-read);font-size:21px;font-weight:700;text-decoration:none;cursor:pointer;border:0}
   .blue{background:var(--vic-primary);color:#fff}
   .vicbtn{background:#fff;color:var(--vic-vic)}
   .go.vic{background:var(--vic-vic);color:#fff;margin-top:16px}
   @media(max-width:760px){.tracks{grid-template-columns:1fr}.wrap{padding:10px 14px 0}main{padding:12px 16px 56px}}
  `}</style>
 </div>
}

function Worksheet({ lesson, onSaved }) {
 const sheet = lesson.worksheet
 const [answers, setAnswers] = useState(lesson.work?.answers || {}), [status, setStatus] = useState(lesson.work?.status || ''), [saving, setSaving] = useState(''), [error, setError] = useState('')
 const timer = useRef(null), latest = useRef(answers)
 const done = status === 'turned_in'
 const answered = sheet.questions.filter((_, i) => String(answers[i] || '').trim()).length

 async function save(turnIn = false, reopen = false) {
  clearTimeout(timer.current); setSaving(turnIn ? 'Turning in…' : 'Saving…'); setError('')
  try { const d = await call('POST', { lessonId: lesson.lessonId, answers: latest.current, turnIn, reopen }); setStatus(d.status); setSaving('Saved ✓'); onSaved({ answers: latest.current, status: d.status }) }
  catch (e) { setError(e.message); setSaving('') }
 }
 function change(i, value) {
  const next = { ...latest.current, [i]: value }; latest.current = next; setAnswers(next); setSaving('')
  clearTimeout(timer.current); timer.current = setTimeout(() => save(false), 1200)
 }
 useEffect(() => () => clearTimeout(timer.current), [])

 return <section className="sheet" aria-label="My worksheet">
  <div className="sh"><div><p className="tl">{sheet.label}</p><h2>{sheet.title}</h2></div><span className="saved" role="status">{saving}</span></div>
  {sheet.directions && <p className="dir">{sheet.directions}</p>}
  {sheet.passage && <div className="passage">{sheet.passage}</div>}
  <ol>{sheet.questions.map((q, i) => <li key={i}>
   <label htmlFor={`q${i}`}>{q.prompt}</label>
   <textarea id={`q${i}`} rows={3} value={answers[i] || ''} disabled={done} onChange={e => change(i, e.target.value)} placeholder="Type your answer" />
  </li>)}</ol>
  {error && <p className="err" role="alert">{error}</p>}
  <div className="foot">
   {done ? <><p className="turned">✓ You turned this in. Great work!</p><button type="button" className="ghost" onClick={() => save(false, true)}>Change my answers</button></>
    : <><p>{answered} of {sheet.questions.length} answered</p><button type="button" className="turn" disabled={!answered || saving === 'Turning in…'} onClick={() => save(true)}>Turn it in</button></>}
  </div>
  <style jsx>{`
   .sheet{background:var(--vic-surface);border-radius:22px;padding:28px;border:3px solid var(--vic-primary)}
   .sh{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
   .tl{font-family:var(--font-mono);text-transform:uppercase;font-size:15px;color:var(--vic-primary);margin:0}
   h2{font-family:var(--font-read);font-size:28px;margin:4px 0 0}
   .saved{color:var(--vic-success);font-weight:700;font-size:17px;white-space:nowrap}
   .dir{line-height:1.6;font-weight:700}
   .passage{white-space:pre-wrap;line-height:1.75;padding:20px;border-radius:16px;background:var(--vic-surface-muted);margin:12px 0}
   ol{padding-left:28px;display:flex;flex-direction:column;gap:22px;margin:22px 0}
   label{display:block;line-height:1.55;margin-bottom:10px}
   textarea{width:100%;font-family:var(--font-read);font-size:20px;line-height:1.5;padding:14px;border:2px solid var(--vic-field-border);border-radius:14px;background:#fff;resize:vertical}
   textarea:focus{outline:3px solid var(--vic-cyan);border-color:var(--vic-primary)}
   textarea:disabled{background:var(--vic-surface-muted)}
   .err{color:var(--vic-danger);font-weight:700}
   .foot{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;border-top:1px solid var(--vic-border-soft);padding-top:18px}
   .foot p{margin:0}
   .turned{font-weight:700;color:var(--vic-success)}
   .turn{min-height:56px;padding:14px 28px;border-radius:16px;border:0;background:var(--vic-volt);color:var(--vic-ink);font-family:var(--font-read);font-size:21px;font-weight:800;cursor:pointer;box-shadow:0 0 0 2px var(--vic-ink) inset}
   .turn:disabled{opacity:.5;cursor:not-allowed}
   .ghost{min-height:48px;padding:10px 18px;border-radius:14px;border:2px solid var(--vic-border);background:#fff;font-family:var(--font-read);font-size:18px;cursor:pointer}
  `}</style>
 </section>
}
