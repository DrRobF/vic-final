import Head from 'next/head'
import { useEffect, useState } from 'react'
import VICHeader from '../components/VICHeader'

// One place to learn what AskVic does, get set up, and get unstuck.
// Three tabs so nobody faces a wall of text. Deep links: /help#tour, /help#start, /help#stuck.

const TABS = [
 { id: 'tour', label: 'What VIC does' },
 { id: 'start', label: 'Get started' },
 { id: 'stuck', label: 'I’m stuck' },
]

const DOORS = [
 { who: 'Teachers', what: 'Plan, teach, send', why: 'A week of lessons, VIC in your classroom, family letters, your own PD.' },
 { who: 'School leaders', what: 'Run the building', why: 'Lesson plans, walkthroughs, staff check-in, payroll, accounts.' },
 { who: 'Students', what: 'Learn with VIC', why: 'Today’s work from their teacher, plus VIC teaching it another way.' },
 { who: 'Anyone', what: 'Try it free', why: 'Build a real lesson in the Lesson Designer before signing up.' },
]

const TOUR = [
 {
  title: 'VIC, the co-teacher', tag: 'The heart of AskVic',
  lead: 'While you work with one small group, VIC teaches another. Not a quiz bot: a teacher that comes at the same objective from a different angle.',
  points: [
   ['Teaches, never drills.', 'A story, an analogy, a real-life example. When a student is stuck, VIC re-teaches a new way instead of asking the same question again.'],
   ['Three levels, one lesson.', 'You set each student to Support, On level, or Enrichment. VIC adjusts the steps, pacing, and challenge to match.'],
   ['Uses what kids care about.', 'Tell VIC a student loves music or soccer, and the examples and word problems are built around it.'],
   ['Sees their work.', 'Students can draw on the Sketch pad and send it. VIC looks at the drawing and responds to exactly what they did.'],
   ['Shows real math pictures.', 'Fraction bars, side-by-side comparisons, number lines, and multiplication arrays appear when they help.'],
   ['Trusts a right answer.', 'A correct answer is accepted right away, even with steps skipped, then VIC moves the student forward.'],
  ],
 },
 {
  title: 'Student safety', tag: 'Always on',
  lead: 'If a student tells VIC they are being hurt, want to hurt themselves, or feel unsafe, VIC stops the lesson and responds with care.',
  points: [
   ['The teacher is emailed right away', 'with the student’s exact words, the class, and the time.'],
   ['VIC never promises secrecy.', 'He tells the student their teacher will know, and points them to a trusted adult, 911 for danger right now, and 988.'],
   ['Two safety nets.', 'VIC’s own judgment, plus a check on the words the student typed, so one miss is not a miss.'],
   ['Every alert is recorded,', 'even if an email fails, so nothing disappears quietly.'],
  ],
 },
 {
  title: 'Planning', tag: 'Teachers',
  lead: 'Build a full week in one pass, in your school’s own lesson format.',
  points: [
   ['My Week:', 'set a standard or topic for each day, then Build my week. Every lesson follows Plan → Print → Teach → Follow up.'],
   ['13 teaching approaches,', 'from I do · We do · You do to jigsaw, stations, 5E, and Socratic seminar.'],
   ['Extras written in full:', 'vocabulary cards, rubrics, substitute plans, organizers, exit tickets with answers, and a note home.'],
   ['Florida B.E.S.T. and PA Core', 'built in for K–8 reading and math. Any other standard can be pasted in.'],
   ['Send to your principal', 'in one click, with the whole week as a Word document.'],
  ],
 },
 {
  title: 'Families and follow-up', tag: 'Teachers',
  lead: 'The writing around teaching that eats your evenings.',
  points: [
   ['VIC Learning Reports:', 'strengths, a growth target, next steps, and real evidence from the student’s sessions with VIC.'],
   ['Family letters', 'for one student or the whole class, drawn from your notes and VIC’s reports.'],
   ['Assistant:', 'plan your week, draft a message, or prepare for a meeting.'],
   ['Learning Paths:', 'short PD on any topic, with every video and article link checked before you see it.'],
  ],
 },
 {
  title: 'Leading the school', tag: 'School leaders',
  lead: 'The half most people never find on their own.',
  points: [
   ['Lesson plans:', 'every week your teachers send, ready to read or download.'],
   ['Walkthroughs:', 'quick visits and specific feedback, with a suggested Learning Path you choose whether to assign. You see completed or not, never quiz scores.'],
   ['Staff check-in kiosk:', 'a code at the front door. No check-in means absent, with one click to mark the reason.'],
   ['Payroll:', 'hours straight from check-in, exported for whoever runs payroll.'],
   ['Accounts:', 'add staff and students one at a time, import a roster, or hand out a join code.'],
  ],
 },
]

