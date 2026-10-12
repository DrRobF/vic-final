// The Lesson Designer's two planning modes, shown the same way on both pages.
const MODES=[
 {href:'/lessonplan',label:'Single lesson',detail:'One lesson, ready to edit'},
 {href:'/lessonplan/week',label:'Full week',detail:'Five days, a standard each day'},
]
export default function PlannerModeSwitch({current}){
 return <nav className="pm-switch" aria-label="Planning mode">
  {MODES.map(m=><a key={m.href} href={m.href} aria-current={current===m.href?'page':undefined} className={current===m.href?'active':''}><strong>{m.label}</strong><span>{m.detail}</span></a>)}
  <style jsx>{`
  .pm-switch{display:inline-grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;background:var(--vic-surface-muted);border:1px solid var(--vic-border);border-radius:14px;margin-top:24px;max-width:100%}
  a{display:block;text-decoration:none;color:var(--vic-text-secondary);padding:10px 18px;border-radius:10px;min-width:0}
  a strong{display:block;font-size:15px;color:var(--vic-text-primary)}
  a span{display:block;font-size:12px;margin-top:2px}
  a:hover{background:var(--vic-surface)}
  a.active{background:var(--vic-primary);box-shadow:0 2px 6px #0002}
  a.active strong,a.active span{color:#fff}
  @media(max-width:520px){.pm-switch{display:grid;width:100%}a{padding:10px 12px}}
  `}</style>
 </nav>
}
