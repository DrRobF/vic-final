import Head from 'next/head'
import { useEffect, useState } from 'react'
import VICHeader from '../../components/VICHeader'

// The VIC walkthrough: nine stations a teacher works through in order, doing the thing
// rather than reading about it. Built for a staff session where everyone has a laptop open,
// and left here afterwards for anyone who joins later.
//
// Progress is per-browser (localStorage). It is a confidence aid, not a record: nobody is
// marked or checked up on, and clearing it changes nothing anywhere else.

const KEY = 'askvic-tutorial-progress'

const STATIONS = [
 {
  id: 'access',
  n: 0,
  title: 'Can you see VIC Room?',
  mins: 2,
  why: 'Everything in station 6 and 7 happens on one screen called VIC Room. Three kinds of people can open it, and you may already be one of them without knowing. Thirty seconds now saves a scramble later.',
  steps: [
   ['Look at the top bar.', 'Log in at askvic.ai, then read across the top of the screen. You are looking for VIC Room.'],
   ['If it is there, you are done.', 'Open it once so you have seen it, then come back. You already have everything stations 6 and 7 need.'],
   ['If it is not there, say so now.', 'Tell whoever is running this session. You are not missing a setting you can fix yourself — someone has to add you to the room.'],
  ],
  see: 'VIC Room in the top bar, and a screen with the room name and a code on it.',
  note: 'You get in three ways: you are a school leader, you teach one of the classes in the room, or your name was added to the room’s staff list. The first two happen on their own — which is why teachers who teach a class in the room often already have it.',
  does: 'Confirm you can open VIC Room, or raise your hand.',
 },
 {
  id: 'around',
  n: 1,
  title: 'Find your way around',
  mins: 5,
  why: 'Everyone who logs in sees a different AskVic. Knowing which door leads where means you stop hunting for the button that was never on that screen.',
  steps: [
   ['Log in at askvic.ai', 'with the Teacher log in button.'],
   ['Read the top bar, left to right.', 'My Week is your planning. My Lessons is everything you have built. My Classes is your students and their levels. Families is everything you send home. VIC Room is the screen for running a room.'],
   ['Check you have joined your school.', 'Open My Week. If a “Join your school” card is sitting at the top, you have not joined yet — one click if your principal used your login email, otherwise type the school code. Until you join, your plans cannot reach your principal.'],
   ['Find the text size control', 'in the top bar, and make it bigger if that helps. It stays that way.'],
  ],
  see: 'My Week with no “Join your school” card on it.',
  does: 'Name out loud what is behind each item in the top bar.',
 },
 {
  id: 'plan',
  n: 2,
  title: 'Plan a lesson VIC can actually teach',
  mins: 12,
  why: 'This is the station that matters most, and not for the reason you would guess. A lesson missing a standard or an objective looks finished to you and is invisible to VIC — so the day someone covers your class, their screen says “needs a standard and objective, ask the teacher” and there is nothing they can press.',
  steps: [
   ['Open My Week', 'and choose Plan the whole week, or Make one lesson if you only want one.'],
   ['Set a grade, a subject, and a standard or topic', 'for each day. Mark any day with no lesson as “no lesson” — a blank day stops the week from being finished.'],
   ['Press Build my week,', 'then read what came back and change it. VIC writes a draft; you are still the teacher.'],
   ['Check two fields on today’s lesson: the standard and the learning objective.', 'Both filled in. This is the whole difference between a lesson VIC can teach and one it cannot.'],
   ['Notice the four steps on every lesson:', 'Plan, Print, Teach, Follow up. You will use Print in station 4 and Teach in station 3.'],
   ['When every day is finished,', '“Send to administration” appears at the bottom of My Week.'],
  ],
  see: 'A lesson with a standard and a learning objective, both filled in.',
  note: 'Florida B.E.S.T. and PA Core are built in for K–8 reading and math. Any other standard can be pasted in. There are 13 teaching approaches to pick from, and the extras — vocabulary cards, rubrics, exit tickets with answers, a substitute plan, a note home — are written out in full, not as headings.',
  does: 'Build one real lesson you could teach, with a standard and an objective.',
 },
 {
  id: 'send',
  n: 3,
  title: 'Send VIC’s version to your students',
  mins: 10,
  why: 'The same objectives, taught one-to-one from a different angle, while you work with somebody else. This is the co-teacher part, and it is the point of the whole thing.',
  steps: [
   ['Open your lesson and go to the Teach step.', 'You will see two tracks: With me, and With VIC. They are not alternatives — most lessons use both.'],
   ['Pick your class,', 'then pick the students who should get VIC’s version.'],
   ['Set each student’s level:', 'Support, On level, or Enrichment. VIC changes the steps, the pacing and the challenge to match. Same objective for all three.'],
   ['Press Assign lesson.', 'You should get a count back: “Sent to 6 students.” You can pick a different group and send again at a different level.'],
   ['Scroll to Student work', 'to watch worksheets come in on screen.'],
  ],
  see: '“Sent to N students”, and those students listed with their levels.',
  note: 'If you see “VIC needs a school classroom”, your account is not linked to a classroom yet — that is a join-your-school problem from station 1, not something wrong with the lesson.',
  does: 'Send one lesson to at least two students at two different levels.',
 },
 {
  id: 'print',
  n: 4,
  title: 'The paper side, and teaching from the screen',
  mins: 8,
  why: 'You can run this lesson with a packet in your hand, with everything on the children’s screens, or both at once. Nobody has to choose the way you do not like working.',
  steps: [
   ['Open the Print step of your lesson.', 'The teacher packet, the student copies, and every worksheet level are already sorted and ready to copy.'],
   ['Press Print everything', 'and look at what comes out before you send 30 copies to the copier.'],
   ['If it says “No worksheet yet”,', 'press Create worksheets — it makes one per level from the lesson’s Plan step.'],
   ['Now open the lesson in the live view', 'to see the other way: Show the class puts the current activity on the board, Next activity moves you along, and the screen keeps your materials separate from what students can see.'],
   ['Notice what students got.', 'Anyone you sent the lesson to in station 3 also has their version of the worksheet on screen, at their level.'],
  ],
  see: 'A printable teacher packet, and worksheets grouped by level.',
  does: 'Print one packet, and open the live view once.',
 },
 {
  id: 'login',
  n: 5,
  title: 'Get a room full of kids logged in, fast',
  mins: 10,
  why: 'This is where a VIC session falls apart if nobody has practised it. Done right it is about four minutes for a whole group; done wrong you lose twenty and three children are locked out.',
  steps: [
   ['Set up each computer once.', 'Open askvic.ai/hello and type the room code from the top of the VIC Room screen. That computer remembers it — you never type it again.'],
   ['Get the picture cards ready first.', 'In VIC Room, open the Logins and picture cards tab. “Give random pictures to everyone who needs them”, then Print picture cards.'],
   ['Keep the cards with you, not on the desks.', 'The two pictures are the child’s password. On a desk, they are everyone’s password.'],
   ['Each child taps their name, then their two pictures, in order.', 'Order matters. A greyed-out name means that child has no pictures yet.'],
   ['Know the lockout before it happens.', 'Five wrong picture taps locks a child out for five minutes. In VIC Room a “🔒 locked out” bar appears with Unlock everyone on it. You are standing right there, so just clear it.'],
  ],
  see: 'A child logged in and looking at VIC, without you typing anything on their behalf.',
  note: 'You can choose a child’s two pictures yourself instead of taking the random ones — tap the child in VIC Room and use “Choose their pictures yourself”. Worth doing for a child who will remember a cat and a star but not whatever the computer picked.',
  does: 'Log in one student yourself, start to finish, including printing the cards.',
 },
 {
  id: 'run',
  n: 6,
  title: 'Run the room',
  mins: 15,
  why: 'This is the screen Shontae uses every day. Once the children are on, everything you do for the next hour is on this one page.',
  steps: [
   ['Open VIC Room and stay on the Live tab.', 'Every child is a tile. Working, Quiet, Not logged in, or Needs you — each with its own symbol, and it refreshes every 15 seconds on its own.'],
   ['Start the planned work.', 'Today’s lessons lists what each class’s own teacher planned. Press Launch. It changes to “✓ On screens”.'],
   ['If nothing was planned, you are not stuck.', 'Under “Their own next skill”, press Start reading or Start math. Every child begins on their own next standard — what their teacher taught most recently first, then the rest of their level. It is per child, so eleven children start in eleven different places.'],
   ['Press it twice if you like.', 'A child already working carries on rather than being handed a second thing. Harmless.'],
   ['Read the message you get back.', 'If a child could not be started, it names them and says why. Everyone else has already started.'],
   ['Steer VIC with a note.', '“Note for everyone” for the group — for example, practice 7s and 8s multiplication facts. Tap one child for a note about only them. VIC picks it up on that child’s next message.'],
   ['Tap a child and look.', 'What they are on, how many messages today, skills met / partly / not yet, their notes, their pictures.'],
   ['Change how VIC teaches one child.', 'On that panel: working level (the grade VIC teaches from, up or down), the language VIC explains in, and read-aloud. Takes effect on their next message.'],
  ],
  see: 'Tiles moving to Working, and a note you added showing up on a child.',
  note: 'Do not expect VIC to stop early. After a run of right answers it keeps going — harder cases, a different angle, or a small project. A child who genuinely wants to stop may stop. And if a child tells VIC something worrying, their teacher is emailed straight away; you do not have to watch for it.',
  does: 'Launch or start practice, add a note for everyone, open one child and change their working level.',
 },
 {
  id: 'sub',
  n: 7,
  title: 'When you are the one covering',
  mins: 10,
  why: 'Someone is out and the room is yours for the day. There are two ways this reaches you, and they are not equally good — so know which one you are holding.',
  steps: [
   ['The normal way here: just open VIC Room.', 'If you can see it in your top bar (station 0), you already have everything. Launch the absent teacher’s planned lesson, or press Start reading or Start math. There is no code and nothing expires. This is what Shontae does every day.'],
   ['The other way: a printed slip with an 8-character code.', 'Go to askvic.ai/cover, type the code, press Open today’s lessons. You get one card per class and a Start this lesson button. No account needed — which is the point, because it is built for someone who has never heard of AskVic.'],
   ['Know what the slip cannot do, before you need it.', 'It can start a planned lesson, and that is all. No list of who is working. No Start reading or Start math — if nothing was planned, or a child finishes early, there is nothing on that screen for you to press. No notes for VIC. No way to help a child who cannot log in.'],
   ['So know the two answers before you need them.', 'A child who mis-taps their pictures five times is locked out for five minutes and then it clears by itself — wait, do not go looking for a button. A child who finishes early, or who has no card at all, needs someone with VIC Room: the teacher next door, the office, or whoever set the room up. That is a real limit of the code route, and it is the reason to use VIC Room instead whenever you can.'],
   ['So if you can use VIC Room, use VIC Room.', 'Only fall back to a code if you genuinely have no access — at another school, or a day nobody added you.'],
   ['A code works for that day only', 'and shows nothing but the lessons for the classes on the slip. Close the tab and it is gone.'],
  ],
  see: 'Either the full VIC Room, or the cover screen with one card per class.',
  note: 'The other half of this is what you do for whoever covers YOU: plan the day with a standard and an objective. Without those two fields their screen says “needs a standard and objective” and the person standing in your classroom has nothing to start.',
  does: 'Open VIC Room as if you were covering, and launch someone else’s planned lesson. Then say out loud what you would do if a child finished in five minutes.',
 },
 {
  id: 'home',
  n: 8,
  title: 'Email home — one child, or everybody',
  mins: 12,
  why: 'The writing around teaching, which is the part that eats your evenings. Three kinds of message, all of them a draft you read before anything moves.',
  steps: [
   ['Open Families from the top bar.', 'Three choices across the top: Quick email from notes, One student letter, Whole-class letter.'],
   ['Quick email from notes — for one child, fastest.', 'Jot what you want to say in your own shorthand. VIC writes the email. Edit it, then Copy email. Save my edits keeps your version.'],
   ['One student letter — for one child, with the evidence.', 'Choose the class, then the student. It pulls in your notes, the lesson goals, and what VIC has seen in that child’s sessions.'],
   ['Whole-class letter — one letter, every family.', 'Pick what you are learning from your saved lessons, add any reminders and a note of your own, and you get a subject line and a letter. Copy letter when it reads the way you would say it.'],
   ['Do one of each.', 'One single-student message and one whole-class letter. That is the pair you will actually use.'],
  ],
  see: 'A single-student email and a whole-class letter, both edited by you.',
  note: 'Nothing goes to a family on its own. Every letter is a draft you read, edit, and send yourself — VIC never emails a parent. A student’s parent email lives on their row in My Classes.',
  does: 'Draft one email about one child, and one letter to the whole class.',
 },
]

