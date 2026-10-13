import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import PageShell, { PanelStyles } from '../components/PageShell'
import { useAccount } from '../lib/use-account'
import { listWeeks, openWeek, deleteWeek } from '../lib/lesson-week-client'
import { STEPS, stepDone, stepHref, nextStep, doneCount } from '../lib/lesson-steps.mjs'
import { WEEKDAYS, WEEK_STATUS, defaultWeekOf, mondayOf, weekDates, formatDay, gradeLabel, subjectLabel } from '../lib/lesson-week.mjs'

function shiftWeek(weekOf, weeks) {
 const d = new Date(`${weekOf}T12:00:00Z`)
 d.setUTCDate(d.getUTCDate() + weeks * 7)
 return d.toISOString().slice(0, 10)
}
function todayIso() { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12)).toISOString().slice(0, 10) }

// My Week: the teacher's home. Five days, each lesson's progress, and what to do next.
export default function MyWeek() {
 const router = useRouter()
 const { account, error: accountError } = useAccount({ next: '/teach' })
 const [weeks, setWeeks] = useState(null), [chosenId, setChosenId] = useState(''), [detail, setDetail] = useState(null), [error, setError] = useState(''), [loadingWeek, setLoadingWeek] = useState(false), [confirmRemove, setConfirmRemove] = useState(false)
 const weekOf = useMemo(() => (typeof router.query.week === 'string' && mondayOf(router.query.week)) || defaultWeekOf(), [router.query.week])

 useEffect(() => {
  if (!account) return
  listWeeks().then(d => setWeeks(d.weeks || [])).catch(e => { setWeeks([]); setError(e.message) })
 }, [account])

 const thisWeek = useMemo(() => (weeks || []).filter(w => w.weekOf === weekOf), [weeks, weekOf])
 const week = thisWeek.find(w => w.id === chosenId) || thisWeek[0] || null

 useEffect(() => {
  if (!week) { setDetail(null); return }
  let active = true
  setLoadingWeek(true)
  openWeek(week.id).then(d => { if (active) setDetail(d) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoadingWeek(false) })
  return () => { active = false }
 }, [week?.id])

 async function removeWeek() {
  try { await deleteWeek(week.id); setConfirmRemove(false); setDetail(null); setChosenId(''); const d = await listWeeks(); setWeeks(d.weeks || []) }
  catch (e) { setError(e.message) }
 }
 function go(w) { router.push(`/teach?week=${w}`, undefined, { shallow: true }); setChosenId('') }
 const dates = weekDates(weekOf), today = todayIso()
 const days = detail?.week?.days || week?.days || []
 const lessons = detail?.lessons || {}
 const planned = days.filter(d => d.lessonId && lessons[d.lessonId]).length
 const totalSteps = days.reduce((n, d) => n + (d.lessonId && lessons[d.lessonId] ? doneCount(lessons[d.lessonId].steps) : 0), 0)
 const status = detail?.week?.status || week?.status

 return <PageShell title="My Week" currentPath="/teach">
  <PanelStyles />
  {accountError ? <p className="alert" role="alert">{accountError} <a href="/login">Log in</a></p> : !account ? <p role="status">Opening your week…</p> : <>
   <header className="top">
    <div>
     <p className="label">My week</p>
     <h1>Week of {formatDay(weekOf, { month: 'long', day: 'numeric' })}</h1>
     <div className="weeknav">
      <button type="button" className="btn btn-outline sm" onClick={() => go(shiftWeek(weekOf, -1))} aria-label="Previous week">←</button>
      <button type="button" className="btn btn-outline sm" onClick={() => go(defaultWeekOf())}>This week</button>
      <button type="button" className="btn btn-outline sm" onClick={() => go(shiftWeek(weekOf, 1))} aria-label="Next week">→</button>
      {thisWeek.length > 1 && <span className="chips">{thisWeek.map(w => <button key={w.id} type="button" className={w.id === week?.id ? 'chip on' : 'chip'} onClick={() => setChosenId(w.id)}>{gradeLabel(w.grade)} {subjectLabel(w.subject)}</button>)}</span>}
      {thisWeek.length === 1 && week && <span className="muted">{gradeLabel(week.grade)} · {subjectLabel(week.subject)}</span>}
     </div>
    </div>
    <div className="actions">
     <a className="btn btn-outline" href="/lessonplan?new=1">+ New lesson</a>
     <a className="btn btn-primary" href={week ? `/lessonplan/week?id=${week.id}` : '/lessonplan/week'}>{week ? 'Open week plan' : 'Plan the whole week'}</a>
    </div>
   </header>
   {error && <p className="alert" role="alert">{error}</p>}

   {weeks === null ? <p role="status">Loading your week…</p> : <>
    {week && <div className="summary">
     <span><strong>{planned}</strong> of 5 days planned</span>
     <span><strong>{totalSteps}</strong> of {planned * 4 || 0} steps done</span>
     <span className={`badge ${status}`}>{WEEK_STATUS[status] || ''}</span>
     {status === 'draft' && (confirmRemove ? <span className="rm"><strong>Remove this week plan? Its lessons stay in My Lessons.</strong><button type="button" className="btn del" onClick={removeWeek}>Yes, remove</button><button type="button" className="btn btn-outline" onClick={() => setConfirmRemove(false)}>Keep</button></span>
      : <button type="button" className="trash" onClick={() => setConfirmRemove(true)}>Remove this week</button>)}
    </div>}

    <div className="days">
     {WEEKDAYS.map((name, i) => {
      const day = days[i] || {}, lesson = day.lessonId ? lessons[day.lessonId] : null, isToday = dates[i] === today
      const next = lesson ? nextStep(lesson.steps) : null
      return <section key={name} className={`day${isToday ? ' today' : ''}${day.off ? ' off' : ''}`} aria-label={`${name} ${formatDay(dates[i], { month: 'short', day: 'numeric' })}`}>
       <div className="dhead"><strong>{name}</strong><span>{formatDay(dates[i], { month: 'short', day: 'numeric' })}{isToday ? ' · Today' : ''}</span></div>
       {day.off ? <p className="muted">No class</p>
        : lesson ? <>
         <a className="title" href={stepHref('plan', day.lessonId)}>{lesson.title}</a>
         <div className="bar" aria-label={`${doneCount(lesson.steps)} of 4 steps done`}>{STEPS.map(s => <a key={s.key} href={stepHref(s.key, day.lessonId)} className={stepDone(s.key, lesson.steps) ? 'seg done' : 'seg'} title={s.label}><span>{s.label}</span></a>)}</div>
         {next ? <a className="next" href={stepHref(next.key, day.lessonId)}>Next: {next.label} →</a> : <span className="alldone">✓ All done</span>}
        </>
        : loadingWeek ? <p className="muted">Loading…</p>
        : <>
         {day.topic && <p className="muted">{day.topic}</p>}
         <a className="plan" href={week ? `/lessonplan?weekId=${week.id}&day=${i}` : '/lessonplan/week'}>+ Plan {name}</a>
        </>}
      </section>
     })}
    </div>

    {!week && <section className="dark-panel empty">
     <div><h2>Nothing planned for this week yet</h2><p>Plan all five days at once, or make one lesson and add it to a day.</p></div>
     <div className="row"><a className="btn btn-cyan" href="/lessonplan/week">Plan the whole week</a><a className="btn btn-outline" href="/lessonplan?new=1">Make one lesson</a></div>
    </section>}

    {week && planned > 0 && <section className="panel send">
     <div><p className="label">Lesson plans</p><h2>{status === 'draft' ? 'Send this week to administration' : WEEK_STATUS[status]}</h2><p>{status === 'draft' ? 'When the week looks right, send it. Your principal gets the Word file and sees it in AskVic.' : 'Changed something? Open the week plan and send it again.'}</p></div>
     <a className="btn btn-primary" href={`/lessonplan/week?id=${week.id}#send`}>{status === 'draft' ? 'Review and send' : 'Open week plan'}</a>
    </section>}
   </>}

   <section className="more">
    <p className="label">More for you</p>
    <div className="moregrid">
     <a className="panel tile" href="/lessons"><strong>My Lessons</strong><span>Every lesson you’ve made, with its progress.</span></a>
     {account.classroom ? <a className="panel tile" href="/classes"><strong>My Classes</strong><span>Students, levels and what VIC is teaching.</span></a> : <a className="panel tile" href="/join"><strong>Join your school</strong><span>Use your school’s code so VIC can teach your students.</span></a>}
     <a className="panel tile" href="/parentletters"><strong>Families</strong><span>Student letters and class updates.</span></a>
     <a className="panel tile" href="/learning"><strong>Learning Paths</strong><span>Short practice for you, picked from walkthroughs.</span></a>
     {account.leader && <a className="panel tile lead" href="/school"><strong>School dashboard</strong><span>Lesson plans, walkthroughs and people.</span></a>}
    </div>
   </section>
  </>}
  <style jsx>{`
   .top{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-top:12px}
   h1{margin:0 0 12px;font-size:clamp(30px,3.4vw,42px);line-height:1.1}
   .weeknav{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
   .weeknav :global(.sm){min-height:40px;padding:8px 14px}
   .chips{display:flex;gap:6px;flex-wrap:wrap;margin-left:6px}
   .chip{padding:8px 13px;border-radius:999px;border:1px solid var(--vic-border);background:var(--vic-surface);font-weight:800;font-size:14px;cursor:pointer;color:var(--vic-text-primary)}
   .chip.on{background:var(--vic-ink);color:#fff;border-color:var(--vic-ink)}
   .actions{display:flex;gap:10px;flex-wrap:wrap}
   .summary{display:flex;gap:22px;align-items:center;flex-wrap:wrap;font-size:16px;color:var(--vic-text-secondary)}
   .summary strong{color:var(--vic-text-primary);font-family:var(--font-head);font-size:20px}
   .badge{padding:5px 12px;border-radius:999px;font-size:14px;font-weight:800;background:var(--vic-surface-muted);color:var(--vic-text-secondary)}
   .badge.submitted{background:var(--vic-primary-soft);color:var(--vic-primary)}
   .badge.reviewed{background:var(--vic-success-soft);color:var(--vic-success)}
   .trash{background:none;border:0;color:var(--vic-text-secondary);font-weight:700;font-size:15px;cursor:pointer;text-decoration:underline;margin-left:auto}
   .trash:hover{color:var(--vic-danger)}
   .rm{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-left:auto;color:var(--vic-danger)}
   .del{background:var(--vic-danger);color:#fff}
   .days{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
   .day{background:var(--vic-surface);border:1px solid var(--vic-border-soft);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px;min-height:190px}
   .day.today{border:2px solid var(--vic-cyan);box-shadow:0 0 0 4px rgba(34,211,238,.15)}
   .day.off{background:var(--vic-surface-muted)}
   .dhead{display:flex;flex-direction:column;gap:2px}
   .dhead strong{font-family:var(--font-head);font-size:18px}
   .dhead span{font-family:var(--font-mono);font-size:13px;color:var(--vic-text-secondary);text-transform:uppercase}
   .title{font-weight:800;font-size:16px;line-height:1.35;color:var(--vic-text-primary);text-decoration:none}
   .title:hover{color:var(--vic-primary)}
   .bar{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
   .seg{height:8px;border-radius:4px;background:var(--vic-surface-muted);position:relative}
   .seg.done{background:var(--vic-volt);box-shadow:inset 0 0 0 1px rgba(10,19,48,.15)}
   .seg span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
   .next{margin-top:auto;font-weight:800;font-size:15px;color:var(--vic-primary);text-decoration:none}
   .alldone{margin-top:auto;font-weight:800;font-size:15px;color:var(--vic-success)}
   .plan{margin-top:auto;display:block;text-align:center;padding:12px;border:2px dashed var(--vic-border);border-radius:12px;font-weight:800;color:var(--vic-primary);text-decoration:none}
   .plan:hover{border-color:var(--vic-primary);background:var(--vic-primary-soft)}
   .empty,.send{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
   .empty h2{color:#fff;margin:0 0 6px}
   .row{display:flex;gap:10px;flex-wrap:wrap}
   .more{margin-top:8px}
   .moregrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
   .tile{display:flex;flex-direction:column;gap:6px;text-decoration:none;color:var(--vic-text-primary);padding:18px}
   .tile strong{font-size:17px}
   .tile span{color:var(--vic-text-secondary);font-size:15px;line-height:1.5}
   .tile:hover{border-color:var(--vic-primary)}
   .tile.lead{border-color:var(--vic-ink);background:var(--vic-ink);color:#fff}
   .tile.lead span{color:var(--vic-ink-muted)}
   @media(max-width:1000px){.days{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:560px){.days{grid-template-columns:1fr}.day{min-height:0}}
  `}</style>
 </PageShell>
}
