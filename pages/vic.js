import PageShell, { PanelStyles } from '../components/PageShell'
import HeroGraphic from '../components/HeroGraphic'

const STEPS = [
 ['Plan the lesson', 'Build it in the Lesson Designer from your standard and objectives, with worksheets for each learning level.'],
 ['Split the room', 'You pull a small group. The rest of the class opens VIC on a Chromebook, tablet or laptop.'],
 ['VIC teaches the same goal', 'A new angle at each student’s level: Support, On level or Enrichment. Real teaching, step by step, not a quiz.'],
 ['You see everything', 'Who worked with VIC, how worksheets are going, and a report for each student you can share with families.'],
]

// Public intro page for the VIC co-teacher, like the Lesson Designer and Assistant pages have.
export default function VicIntro() {
 return <PageShell title="VIC Co-Teacher" description="VIC is an AI co-teacher. While you teach one group, VIC teaches the other students the same lesson goals from a new angle, at their level." currentPath="/vic">
  <PanelStyles />
  <section className="hero">
   <div className="copy">
    <p className="label">VIC Co-Teacher</p>
    <h1>You teach one group.<br /><em>VIC teaches the rest.</em></h1>
    <p className="lead">Small-group instruction works. The hard part has always been the other 20 students. VIC teaches them the same lesson goals from a different angle, one-on-one, at each student’s level, while you teach the group in front of you.</p>
    <div className="row">
     <a className="btn btn-primary" href="mailto:drrobfurman@gmail.com?subject=Bring%20VIC%20to%20our%20school">Bring VIC to my school</a>
     <a className="btn btn-outline" href="/signup">Start free with the Lesson Designer</a>
    </div>
    <p className="small">Already set up? <a href="/login">Teacher log in</a> · <a href="/student-login">Student log in</a> · <a href="/school-login">School leader log in</a></p>
   </div>
   <HeroGraphic variant="vic" />
  </section>

  <section>
   <p className="label">How a VIC lesson works</p>
   <ol className="steps">{STEPS.map(([t, d], i) => <li key={t} className="panel"><span className="num">0{i + 1}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
  </section>

  <section className="two">
   <div className="panel"><p className="label">What students see</p><h2>A calm screen with today’s goal</h2><p>Big, readable text. Their lesson, what they’re learning, and two choices: work with the teacher’s worksheet on screen, or learn it with VIC. Students only see “Version 1, 2, 3,” never a level label.</p></div>
   <div className="panel"><p className="label">What teachers keep</p><h2>You stay in charge</h2><p>You choose the lesson, the students and each student’s level. VIC stays on your objective and redirects off-topic questions. Every student’s work comes back to you.</p></div>
  </section>

  <section className="dark-panel cta">
   <div><h2 className="dh">VIC is set up by your school</h2><p>Your principal creates the classrooms and student logins, then teachers join with a school code. Individual teachers can use the Lesson Designer free today.</p></div>
   <div className="row"><a className="btn btn-volt" href="mailto:drrobfurman@gmail.com?subject=Bring%20VIC%20to%20our%20school">Talk to us about your school</a><a className="btn btn-cyan" href="/join">I have a school code</a></div>
  </section>
  <style jsx>{`
   .hero{display:grid;grid-template-columns:1.05fr 1fr;gap:48px;align-items:center;padding:36px 0 20px}
   h1{font-size:clamp(38px,5vw,60px);line-height:1.04;margin:0 0 18px}
   h1 em{font-style:normal;color:var(--vic-vic)}
   .lead{font-size:19px;line-height:1.65;color:var(--vic-text-secondary);margin:0;max-width:560px}
   .row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px}
   .small{margin-top:16px;font-size:15px;color:var(--vic-text-secondary)}
   .steps{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
   .steps h3{margin:8px 0 6px;font-size:19px}
   .num{font-family:var(--font-mono);color:var(--vic-vic);font-weight:700}
   .two{display:grid;grid-template-columns:1fr 1fr;gap:16px}
   .cta{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}
   .dh{color:#fff;margin:0 0 6px}
   .cta .row{margin-top:0}
   @media(max-width:960px){.hero{grid-template-columns:1fr}.steps{grid-template-columns:1fr 1fr}}
   @media(max-width:620px){.steps,.two{grid-template-columns:1fr}}
  `}</style>
 </PageShell>
}