const START = [
 {
  who: 'Teachers', steps: [
   ['Log in', 'at askvic.ai with the Teacher log in button.'],
   ['Join your school.', 'Right after you log in, My Week shows a “Join your school” card. If your principal added your email, it is one click. Otherwise type the code from your principal. Until you join, your lesson plans cannot reach your principal.'],
   ['Open My Week', 'and set the grade, subject, and a standard or topic for each day. Mark days with no lesson as “no lesson.”'],
   ['Build my week,', 'then read and edit each day. VIC writes the draft; you are still the teacher.'],
   ['Send it.', 'When every day is finished, “Send to administration” appears at the bottom of My Week.'],
   ['Bring VIC into class', 'from My Classes: create a class, add students, set each student’s level, and assign a lesson.'],
  ],
 },
 {
  who: 'School leaders', steps: [
   ['Log in', 'with School leader log in at askvic.ai/school-login.'],
   ['Set up your school', 'from ⚙ Setup: staff list, schedules, and the check-in kiosk.'],
   ['Add your teachers,', 'or share your school’s join code (Setup shows it). Seats count only staff who actually log in.'],
   ['Create student accounts', 'one at a time or by roster import, under Setup → Teachers & students.'],
   ['Watch the dashboard.', 'Lesson plans, walkthroughs, and attendance all land there.'],
  ],
 },
 {
  who: 'Students', steps: [
   ['Go to askvic.ai/student-login', 'and type the username and password from your login card.'],
   ['Today', 'shows the lessons your teacher sent you.'],
   ['Choose Teacher Lesson', 'to learn what your teacher assigned, or My Own Work for homework help and anything else.'],
   ['Set your interest', '(music, sports, games…) so VIC can use it in examples.'],
   ['Use your workspace:', 'Sketch to draw, Practice to work problems, Notes to save ideas, and the Calculator.'],
  ],
 },
]

const STUCK = [
 ['I can’t find the button to send my lesson plans to my principal.', 'The send button is only on My Week (askvic.ai/lessonplan/week), not on a single lesson. It appears at the bottom after every day is finished. A day with no lesson still counts if you mark it “no lesson.” If it still is not there, you have not joined your school yet: use the “Join your school” card at the top of My Week, or go to askvic.ai/join.'],
 ['My name is on the staff list, but my principal says I haven’t joined.', 'Being on the list and joining are different. Your principal added your name; joining connects your account. Open My Week: if your principal used the same email you log in with, a card offers one-click join. If not, type the school code in that card, or go to askvic.ai/join.'],
 ['I got “The activity sequence was incomplete.”', 'VIC now retries automatically when this happens, so it should be rare. If you still see it, pick at least one activity in the customize panel and build again. Your previous draft is still saved.'],
 ['A student can’t log in.', 'Students log in at askvic.ai/student-login, not the teacher page. Check the username on their card. Passwords are all lowercase, like happy-tiger-47. A school leader can reset any student password in Setup → Teachers & students.'],
 ['VIC is talking about a different topic than my lesson.', 'The student is probably in My Own Work. Have them switch to Teacher Lesson at the top of their screen. VIC teaches the assigned lesson only in Teacher Lesson, and only after you have assigned one to their class.'],
 ['I got a VIC safety alert email. What do I do?', 'Check on the student today and follow your school’s reporting procedures. VIC flags anything that might mean a child is unsafe, so some alerts will be false alarms, but every one deserves a look. VIC does not replace your counselor or your mandated-reporting duties.'],
 ['Can my principal see my drafts or my Learning Path quiz scores?', 'No. Leaders see only the weeks you send. For Learning Paths they see completed or not completed and your own reflection, never your quiz score.'],
 ['Does VIC send emails to families without me?', 'No. Every letter is a draft you read, edit, and send yourself.'],
 ['Is student information safe?', 'AskVic never sells data or shows ads, and our AI provider does not train on your content. VIC conversations are not stored by the AI provider. The full details are in the Privacy Policy.'],
 ['Text is too small.', 'Use the text-size control in the top bar once you are signed in.'],
]

