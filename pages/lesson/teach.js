import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import LessonSteps from '../../components/LessonSteps'
import VICClassroomWorkspace from '../../components/VICClassroomWorkspace'
import StudentProgress from '../../components/StudentProgress'
import { useLesson } from '../../lib/use-lesson'
import { stepHref } from '../../lib/lesson-steps.mjs'
import { supabase } from '../../lib/supabase'

// Step 3 · Teach: who learns with the teacher today, and who learns with VIC.
export default function LessonTeach() {
 const router = useRouter(), id = typeof router.query.id === 'string' ? router.query.id : ''
 const { lesson, home, error, markStep } = useLesson(id)
 const [vic, setVic] = useState(null), [vicError, setVicError] = useState(''), [classroom, setClassroom] = useState(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [sentCount, setSentCount] = useState(0)

 useEffect(() => {
  if (!id) return
  let active = true
  ;(async () => {
   const { data: { session } } = await supabase.auth.getSession()
   if (!session) return
   const headers = { Authorization: `Bearer ${session.access_token}` }
   const acct = await fetch('/api/educator/account', { headers }).then(r => r.json()).catch(() => ({}))
   if (!active) return
   setClassroom(!!acct.classroom)
   if (!acct.classroom) return
   const r = await fetch(`/api/educator/lesson-companion?lessonId=${encodeURIComponent(id)}`, { headers })
   const d = await r.json().catch(() => ({}))
   if (!active) return
   if (!r.ok) setVicError(d.error || 'Could not prepare this lesson for VIC.')
   else if (!d.lesson?.vicText) setVicError(d.lesson?.vicError || 'Add a standard and learning objectives to this lesson first.')
   else setVic({ title: d.lesson.title, text: d.lesson.vicText, key: id, sourceId: id })
  })().catch(e => { if (active) setVicError(e.message) })
  return () => { active = false }
 }, [id])

 async function mark(step, done) { try { await markStep(step, done) } catch (e) { setErr(e.message) } }

 return <PageShell title="Teach" currentPath="/lesson">
  <PanelStyles />
  {error ? <p className="alert" role="alert">{error} <a href="/lessons">Back to My Lessons</a></p> : !lesson ? <p role="status">Opening your lesson…</p> : <>
   <LessonSteps lessonId={id} lesson={lesson} home={home} current="teach" onMark={mark} />
   {err && <p className="alert" role="alert">{err}</p>}{msg && <p className="notice" role="status">{msg}</p>}
   <div className="tracks">
    <section className="panel track me"><p className="label">With me</p><h2>Teach it with your group</h2><p>Whole group or small group, with the printed packet. Students you send this lesson to also get their version of the worksheet on screen.</p><a className="btn btn-outline" href={stepHref('print', id)}>Open the printed materials</a></section>
    <section className="panel track vic"><p className="label vlabel">With VIC</p><h2>VIC teaches the same goals</h2><p>Pick students below. VIC teaches this lesson’s objectives one-on-one, from a new angle, at each student’s level: Support, On level or Enrichment.</p></section>
   </div>
   {classroom === false ? <section className="panel"><h2>VIC needs a school classroom</h2><p>Your account isn’t linked to a school classroom yet, so you can’t send lessons to students. Ask your school leader for a join code, or <a href="mailto:drrobfurman@gmail.com?subject=VIC%20classroom%20access">ask about classroom access</a>.</p></section>
    : vicError ? <p className="alert" role="alert">{vicError} <a href={stepHref('plan', id)}>Open the lesson</a></p>
    : vic ? <section className="panel roster"><VICClassroomWorkspace assignmentMode prefillLesson={vic} onAssigned={n => { setMsg(`Sent to ${n} ${n === 1 ? 'student' : 'students'}. You can pick another group and send again.`); mark('teach', true); setSentCount(c => c + 1) }} /></section>
    : classroom && <p role="status">Getting your classes ready…</p>}
   {classroom && <section className="panel"><p className="label">Student work</p><h2>Worksheets on screen</h2><StudentProgress lessonId={id} refreshKey={sentCount} /></section>}
   <div className="next"><a className="btn btn-primary" href={stepHref('follow', id)}>Next: follow up →</a></div>
  </>}
  <style jsx>{`
   .tracks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
   .track{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
   .me{border:2px solid var(--vic-primary)}
   .vic{border:2px solid var(--vic-vic)}
   .vlabel{color:var(--vic-vic)}
   .roster{padding:8px}
   .next{display:flex;justify-content:flex-end}
   @media(max-width:760px){.tracks{grid-template-columns:1fr}}
  `}</style>
 </PageShell>
}
