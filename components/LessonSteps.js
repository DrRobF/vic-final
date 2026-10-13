import { STEPS, stepDone, stepHref } from '../lib/lesson-steps.mjs'
import { WEEKDAYS, formatDay, weekDates, gradeLabel, subjectLabel } from '../lib/lesson-week.mjs'

// The top of every lesson page: title, where it sits in the week, and the four steps.
export default function LessonSteps({ lessonId, lesson, home, current, onMark, marking }) {
 const steps = lesson?.steps
 const input = lesson?.input || {}
 const codes = (input.standards || []).map(s => s.code).filter(Boolean).slice(0, 2)
 const meta = [gradeLabel(input.grade), subjectLabel(input.subject), ...codes].filter(Boolean)
 const day = home ? `${WEEKDAYS[home.day]}, ${formatDay(weekDates(home.weekOf)[home.day], { month: 'short', day: 'numeric' })} · Day ${home.day + 1} of 5` : ''
 const markable = current !== 'plan'
 const done = stepDone(current, steps)
 return <div className="ls">
  <a className="back" href={home ? `/teach?week=${home.weekOf}` : '/teach'}>← My Week</a>
  <div className="head">
   <div>
    <p className="meta">{[...meta, day].filter(Boolean).join(' · ')}</p>
    <h1>{lesson?.plan?.title || 'Your lesson'}</h1>
   </div>
   {markable && <button type="button" className={done ? 'mark done' : 'mark'} disabled={marking} onClick={() => onMark?.(current, !done)} aria-pressed={done}>{done ? '✓ Step done' : 'Mark this step done'}</button>}
  </div>
  <nav className="steps" aria-label="Lesson steps">
   {STEPS.map((s, i) => {
    const isCurrent = s.key === current, isDone = stepDone(s.key, steps)
    return <a key={s.key} href={stepHref(s.key, lessonId)} className={isCurrent ? 'step current' : 'step'} aria-current={isCurrent ? 'step' : undefined}>
     <span className="num" aria-hidden="true">{isDone && !isCurrent ? '✓' : `0${i + 1}`}</span>
     <span className="txt"><strong>{s.label}</strong><small>{s.hint}{isDone && !isCurrent ? ' · done' : ''}</small></span>
    </a>
   })}
  </nav>
  <style jsx>{`
   .ls{display:flex;flex-direction:column;gap:14px;margin:8px 0 20px}
   .back{font-weight:800;font-size:15px;text-decoration:none}
   .head{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;flex-wrap:wrap}
   .meta{margin:0 0 6px;font-family:var(--font-mono);font-size:13px;color:var(--vic-text-secondary);text-transform:uppercase}
   h1{margin:0;font-size:clamp(26px,3vw,36px);line-height:1.15}
   .mark{padding:11px 16px;border-radius:11px;border:1px solid var(--vic-border);background:var(--vic-surface);color:var(--vic-text-primary);font-weight:800;font-size:15px;cursor:pointer}
   .mark.done{background:var(--vic-volt);border-color:var(--vic-volt);color:var(--vic-ink)}
   .mark:disabled{opacity:.6}
   .steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:6px;background:var(--vic-surface-muted);border-radius:14px}
   .step{display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;color:var(--vic-text-primary);text-decoration:none}
   .step:hover{background:var(--vic-surface)}
   .step.current{background:var(--vic-ink);color:#fff;box-shadow:0 0 0 1px var(--vic-cyan)}
   .num{font-family:var(--font-mono);font-size:14px;color:var(--vic-text-secondary);min-width:22px}
   .current .num{color:var(--vic-cyan)}
   .txt{display:flex;flex-direction:column;line-height:1.25}
   .txt strong{font-size:16px}
   .txt small{font-size:13px;color:var(--vic-text-secondary)}
   .current .txt small{color:var(--vic-ink-muted)}
   @media(max-width:760px){.steps{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media print{.ls{display:none}}
  `}</style>
 </div>
}
