import { useRouter } from 'next/router'
import { useState } from 'react'
import PageShell, { PanelStyles } from '../../components/PageShell'
import LessonSteps from '../../components/LessonSteps'
import LessonCompanion from '../../components/LessonCompanion'
import { useLesson } from '../../lib/use-lesson'

// Step 4 · Follow up: adjust tomorrow and tell families, both already about this lesson.
export default function LessonFollowUp() {
 const router = useRouter(), id = typeof router.query.id === 'string' ? router.query.id : ''
 const { lesson, home, error, markStep } = useLesson(id)
 const [err, setErr] = useState('')
 async function mark(step, done) { try { await markStep(step, done) } catch (e) { setErr(e.message) } }

 return <PageShell title="Follow up" currentPath="/lesson">
  <PanelStyles />
  {error ? <p className="alert" role="alert">{error} <a href="/lessons">Back to My Lessons</a></p> : !lesson ? <p role="status">Opening your lesson…</p> : <>
   <LessonSteps lessonId={id} lesson={lesson} home={home} current="follow" onMark={mark} />
   {err && <p className="alert" role="alert">{err}</p>}
   <div className="cards">
    <section className="panel"><p className="label">Tell one family</p><h2>A letter about one student</h2><p>Pick the student, tap what’s true, and VIC writes a letter about this lesson. You review it before it goes.</p><a className="btn btn-primary" href={`/parentletters?mode=student&lesson=${encodeURIComponent(id)}`}>Write a student letter</a></section>
    <section className="panel"><p className="label">Tell every family</p><h2>A class update</h2><p>One short note for every family: what we’re learning and a question to ask at home.</p><a className="btn btn-outline" href={`/parentletters?mode=class&lesson=${encodeURIComponent(id)}`}>Write a class letter</a></section>
   </div>
   <section className="panel"><LessonCompanion lessonId={id} tools={['next', 'family']} initialKind="next" showPacket={false} compact /></section>
  </>}
  <style jsx>{`
   .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
   .cards .panel{display:flex;flex-direction:column;gap:10px;align-items:flex-start}
   @media(max-width:760px){.cards{grid-template-columns:1fr}}
  `}</style>
 </PageShell>
}