export default function Help() {
 const [tab, setTab] = useState('tour')
 useEffect(() => {
  const fromHash = () => { const h = window.location.hash.replace('#', ''); if (TABS.some(t => t.id === h)) setTab(h) }
  fromHash()
  window.addEventListener('hashchange', fromHash)
  return () => window.removeEventListener('hashchange', fromHash)
 }, [])
 function choose(id) {
  setTab(id)
  try { window.history.replaceState(null, '', `#${id}`) } catch {}
 }
 function onKey(e, i) {
  const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : -1
  if (n < 0) return
  e.preventDefault()
  choose(TABS[n].id)
  document.getElementById(`tab-${TABS[n].id}`)?.focus()
 }

 return (
  <main className="help">
   <Head>
    <title>Help & guide | AskVic</title>
    <meta name="description" content="Everything AskVic does for teachers, school leaders, and students, how to get started, and answers when you are stuck." />
   </Head>
   <VICHeader currentPath="/help" />

   <section className="hero">
    <p className="eyebrow">Help & guide</p>
    <h1>Everyone who logs in sees a different AskVic.</h1>
    <p className="lead">Teachers get a planner and a co-teacher. Leaders get the school. Students get today’s lesson. If you only found one part, here is the rest.</p>
   </section>

   <div className="tabs" role="tablist" aria-label="Help sections">
    {TABS.map((t, i) => (
     <button key={t.id} id={`tab-${t.id}`} role="tab" type="button" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => choose(t.id)} onKeyDown={e => onKey(e, i)}>{t.label}</button>
    ))}
   </div>

   <section id="panel-tour" role="tabpanel" aria-labelledby="tab-tour" hidden={tab !== 'tour'}>
    <div className="doors">
     {DOORS.map(d => <div key={d.who} className="door"><span className="who">{d.who}</span><strong>{d.what}</strong><span>{d.why}</span></div>)}
    </div>
    {TOUR.map(s => (
     <article key={s.title} className="card">
      <div className="cardHead"><h2>{s.title}</h2><span className="tag">{s.tag}</span></div>
      <p className="cardLead">{s.lead}</p>
      <ul>{s.points.map(([b, t]) => <li key={b}><strong>{b}</strong> {t}</li>)}</ul>
     </article>
    ))}
   </section>

   <section id="panel-start" role="tabpanel" aria-labelledby="tab-start" hidden={tab !== 'start'}>
    <div className="starts">
     {START.map(r => (
      <article key={r.who} className="card">
       <h2>{r.who}</h2>
       <ol>{r.steps.map(([b, t]) => <li key={b}><strong>{b}</strong> {t}</li>)}</ol>
      </article>
     ))}
    </div>
   </section>

   <section id="panel-stuck" role="tabpanel" aria-labelledby="tab-stuck" hidden={tab !== 'stuck'}>
    <div className="faq">
     {STUCK.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
    </div>
    <p className="more">Still stuck? Ask your school leader, or read the <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms</a>.</p>
   </section>

   <style jsx>{`
    .help{max-width:1100px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px))}
    .hero{padding:34px 4px 22px;display:grid;gap:12px}
    .eyebrow{margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--vic-primary)}
    h1{margin:0;font-family:var(--font-head);font-size:clamp(30px,5vw,46px);line-height:1.1;letter-spacing:-.02em;max-width:22ch;text-wrap:balance}
    .lead{margin:0;font-size:18px;line-height:1.6;color:var(--vic-text-secondary);max-width:62ch}
    .tabs{display:flex;gap:6px;overflow-x:auto;padding:6px;margin:6px 0 22px;background:var(--vic-surface-muted);border:1px solid var(--vic-border);border-radius:14px;width:fit-content;max-width:100%}
    .tabs button{flex:0 0 auto;padding:10px 18px;border-radius:10px;border:0;background:transparent;color:var(--vic-text-secondary);font-family:var(--font-head);font-weight:700;font-size:16px;cursor:pointer;white-space:nowrap}
    .tabs button[aria-selected="true"]{background:var(--vic-primary);color:#fff}
    .tabs button:focus-visible,summary:focus-visible{outline:3px solid var(--vic-cyan);outline-offset:2px}
    section[role=tabpanel]{display:grid;gap:16px}
    section[hidden]{display:none}
    .doors{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
    .door{display:grid;gap:5px;padding:18px;border-radius:14px;background:var(--vic-ink);color:var(--vic-ink-text)}
    .door .who{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--vic-cyan)}
    .door strong{font-family:var(--font-head);font-size:19px;color:#fff}
    .door span:last-child{font-size:15px;line-height:1.5;color:var(--vic-ink-muted)}
    .card{min-width:0;padding:22px 24px;border-radius:16px;background:var(--vic-surface);border:1px solid var(--vic-border);display:grid;gap:10px}
    .cardHead{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
    h2{margin:0;font-family:var(--font-head);font-size:24px;letter-spacing:-.01em}
    .tag{font-size:13px;font-weight:800;padding:4px 10px;border-radius:999px;background:var(--vic-primary-soft);color:var(--vic-primary);white-space:nowrap}
    .cardLead{margin:0;font-size:17px;line-height:1.6;color:var(--vic-text-secondary);max-width:68ch}
    ul,ol{margin:0;padding-left:22px;display:grid;gap:9px;font-size:16px;line-height:1.6;color:var(--vic-text-secondary);max-width:72ch}
    li strong{color:var(--vic-text-primary)}
    .starts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start}
    .faq{display:grid;gap:10px}
    details{border:1px solid var(--vic-border);border-radius:14px;background:var(--vic-surface);padding:4px 20px}
    summary{cursor:pointer;padding:14px 0;font-weight:800;font-size:17px;line-height:1.4;color:var(--vic-text-primary);list-style-position:outside}
    details[open] summary{color:var(--vic-primary)}
    details p{margin:0 0 16px;font-size:16px;line-height:1.65;color:var(--vic-text-secondary);max-width:72ch}
    .more{margin:8px 4px 0;color:var(--vic-text-secondary)}
    .more a{color:var(--vic-primary);font-weight:700}
    @media(max-width:600px){.card{padding:18px}.tabs{width:100%}}
   `}</style>
  </main>
 )
}
