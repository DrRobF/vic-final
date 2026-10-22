import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import StudentProgress from '../../components/StudentProgress'
import { stepHref } from '../../lib/lesson-steps.mjs'
import { supabase } from '../../lib/supabase'

async function authed(url, options = {}) {
 const { data: { session } } = await supabase.auth.getSession()
 if (!session) { window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); throw new Error('Please log in.') }
 const r = await fetch(url, { ...options, headers: { Authorization: `Bearer ${session.access_token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) } })
 const d = await r.json().catch(() => ({}))
 return { r, d }
}
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`

// Live lesson: the lesson is running. The teacher steps through the activities like slides, with
// their own materials beside them, while students work with VIC or on their worksheet.
export default function LiveLesson() {
 const router = useRouter(), id = typeof router.query.id === 'string' ? router.query.id : ''
 const [data, setData] = useState(null), [error, setError] = useState('')
 const [at, setAt] = useState(0), [left, setLeft] = useState(0), [running, setRunning] = useState(false)
 const [show, setShow] = useState(false), [send, setSend] = useState({}), [refresh, setRefresh] = useState(0)
 const tick = useRef(null)

 useEffect(() => {
  if (!id) return
  authed(`/api/teacher/live-lesson?id=${encodeURIComponent(id)}`).then(({ r, d }) => { if (!r.ok) setError(d.error || 'Could not open this lesson.'); else setData(d) }).catch(e => setError(e.message))
 }, [id, refresh])

 const phases = data?.phases || [], phase = phases[at]
 useEffect(() => { setLeft((phase?.minutes || 0) * 60); setRunning(false) }, [at, phase?.minutes])
 useEffect(() => {
  clearInterval(tick.current)
  if (running) tick.current = setInterval(() => setLeft(s => s - 1), 1000)
  return () => clearInterval(tick.current)
 }, [running])
 useEffect(() => {
  function key(e) {
   if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return
   if (e.key === 'ArrowRight') setAt(i => Math.min(i + 1, phases.length - 1))
   if (e.key === 'ArrowLeft') setAt(i => Math.max(i - 1, 0))
   if (e.key === 'Escape') setShow(false)
  }
  window.addEventListener('keydown', key)
  return () => window.removeEventListener('keydown', key)
 }, [phases.length])

 // Only needed when the lesson isn't on students' screens yet (it wasn't in the week plan, say).
 async function sendNow(classId) {
  setSend({ busy: true })
  try {
   const { r, d } = await authed('/api/teacher/start-lesson', { method: 'POST', body: JSON.stringify({ lessonId: id, ...(classId ? { classId } : {}) }) })
   if (r.status === 409 && d.needClass) return setSend({ pick: d.classes })
   if (!r.ok) return setSend({ err: d.error || 'Could not send this lesson.', fix: d.needsLessonWork ? stepHref('plan', id) : d.emptyClass ? '/classes' : d.noClassroom ? '/join' : '' })
   setSend({}); setRefresh(n => n + 1)
  } catch (e) { setSend({ err: e.message }) }
 }

 const total = phases.reduce((n, p) => n + p.minutes, 0)
 const goal = data?.objectives?.[0] || ''

 return <PageShell title={data ? `Live: ${data.title}` : 'Live lesson'} currentPath="/teach">
  <PanelStyles />
  {error ? <p className="alert" role="alert">{error} <a href="/teach">Back to My Week</a></p> : !data ? <p role="status">Opening your lesson…</p> : <>
   <header className="top">
    <div className="tl">
     <p className="label">Live lesson{total ? ` · ${total} minutes` : ''}</p>
     <h1>{data.title}</h1>
     {goal && <p className="goal">Today we are learning to {goal.replace(/^./, c => c.toLowerCase())}</p>}
    </div>
    <div className="status">
     {data.live ? <p className="on">✓ On students’ screens: {data.live.count} {data.live.count === 1 ? 'student' : 'students'}{data.live.className ? ` in ${data.live.className}` : ''}</p>
      : <>
       <p className="off">Not on students’ screens yet.</p>
       <button type="button" className="btn btn-primary" disabled={send.busy} onClick={() => sendNow()}>{send.busy ? 'Sending…' : 'Send to my class'}</button>
       {send.pick && <span className="pick">Which class? {send.pick.map(c => <button key={c.id} type="button" className="btn btn-outline sm" onClick={() => sendNow(c.id)}>{c.name}</button>)}</span>}
       {send.err && <p className="err" role="alert">{send.err} {send.fix && <a href={send.fix}>Fix this →</a>}</p>}
      </>}
    </div>
   </header>

   {phases.length > 0 ? <>
    <nav className="agenda" aria-label="Schedule of activities">
     {phases.map((p, i) => <button key={i} type="button" className={i === at ? 'ag on' : i < at ? 'ag done' : 'ag'} aria-current={i === at ? 'step' : undefined} onClick={() => setAt(i)}>
      <span className="n">{i + 1}</span><span className="t">{p.title}</span>{p.minutes > 0 && <span className="m">{p.minutes} min</span>}
     </button>)}
    </nav>

    <section className="panel slide" aria-live="polite">
     <div className="shead">
      <div><p className="label">Activity {at + 1} of {phases.length}</p><h2>{phase.title}</h2></div>
      {phase.minutes > 0 && <div className="timer">
       <span className={left < 0 ? 'clock over' : left <= 60 ? 'clock soon' : 'clock'}>{left < 0 ? `+${mmss(-left)}` : mmss(left)}</span>
       <button type="button" className="btn btn-outline sm" onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Start timer'}</button>
       <button type="button" className="btn btn-outline sm" onClick={() => { setRunning(false); setLeft(phase.minutes * 60) }}>Reset</button>
      </div>}
     </div>
     <div className="cols">
      <div className="col you"><p className="who">You</p><p>{phase.teacher || 'Lead this part of the lesson.'}</p></div>
      {phase.students && <div className="col kids"><p className="who">Students</p><p>{phase.students}</p></div>}
     </div>
     {phase.materials && <p className="mat"><strong>Materials:</strong> {phase.materials}</p>}
     <div className="nav">
      <button type="button" className="btn btn-outline" disabled={at === 0} onClick={() => setAt(at - 1)}>← Back</button>
      <button type="button" className="btn btn-outline" onClick={() => setShow(true)}>Show the class</button>
      <button type="button" className="btn btn-primary" disabled={at === phases.length - 1} onClick={() => setAt(at + 1)}>Next activity →</button>
     </div>
    </section>
   </> : <p className="panel">This lesson has no schedule of activities yet. <a href={stepHref('plan', id)}>Open the lesson</a></p>}

   <div className="two">
    <section className="panel"><p className="label">Your class today</p><h2>Who is where</h2><StudentProgress lessonId={id} refreshKey={refresh} /></section>
    <section className="panel">
     <p className="label">Your materials</p><h2>Teacher packet</h2>
     {data.teacher.map((s, i) => <details key={i}><summary>{s.title}</summary><div className="body">{s.body}</div></details>)}
     <p className="label sp">What students have</p>
     {data.student.map((s, i) => <details key={i}><summary>{s.title}</summary><div className="body">{s.body}</div></details>)}
    </section>
   </div>
  </>}

  {show && phase && <div className="project" role="dialog" aria-label="Class view">
   <button type="button" className="close" onClick={() => setShow(false)}>Close ✕</button>
   <p className="pgoal">{goal ? `Today we are learning to ${goal.replace(/^./, c => c.toLowerCase())}` : data.title}</p>
   <h2>{phase.title}</h2>
   <p className="pdo">{phase.students || phase.teacher}</p>
   <div className="pfoot">
    {phase.minutes > 0 && <span className="pclock">{left < 0 ? `+${mmss(-left)}` : mmss(left)}</span>}
    <span>{at + 1} / {phases.length}</span>
    <button type="button" disabled={at === 0} onClick={() => setAt(at - 1)}>←</button>
    <button type="button" disabled={at === phases.length - 1} onClick={() => setAt(at + 1)}>→</button>
   </div>
  </div>}

  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-top:12px}
   .tl{min-width:0;flex:1 1 420px}
   h1{margin:4px 0 8px;font-size:clamp(28px,3.2vw,40px);line-height:1.1}
   .goal{margin:0;font-size:18px;color:var(--vic-text-secondary)}
   .status{display:flex;flex-direction:column;gap:8px;align-items:flex-end;max-width:360px}
   .on{margin:0;padding:10px 14px;border-radius:12px;background:var(--vic-success-soft);color:var(--vic-success);font-weight:800}
   .off{margin:0;font-weight:800;color:var(--vic-danger)}
   .err{margin:0;color:var(--vic-danger);font-weight:700}
   .pick{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-weight:700}
   .sm{min-height:36px;padding:6px 12px;font-size:14px}
   .agenda{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
   .ag{flex:1 0 150px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;padding:10px 12px;border-radius:12px;border:2px solid var(--vic-border-soft);background:var(--vic-surface);cursor:pointer;color:var(--vic-text-primary);font:inherit}
   .ag .n{font-family:var(--font-mono);font-size:12px;color:var(--vic-text-secondary)}
   .ag .t{font-weight:800;font-size:14px;line-height:1.25}
   .ag .m{font-size:12.5px;color:var(--vic-text-secondary)}
   .ag.on{border-color:var(--vic-primary);background:var(--vic-primary-soft)}
   .ag.done{opacity:.6}
   .slide{display:flex;flex-direction:column;gap:16px;border:2px solid var(--vic-primary)}
   .shead{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
   .shead h2{margin:4px 0 0;font-size:clamp(24px,2.6vw,32px)}
   .timer{display:flex;gap:8px;align-items:center}
   .clock{font-family:var(--font-mono);font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}
   .clock.soon{color:var(--vic-warning,#B45309)}
   .clock.over{color:var(--vic-danger)}
   .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}
   .col{border-radius:14px;padding:16px 18px;background:var(--vic-surface-muted)}
   .col p{margin:0;font-size:18px;line-height:1.55}
   .col .who{font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;color:var(--vic-text-secondary)}
   .kids{background:var(--vic-primary-soft)}
   .mat{margin:0;color:var(--vic-text-secondary)}
   .nav{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
   .two{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start}
   .sp{margin-top:18px}
   details{border-top:1px solid var(--vic-border-soft);padding:10px 0}
   summary{cursor:pointer;font-weight:800}
   .body{white-space:pre-wrap;line-height:1.6;margin-top:8px;font-size:15.5px}
   .project{position:fixed;inset:0;z-index:50;background:var(--vic-ink);color:#fff;display:flex;flex-direction:column;justify-content:center;gap:24px;padding:48px max(48px,env(safe-area-inset-left,0px)) 40px max(48px,env(safe-area-inset-right,0px))}
   .project h2{margin:0;font-size:clamp(40px,6vw,76px);line-height:1.05;color:#fff}
   .pgoal{margin:0;font-size:clamp(18px,2vw,24px);color:var(--vic-ink-muted)}
   .pdo{margin:0;font-size:clamp(24px,3vw,40px);line-height:1.35;max-width:40ch}
   .pfoot{display:flex;gap:16px;align-items:center;font-size:20px;color:var(--vic-ink-muted)}
   .pfoot button{min-width:56px;min-height:48px;border-radius:12px;border:1px solid var(--vic-ink-line);background:transparent;color:#fff;font-size:22px;cursor:pointer}
   .pfoot button:disabled{opacity:.35}
   .pclock{font-family:var(--font-mono);font-size:36px;color:#fff;font-weight:800}
   .close{position:absolute;top:20px;right:24px;border:1px solid var(--vic-ink-line);background:transparent;color:#fff;border-radius:10px;padding:8px 14px;font-size:16px;cursor:pointer}
   @media(max-width:700px){.status{align-items:flex-start}}
  `}</style>
 </PageShell>
}
