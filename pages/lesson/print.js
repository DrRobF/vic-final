import { useRouter } from 'next/router'
import { useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import LessonSteps from '../../components/LessonSteps'
import LessonPacket from '../../components/LessonPacket'
import { useLesson } from '../../lib/use-lesson'
import { stepHref } from '../../lib/lesson-steps.mjs'
import { versionLevel } from '../../lib/levels.mjs'
import { WEEKDAYS } from '../../lib/lesson-week.mjs'
import { supabase } from '../../lib/supabase'

const LEVEL_CLASS = { Support: 'support', 'On level': 'onlevel', Enrichment: 'enrich' }

// Step 2 · Print: everything for the day in one place.
export default function LessonPrint() {
 const router = useRouter(), id = typeof router.query.id === 'string' ? router.query.id : ''
 const { lesson, home, error, markStep } = useLesson(id)
 const [busy, setBusy] = useState(''), [msg, setMsg] = useState(''), [err, setErr] = useState('')
 const sheet = lesson?.worksheet, groups = lesson?.input?.groups

 async function mark(step, done) { try { await markStep(step, done) } catch (e) { setErr(e.message) } }
 async function download(kind) {
  setBusy(kind); setErr('')
  try {
   const { data: { session } } = await supabase.auth.getSession()
   const r = await fetch('/api/lessonplan/export', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ kind: kind === 'lesson' ? undefined : kind, plan: lesson.plan, input: lesson.input, worksheet: lesson.worksheet }) })
   if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Could not prepare the download.') }
   const url = URL.createObjectURL(await r.blob()), a = document.createElement('a')
   a.href = url; a.download = kind === 'lesson' ? 'Lesson-Plan.docx' : kind === 'answer-key' ? 'Answer-Key.docx' : 'Student-Worksheet.docx'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
   setMsg('Downloaded.'); mark('print', true)
  } catch (e) { setErr(e.message) } finally { setBusy('') }
 }

 return <PageShell title="Print" currentPath="/lesson">
  <PanelStyles />
  {error ? <p className="alert" role="alert">{error} <a href="/lessons">Back to My Lessons</a></p> : !lesson ? <p role="status">Opening your lesson…</p> : <>
   <LessonSteps lessonId={id} lesson={lesson} home={home} current="print" onMark={mark} />
   {err && <p className="alert" role="alert">{err}</p>}{msg && <p className="notice" role="status">{msg}</p>}
   <section className="dark-panel hero">
    <div><h2>Everything for {home ? WEEKDAYS[home.day] : 'this lesson'}, in one go</h2><p>Teacher packet, student copies and every worksheet level, sorted and ready to copy. Use <strong>Print everything</strong> below, or download Word files.</p></div>
    <div className="row"><button type="button" className="btn btn-cyan" disabled={!!busy} onClick={() => download('lesson')}>{busy === 'lesson' ? 'Preparing…' : 'Download lesson (Word)'}</button></div>
   </section>
   {sheet ? <section className="panel">
    <p className="label">Worksheets by level</p>
    <h2>{sheet.title}</h2>
    <div className="levels">{sheet.versions.map((v, i) => { const level = versionLevel(v, i, groups); return <div key={i} className="lv"><span className={`level ${LEVEL_CLASS[level] || 'onlevel'}`}>{level || v.label}</span><span className="muted">{v.label} · {v.questions.length} questions</span></div> })}</div>
    <p>Students’ copies only say “{sheet.versions.length > 1 ? 'Version 1, 2, 3' : 'Classroom version'}.” The answer key shows which version is for which group.</p>
    <div className="row"><button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => download('worksheet')}>{busy === 'worksheet' ? 'Preparing…' : 'Download student worksheets'}</button><button type="button" className="btn btn-outline" disabled={!!busy} onClick={() => download('answer-key')}>{busy === 'answer-key' ? 'Preparing…' : 'Download answer keys'}</button></div>
   </section> : <section className="panel"><p className="label">Worksheets</p><h2>No worksheet yet</h2><p>Create one per level from the lesson’s Plan step.</p><a className="btn btn-outline" href={`${stepHref('plan', id)}#worksheet`}>Create worksheets</a></section>}
   <section className="panel"><LessonPacket lessonId={id} title={lesson.plan?.title || 'Lesson'} featured onPrinted={() => mark('print', true)} /></section>
   <div className="next"><a className="btn btn-primary" href={stepHref('teach', id)}>Next: send to students →</a></div>
  </>}
  <style jsx>{`
   .hero{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
   .hero h2{margin:0 0 6px;font-size:24px;color:#fff}
   .row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}
   .hero .row{margin-top:0}
   .levels{display:flex;flex-direction:column;gap:10px;margin:14px 0}
   .lv{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
   .next{display:flex;justify-content:flex-end}
  `}</style>
 </PageShell>
}
