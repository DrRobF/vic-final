import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const STATUS = { not_started: 'Not started', started: 'Working', turned_in: 'Turned in' }
const LEVEL_CLASS = { Support: 'support', 'On level': 'onlevel', Enrichment: 'enrich' }

// Teach step: who this lesson went to, and how their worksheet is going.
export default function StudentProgress({ lessonId, refreshKey }) {
 const [students, setStudents] = useState(null), [error, setError] = useState(''), [open, setOpen] = useState('')
 useEffect(() => {
  let active = true
  ;(async () => {
   const { data: { session } } = await supabase.auth.getSession()
   const r = await fetch(`/api/teacher/lesson-progress?lessonId=${encodeURIComponent(lessonId)}`, { headers: { Authorization: `Bearer ${session?.access_token}` } })
   const d = await r.json().catch(() => ({}))
   if (!active) return
   if (!r.ok) setError(d.error || 'Could not load student progress.'); else setStudents(d.students)
  })().catch(e => { if (active) setError(e.message) })
  return () => { active = false }
 }, [lessonId, refreshKey])
 if (error) return <p className="alert" role="alert">{error}</p>
 if (!students) return <p role="status">Loading student progress…</p>
 if (!students.length) return <p className="muted">When you send this lesson to students, you’ll see each student’s worksheet progress here.</p>
 const turned = students.filter(s => s.status === 'turned_in').length
 return <div className="sp">
  <p className="muted">{turned} of {students.length} turned in their worksheet.</p>
  <ul>{students.map((s, i) => <li key={i}>
   <button type="button" className="row" aria-expanded={open === String(i)} onClick={() => setOpen(open === String(i) ? '' : String(i))} disabled={!s.questions.length || s.status === 'not_started'}>
    <strong>{s.name}</strong>
    <span className={`level ${LEVEL_CLASS[s.level] || 'onlevel'}`}>{s.level}</span>
    <span className={`st ${s.status}`}>{STATUS[s.status]}</span>
   </button>
   {open === String(i) && <ol className="ans">{s.questions.map((q, j) => <li key={j}><p className="q">{q.prompt}</p><p className="r">{q.response || <em>No answer yet</em>}</p>{q.answer && <p className="k">Answer key: {q.answer}</p>}</li>)}</ol>}
  </li>)}</ul>
  <style jsx>{`
   .sp ul{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:6px}
   .row{width:100%;display:grid;grid-template-columns:1fr auto 120px;gap:12px;align-items:center;padding:12px 14px;border:1px solid var(--vic-border-soft);border-radius:12px;background:var(--vic-surface);cursor:pointer;text-align:left;font-size:16px;color:var(--vic-text-primary)}
   .row:disabled{cursor:default}
   .st{font-weight:800;font-size:14px;text-align:right;color:var(--vic-text-secondary)}
   .st.started{color:var(--vic-primary)}
   .st.turned_in{color:var(--vic-success)}
   .ans{margin:8px 0 8px 18px;display:flex;flex-direction:column;gap:12px}
   .q{font-weight:700;margin:0}.r{margin:4px 0 0;white-space:pre-wrap}.k{margin:4px 0 0;font-size:14px;color:var(--vic-text-secondary)}
  `}</style>
 </div>
}