export default function Tutorial() {
 const [done, setDone] = useState({})
 const [open, setOpen] = useState('access')
 const [name, setName] = useState('')
 const [loaded, setLoaded] = useState(false)

 useEffect(() => {
  try {
   const raw = localStorage.getItem(KEY)
   if (raw) {
    const saved = JSON.parse(raw)
    setDone(saved.done || {})
    setName(saved.name || '')
   }
  } catch {}
  setLoaded(true)
 }, [])

 useEffect(() => {
  if (!loaded) return
  try { localStorage.setItem(KEY, JSON.stringify({ done, name })) } catch {}
 }, [done, name, loaded])

 const count = STATIONS.filter(s => done[s.id]).length
 const all = count === STATIONS.length
 const total = STATIONS.reduce((a, s) => a + s.mins, 0)

 function toggle(id) {
  setDone(d => ({ ...d, [id]: !d[id] }))
 }
 function advance(i) {
  const next = STATIONS[i + 1]
  if (next) { setOpen(next.id); setTimeout(() => document.getElementById(`st-${next.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60) }
 }
 function reset() {
  setDone({})
  setOpen('access')
 }

 return (
  <main className="tut">
   <Head>
    <title>VIC walkthrough | AskVic</title>
    <meta name="description" content="A hands-on walkthrough of AskVic for teachers: plan, send, print, get students logged in, run the room, cover a class, and write home." />
   </Head>
   <VICHeader currentPath="/help" />

   <section className="hero">
    <p className="eyebrow">Walkthrough</p>
    <h1>Learn VIC by doing all of it once.</h1>
    <p className="lead">Nine stations, about {Math.round(total / 5) * 5} minutes if you do every one properly. You are meant to have VIC open in another tab and actually press the buttons — reading this without doing it is worth very little.</p>
    <p className="lead small">Your ticks are saved in this browser only. Nobody is marked and nobody is checking.</p>
   </section>

   <div className="progress" role="status" aria-live="polite">
    <div className="bar"><span style={{ width: `${(count / STATIONS.length) * 100}%` }} /></div>
    <p><strong>{count} of {STATIONS.length}</strong> finished{all ? ' — all done.' : ''}</p>
    {count > 0 && <button type="button" className="plain" onClick={reset}>Start over</button>}
   </div>

   <ol className="stations">
    {STATIONS.map((s, i) => {
     const isOpen = open === s.id
     const isDone = !!done[s.id]
     return (
      <li key={s.id} id={`st-${s.id}`} className={`station${isOpen ? ' open' : ''}${isDone ? ' done' : ''}`}>
       <button type="button" className="head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : s.id)}>
        <span className="num" aria-hidden="true">{isDone ? '✓' : s.n}</span>
        <span className="htext">
         <strong>{s.title}</strong>
         <span className="meta">{s.mins} min{isDone ? ' · finished' : ''}</span>
        </span>
        <span className="chev" aria-hidden="true">{isOpen ? '−' : '+'}</span>
       </button>

       {isOpen && (
        <div className="body">
         <p className="why">{s.why}</p>
         <ol className="steps">
          {s.steps.map(([b, t]) => <li key={b}><strong>{b}</strong> {t}</li>)}
         </ol>
         {s.note && <p className="aside"><strong>Worth knowing.</strong> {s.note}</p>}
         <p className="see"><strong>You should be looking at:</strong> {s.see}</p>
         <div className="doit">
          <p className="dolabel">Do this before you move on</p>
          <p>{s.does}</p>
          <div className="row">
           <button type="button" className={isDone ? 'btn btn-outline' : 'btn btn-primary'} onClick={() => { toggle(s.id); if (!isDone) advance(i) }}>
            {isDone ? 'Untick this station' : 'I did it — next station'}
           </button>
          </div>
         </div>
        </div>
       )}
      </li>
     )
    })}
   </ol>

   <section className={`cert${all ? ' ready' : ''}`}>
    <h2>Your VIC certificate</h2>
    {!all ? (
     <p>Finish all nine stations and the certificate appears here. {STATIONS.length - count} to go.</p>
    ) : (
     <>
      <p>All nine done. Put your name on it and print it.</p>
      <div className="row">
       <label htmlFor="cert-name">Your name, as it should read</label>
       <input id="cert-name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" autoComplete="name" />
       <a className="btn btn-primary" href={`/help/certificate?name=${encodeURIComponent(name)}`} aria-disabled={!name.trim()} onClick={e => { if (!name.trim()) e.preventDefault() }}>Open my certificate</a>
      </div>
     </>
    )}
   </section>

   <p className="back">Back to <a href="/help">Help &amp; guide</a>, or the short version under <a href="/help#start">Get started</a>.</p>

   <style jsx>{`
    .tut{max-width:900px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-right,0px)) 60px max(16px,env(safe-area-inset-left,0px))}
    .hero{padding:34px 4px 18px;display:grid;gap:12px}
    .eyebrow{margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--vic-primary)}
    h1{margin:0;font-family:var(--font-head);font-size:clamp(30px,5vw,44px);line-height:1.1;letter-spacing:-.02em;max-width:20ch;text-wrap:balance}
    .lead{margin:0;font-size:18px;line-height:1.6;color:var(--vic-text-secondary);max-width:64ch}
    .lead.small{font-size:15px}
    .progress{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 16px;margin:10px 0 20px;border-radius:14px;background:var(--vic-surface);border:1px solid var(--vic-border);box-shadow:var(--vic-shadow-soft)}
    .progress p{margin:0;color:var(--vic-text-secondary);font-size:15px}
    .bar{flex:1 1 180px;height:10px;border-radius:5px;background:var(--vic-surface-muted);overflow:hidden;min-width:120px}
    .bar span{display:block;height:100%;background:var(--vic-primary);transition:width .25s ease}
    .plain{background:none;border:0;color:var(--vic-primary);text-decoration:underline;font:inherit;cursor:pointer;padding:6px}
    .stations{list-style:none;margin:0;padding:0;display:grid;gap:12px}
    .station{border:1px solid var(--vic-border);border-radius:16px;background:var(--vic-surface);overflow:hidden}
    .station.open{border-color:var(--vic-primary);box-shadow:var(--vic-shadow-soft)}
    .station.done .num{background:var(--vic-primary);color:#fff;border-color:var(--vic-primary)}
    .head{display:flex;align-items:center;gap:14px;width:100%;padding:16px 18px;background:none;border:0;cursor:pointer;font:inherit;text-align:left;color:var(--vic-text-primary);min-height:64px}
    .head:focus-visible{outline:3px solid var(--vic-cyan);outline-offset:-3px}
    .num{flex:0 0 auto;width:36px;height:36px;border-radius:50%;border:2px solid var(--vic-border);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;color:var(--vic-text-secondary)}
    .htext{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
    .htext strong{font-family:var(--font-head);font-size:20px;letter-spacing:-.01em}
    .meta{font-size:14px;color:var(--vic-text-secondary);font-weight:700}
    .chev{font-size:24px;color:var(--vic-text-secondary);font-weight:800;flex:0 0 auto}
    .body{padding:4px 22px 22px;display:grid;gap:14px}
    .why{margin:0;font-size:17px;line-height:1.6;color:var(--vic-text-secondary);max-width:66ch}
    .steps{margin:0;padding-left:22px;display:grid;gap:10px;font-size:16px;line-height:1.6;color:var(--vic-text-secondary);max-width:70ch}
    .steps li strong{color:var(--vic-text-primary)}
    .aside{margin:0;padding:14px 16px;border-radius:12px;background:var(--vic-surface-muted);font-size:15.5px;line-height:1.6;color:var(--vic-text-secondary);max-width:70ch}
    .aside strong,.see strong{color:var(--vic-text-primary)}
    .see{margin:0;font-size:16px;line-height:1.6;color:var(--vic-text-secondary)}
    .doit{padding:16px 18px;border-radius:14px;background:var(--vic-primary-soft);display:grid;gap:8px}
    .doit p{margin:0;color:var(--vic-text-primary);font-size:16px;line-height:1.55}
    .dolabel{font-family:var(--font-mono);font-size:13px;text-transform:uppercase;letter-spacing:.02em;color:var(--vic-primary);font-weight:800}
    .row{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:4px}
    .btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 20px;border-radius:12px;font-weight:800;font-size:16px;cursor:pointer;border:1px solid transparent;font-family:inherit;text-decoration:none}
    .btn-primary{background:var(--vic-primary);color:#fff}
    .btn-outline{background:var(--vic-surface);color:var(--vic-text-primary);border-color:var(--vic-border)}
    .btn[aria-disabled=true]{opacity:.5;cursor:not-allowed}
    .cert{margin:26px 0 10px;padding:24px;border-radius:16px;border:2px dashed var(--vic-border);background:var(--vic-surface);display:grid;gap:12px}
    .cert.ready{border-style:solid;border-color:var(--vic-primary);background:var(--vic-primary-soft)}
    .cert h2{margin:0;font-family:var(--font-head);font-size:24px}
    .cert p{margin:0;color:var(--vic-text-secondary);line-height:1.6}
    .cert label{font-weight:800;color:var(--vic-text-primary);font-size:15px;flex:0 0 100%}
    .cert input{flex:1 1 220px;min-height:46px;padding:10px 14px;border:1px solid var(--vic-border);border-radius:10px;font:inherit;background:#fff}
    .back{margin:20px 4px 0;color:var(--vic-text-secondary)}
    .back a{color:var(--vic-primary);font-weight:700}
    @media(max-width:600px){.body{padding:4px 16px 18px}.head{padding:14px}.htext strong{font-size:18px}}
   `}</style>
  </main>
 )
}
