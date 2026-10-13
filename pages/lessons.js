import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import { useAccount } from '../lib/use-account'
import { lessonLibraryRequest } from '../lib/lesson-library-client'
import { STEPS, stepDone, stepHref, nextStep, doneCount } from '../lib/lesson-steps.mjs'
import { WEEKDAYS, formatDay, gradeLabel, subjectLabel } from '../lib/lesson-week.mjs'

// My Lessons: every saved lesson, where it sits in the week, and its next step.
export default function MyLessons() {
 const { account, error: accountError } = useAccount({ next: '/lessons' })
 const [lessons, setLessons] = useState([]), [more, setMore] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [filter, setFilter] = useState(''), [show, setShow] = useState('all')

 async function load(append = false) {
  setLoading(true); setError('')
  try { const d = await lessonLibraryRequest(`?offset=${append ? lessons.length : 0}`); setLessons(append ? [...lessons, ...d.lessons] : d.lessons); setMore(d.hasMore) }
  catch (e) { setError(e.message) } finally { setLoading(false) }
 }
 useEffect(() => { if (account) load() }, [account])

 const q = filter.trim().toLowerCase()
 const shown = lessons.filter(l => (!q || `${l.title} ${subjectLabel(l.subject)} ${gradeLabel(l.grade)}`.toLowerCase().includes(q)) && (show === 'all' || (show === 'open' ? doneCount(l.steps) < 4 : doneCount(l.steps) === 4)))

 return <PageShell title="My Lessons" currentPath="/lessons">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account ? <p role="status">Opening your lessons…</p> : <>
   <header className="top">
    <div><p className="label">My lessons</p><h1>Every lesson you’ve made</h1><p className="muted">Open a step to pick up where you left off.</p></div>
    <div className="row"><a className="btn btn-outline" href="/lessonplan/week">Plan a whole week</a><a className="btn btn-primary" href="/lessonplan?new=1">+ New lesson</a></div>
   </header>
   <div className="tools">
    <label className="find">Find a lesson<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Title, subject or grade" /></label>
    <div className="seg" role="group" aria-label="Show">{[['all', 'All'], ['open', 'Still to do'], ['done', 'Finished']].map(([k, label]) => <button key={k} type="button" aria-pressed={show === k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{label}</button>)}</div>
   </div>
   {error && <p className="alert" role="alert">{error} <button type="button" className="btn btn-outline" onClick={() => load()}>Try again</button></p>}
   {!loading && !error && !lessons.length && <section className="dark-panel"><h2 className="dh">No lessons yet</h2><p>Make your first lesson and it will show up here with its four steps.</p><div className="row gap"><a className="btn btn-cyan" href="/lessonplan?new=1">Make a lesson</a></div></section>}
   <div className="list">{shown.map(l => {
    const next = nextStep(l.steps), week = l.week && typeof l.week === 'object' ? l.week : null
    const when = week && Number.isInteger(week.day) && week.weekOf ? `${WEEKDAYS[week.day]} · week of ${formatDay(week.weekOf, { month: 'short', day: 'numeric' })}` : ''
    return <article key={l.id} className="item">
     <div className="info">
      <a className="title" href={stepHref('plan', l.id)}>{l.title || 'Untitled lesson'}</a>
      <p className="meta">{[gradeLabel(l.grade), subjectLabel(l.subject), when, `Updated ${new Date(l.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`].filter(Boolean).join(' · ')}</p>
     </div>
     <nav className="steps" aria-label={`Steps for ${l.title}`}>{STEPS.map(s => <a key={s.key} href={stepHref(s.key, l.id)} className={stepDone(s.key, l.steps) ? 'st done' : 'st'}>{stepDone(s.key, l.steps) ? '✓ ' : ''}{s.label}</a>)}</nav>
     {next ? <a className="btn btn-primary nx" href={stepHref(next.key, l.id)}>{next.label} →</a> : <span className="fin">✓ Finished</span>}
    </article>
   })}</div>
   {loading && <p role="status">Loading your lessons…</p>}
   {!loading && lessons.length > 0 && !shown.length && <p className="muted">No lessons match.</p>}
   {more && <button type="button" className="btn btn-outline" disabled={loading} onClick={() => load(true)}>Load more lessons</button>}
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0 0 6px;font-size:clamp(30px,3.4vw,42px);line-height:1.1}
   .row{display:flex;gap:10px;flex-wrap:wrap}.gap{margin-top:14px}
   .dh{color:#fff;margin:0 0 6px}
   .tools{display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap}
   .find{display:flex;flex-direction:column;gap:6px;font-weight:800;font-size:14px;flex:1;min-width:240px}
   .find input{padding:12px 14px;border:1px solid var(--vic-field-border);border-radius:12px;font-size:16px;background:var(--vic-surface)}
   .seg{display:flex;gap:4px;padding:4px;background:var(--vic-surface-muted);border-radius:12px}
   .seg button{padding:9px 14px;border:0;border-radius:9px;background:transparent;font-weight:800;font-size:15px;cursor:pointer;color:var(--vic-text-secondary)}
   .seg button.on{background:var(--vic-surface);color:var(--vic-text-primary);box-shadow:var(--vic-shadow-soft)}
   .list{display:flex;flex-direction:column;gap:10px}
   .item{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:18px;align-items:center;background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:14px;padding:16px 18px}
   .title{font-weight:800;font-size:17px;color:var(--vic-text-primary);text-decoration:none}
   .title:hover{color:var(--vic-primary)}
   .meta{margin:4px 0 0;font-size:14px;color:var(--vic-text-secondary)}
   .steps{display:flex;gap:4px;flex-wrap:wrap}
   .st{padding:6px 10px;border-radius:8px;background:var(--vic-surface-muted);color:var(--vic-text-secondary);font-size:14px;font-weight:700;text-decoration:none}
   .st.done{background:var(--vic-ink);color:var(--vic-volt)}
   .nx{min-width:130px}
   .fin{font-weight:800;color:var(--vic-success);min-width:130px;text-align:center}
   @media(max-width:860px){.item{grid-template-columns:1fr}.nx,.fin{justify-self:start}}
  `}</style>
 </PageShell>
}
