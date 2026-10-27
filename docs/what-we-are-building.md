# What AskVic is — agreed direction (Oct 20, 2026; updated Oct 21)

Decided with Dr. Rob Furman. Read this first. It supersedes the direction in
`virtual-room-spec.md`, which is shelved.

## Update, Oct 21 — read this before the rest

These decisions change parts of the Oct 20 text below. Where they disagree, this
section wins.

- **Business and passion, both.** The **Lesson Designer is the front door**: it is
  what teachers try, feel in five minutes, and ask for. **VIC is the heart**: it
  is what helps students most and what Rob believes in. The home page sells to the
  adult who has never heard of AskVic (teacher or principal) — Designer first,
  VIC as the payoff. Students never need the home page; signed-in people skip it.
- **Teachers design it; students master it with VIC.** Teachers are Designer
  users. Students are the real VIC users. Still being thought through — keep
  testing home page wording on real teachers.
- **Grades 3–12, ELA and math.** That is the current scope of the site (not 3–5,
  not 6–8 as a separate later step).
- **K–2 has started.** `/read-test` is the ten-minute listening experiment from
  "Order of work" step 1 below. Next after a real child tries it: the tap-to-answer
  task format.
- **What the principal and teacher measure:** students **on level**, and the
  **red-flag kids**. Not worksheets turned in. The red-flag rule is not decided —
  Rob is thinking about it; do not build the red-flag card until he signs off on
  the rule.
- **Speed over perfection.** Do the most valuable things in the shortest time, not
  a nine-week plan. Rob reviews from pictures (mock-ups/screenshots) rather than
  logging in as three different people.

### Shipped Oct 21

- Student: VIC opens the exact lesson the student picked; Today groups lessons by
  class.
- Teacher: Today panel with one-tap "Start with class"; My Week step names
  visible.
- Home page: Designer leads, grades 3–12 ELA and math, one "Log in", signed-in
  users go straight to their own home.
- `/read-test` for the K–2 listening experiment.

## Open right now — Oct 27, read before building anything about student data

### The verdict stream is not trustworthy yet. Do not build the dashboard on it.

After the first real day (Oct 26): **85 verdicts in `vic_goal_results`, 13 students, 6
standards, and every single one is `met`.** No `partly`. No `not_yet`.

That is not thirteen children mastering everything. It is censored data, and it breaks
precisely what the principal's card is for. VIC is told to give the verdict "once per lesson,
when you are sure", and `not_yet` requires having taught it two different ways and the child
still cannot do it. So a child who is struggling produces **silence, not a record**. Success
is written down; difficulty is not. The red-flag children are the ones missing from the
table, not the ones in it.

Built on this today, an on-level card would read **100% at grade level** and the children who
need finding would be invisible.

**So the first build is the denominator, not the dashboard.** Record the *attempt*: a row
when VIC starts working a standard with a child, updated as it goes. Then "not met" is a fact
rather than an absence, and the red-flag rule — open since Oct 21 and still Rob's call — can
come from the data instead of a guessed threshold: *attempted four times across two weeks,
still not met.*

### Two things to hold on to when the dashboard does get built

- **`met` is acquisition, not mastery.** It means VIC judged three correct in one sitting;
  nobody knows whether it survives a fortnight. The honest route to "on level" is the spaced
  retrieval already agreed in `assessment-and-privacy-spec.md`: **met, then met again two or
  more weeks later.** That is a claim that stands up to a board, and few others can produce
  it cheaply. Until the second reading exists, do not print the words "on level".
- **The minimum-cell-size-of-5 rule bites hard at this size.** Groups of 11, 13 and 10 mean
  most cuts land under five, and "2 below grade level in fractions" identifies those two
  children to anyone who can count. At Saint Peter's the principal's number has to be about
  **standards and teaching, not children** — "fractions came back not-met more than met this
  week" says where to send a coach without naming a child, and is more use to a principal
  anyway.

### Smaller things still open

- **Shontae's read on the v3.7 change.** Rob went to watch Monday's last class after the fix
  that stops VIC ending a lesson at the first run of right answers. Three questions he took
  in: does VIC keep going now; does deeper/project feel like teaching or like padding; and —
  the important one — watch a struggling child and see whether VIC ever actually says
  `not_yet` or just keeps reframing until something lands.
- **Kyaunna Renee Jefferson (users.id 112)** is still enrolled in Grade 1 Reading ELA and
  Grade 1 Math alongside her Grade 6 roster and Group 5 room classes. Stale from last year;
  remove when there is a quiet moment. Her blank grade level is what made her invisible to
  the room on Monday morning — worth checking nobody else has one.
- **The family note** about the Grades 3–5 teaming move is drafted and needs two decisions
  from Rob: which contact number goes on it, and whether VIC is named in it (it currently is
  not, deliberately — a letter that opens with "we lost a teacher" and then introduces an AI
  invites a parent to connect the two).
- **Four pre-existing test failures** on main: `lesson-designer`, `lesson-import`,
  `staff-setup`, and one teacher-assignment test. Unrelated to recent work, red before it
  started, nobody has looked at them.

## The thesis, in Rob's own words

He has been saying both of these for years, and together they are the whole
product:

> **There are only two ways to increase achievement: more instruction and better
> instruction.**
>
> Better instruction is VIC working alongside teachers. More instruction is VIC
> when the teacher cannot be there.

> **We can no longer teach one class of 25 students. We must now teach 25
> classes of one student.**

Everything below is in service of those two sentences. Anything that does not
serve them is a costume.

## What changed, and why

The Virtual Room — VIC teaching inside a 360° environment that changes per
standard and per child — is **shelved**. The spec stays in the repo as a record;
the code at `/room` stays as a curiosity.

Rob's reaction to the first build was that nothing about it felt like it would
break old-fashioned education. That was the right reaction, and not because the
build was thin, though it was: a panorama with labels on it is a slideshow.

The deeper reason is that the Room's premise is that **place** makes learning
better. Place is an *engagement* lever — it makes a child willing to start. Real,
but modest. It does not make anybody understand anything. Meanwhile the thing
that actually upends the standard model was already built: **a co-teacher.** The
Room was a costume for it.

### What survives from that spec

**The chooser, with the venue taken out of it.** The valuable idea was never
"which planet" — it was VIC reasoning about *this* child and picking how to
teach them. Johnny lives for soccer, so his word problems are about penalty
boxes and his reading passage is about a goalkeeper.

That is personalising the **context** of a lesson, and it needs no panorama. It
is the mechanical form of "25 classes of one student", and it is the single piece
worth lifting out of the Room work.

The rule that kept it honest survives too: VIC may only use a context where the
thing being taught genuinely lives. Area fits a penalty box. Long division does
not.

Also worth keeping from that work: **read-aloud on everything** (`lib/speak.js`,
free, browser voices). Content gated behind reading gives the weakest readers the
least content, which is backwards at every age and fatal below Grade 3.

## Where the grades stand

**3–5 — working.** This is the built product.

**6–8 — cheap.** Standards, plus an understanding that activities should sit at a
harder level. The teaching does not change dramatically from 3–5.

One structural thing to check before a 6–8 school finds it for us: middle school
means a child has five teachers instead of one. Saint Peter's own Grade 6 classes
are all one teacher, so our data hides this. **Who gets the follow-up report on a
child — all five teachers, or none?**

**K–2 — different in kind, and the real ambition.** Rob: *there is a reason they
are called primary and not elementary. They are simply different. Learning to
read rather than reading to learn.*

That distinction decides the design. In K–2 the skill **is** the content: letter
sounds, decoding, sight words, number bonds. Which means the work is
well-defined, hugely repetitive, and needs immediate correction — exactly what a
tireless tutor is good at and exactly what a teacher with twenty children cannot
provide one-to-one.

So K–2 is not the hardest fit for AI tutoring. It may be the **best** one.

Design consequences, non-negotiable:

- VIC speaks, always. Text stays on screen, large, with each word highlighted as
  it is read — that is how emergent reading is taught, not decoration.
- **A K–2 child never types and never dictates.** Every answer is a tap on one of
  two to four big choices, a drag, or a drawing. In Kindergarten the teacher is
  often the input device: the child answers aloud, the adult taps.
- Open speech recognition is a trap at this age — children's voices are
  recognised far worse than adults', and twenty of them in one room is hopeless.
- The real cost is not the interface. VIC's brain currently produces teaching
  prose; K–2 needs it to produce a **task** — a spoken prompt, two to four
  choices, which is right, what picture goes with each. A second output format,
  not a second stylesheet.

## The feature that matters most: VIC listens to a child read

Every primary teacher wants one-to-one reading time and can never get enough.
Twenty children needing five minutes each of reading aloud with correction is a
hundred minutes a day she does not have. It is why schools beg for reading
volunteers.

**Why this is tractable when open dictation is not:** you already know what the
words are supposed to be. It is not free transcription, it is checking whether
the child said the expected word — a far easier problem and substantially more
accurate.

**Test it crudely before building anything.** One child, one page they can mostly
read, a laptop, and see what the browser actually hears. If it can tell a clean
read from a stumble, this is the most valuable thing on the roadmap. If it
mangles a seven-year-old, that is a ten-minute lesson instead of a month.

## "More instruction" splits in two, and only one half is safe

**When the teacher cannot be there — build this.** The substitute did not show
up. Every principal has had that Tuesday: the day becomes a babysitter handing
out worksheets and instruction drops to roughly zero. But the lesson plan is
already in AskVic and VIC already teaches it, so the day does not have to be
lost.

It replaces *nothing*, so there is no equity problem — every child in the room
gains. An adult is still present, so it is supervised. And it is an acute,
budgeted, universally felt pain that schools already spend heavily on. A
principal selling to principals can say "when your sub doesn't show, the lesson
still happens," and nobody else can, because nobody else has the lesson plans and
the teacher in one system.

Same for the child out for two weeks with mono, in hospital, or suspended. Today
they get a packet. They could get the actual lesson.

**Evenings — careful.** "More instruction at home" sounds unarguable and is not.
The children who use it at 7pm are disproportionately the ones with a device,
wifi, and a parent who makes them sit down; the children who need it most are
disproportionately the ones without. That is the documented pattern for homework
and for every extra-practice program, and it **widens** gaps rather than closing
them.

Also a different safety surface: the VIC safety alert emails the teacher, which
was designed for school hours. A child disclosing something at 9pm on a Saturday
needs a different answer.

Not never. But measure *who* uses it before treating usage as a win.

## The caveat on 25 classes of one

Personalisation's failure mode is isolation. A child genuinely in a class of one
loses what classrooms are for: hearing another child think, being wrong in
company, arguing about an answer.

**Personalise the practice. Keep the thinking communal.** Twenty-five classes of
one for the drilling; one class of twenty-five for the conversation. That is the
defensible version of the line, and the one that survives a challenge from a
stage.

## Standards coverage (as of Oct 21, 2026)

**Done: ELA and math, K–8, for most states.** Built-in and sourced from the official documents:

- Common Core (CCSS): 601 standards (math 228, ELA 373). Covers the many states that use Common Core or a close copy.
- Florida B.E.S.T.: 527 standards, audited against the official PDFs on Oct 20 (37 missing math benchmarks added).
- Pennsylvania Core: 596 standards, audited against the official documents; already complete.

Teachers in any other state can still paste a standard.

**Not started: science and social studies.** The standards screen only accepts reading/ELA and math today. Nothing for science or social studies exists in the catalogue, for any state. This matters most for grades 6–8, where those are separate classes.

Also not in yet: the Common Core "Literacy in History/Social Studies" and "Science and Technical Subjects" standards for grades 6–8. They are in the PDF Rob supplied and are the natural first step into those subjects.

Rule that stays: standards come from the official documents, never written by VIC. See `scripts/audit-lesson-standards.py` and `scripts/import-ccss-*.py`.

## Order of work

1. **Test reading-aloud recognition** with one real child. Ten minutes. Decides
   the size of the K–2 prize.
2. **Read-aloud buttons on the existing student lesson view.** An afternoon,
   using code that already exists. Helps struggling Grade 3 readers immediately
   and makes Grade 2 semi-viable.
3. **6–8 standards.** A couple of weekends, and AskVic becomes a K–8 story.
4. **Sub coverage** — "the lesson still happens". The business case. *(Built Oct 23 — see
   "Sub coverage" below.)*
5. **K–2 properly**, once 1 has told us whether listening works.

Not on this list: the Virtual Room.

## VIC Room — live Oct 22, first real day Monday Oct 26

Saint Peter's lost its Grade 5 teacher and moved Grades 3–5 to a teaming model: 34 students in
three groups (3/4: 11, 4/5: 13, Group 5: 10). Each group has three classes in AskVic:
Math & Science (Karen Green), ELA & Social Studies (Sandra Morgan), VIC & IXL (Shontae Mack, aide).
Class ids 36–44. Old Grade 3–5 classes are renamed "(old)" with grade_level null; 7 students
Rob believes are Grade 2 (Amarah Charles, Donae Taylor, Florencia Pierre, John P Louis, Kenzie
Morris, Kenny Morris Jr, Kyrie Hadden) are in Grade 2 classes and still in the (old) ones until he
confirms. Backup of the pre-move enrollments: table enrollment_backup_20261022.

- Room "VIC & IXL Room", code HPXJ5U, all 9 classes, staff Shontae (users.id 178).
- Students log in at /hello (room code once per computer, then name + two pictures).
- /room is the aide's screen: working / quiet / not logged in / needs you, Launch today's
  planned lessons, notes for VIC, picture cards, unlock.
- Practice path: Reading/Math practice in the VIC & IXL class; Florida B.E.S.T. skills from what
  Green/Morgan planned for the group, then the child's own grade (users.grade_level).
- VIC brain v3.7 records met / partly / not yet per lesson in vic_goal_results. This is the
  evidence for the principal's on-level and red-flag card (red-flag rule still Rob's call).
- Teachers: plan 3/4 as Grade 3 and 4/5 as Grade 4 so Launch finds the right class.

## Sub coverage — built Oct 23

"When your sub doesn't show, the lesson still happens." Item 4 in the order of work.

**What Rob asked for (Oct 23), in his framing:** any principal in any school, however they got
their sub, hands that person the day's lessons — either a teacher already on staff who is
covering a period, or a stranger who needs credentials for the day. The admin makes the
connection. The sub can start the lesson with the children, or have them use VIC with no
lesson at all. Beyond grabbing it and turning it on, the sub needs no access to the lesson.

**What was already true, and decided the shape:** the VIC Room's "Launch today's planned
lessons" is this mechanic. Shontae uses other teachers' lessons every day; a sub uses them for
one day. Same plumbing, different duration — so the launch logic moved to
`lib/lesson-launch.mjs` (`plannedToday`, `launchLesson`) and the room now calls it rather than
owning its own copy.

**The credential is a printed slip, not an account.** Rob picked this over emailing a link: a
sub at 7:30 may have no school email and no time. `cover_grants` holds the day, the classes,
who is covering and an 8-character code; the code *is* the credential, sent with every request.
Nothing to set up, nothing left behind, and it stops working at the end of its day.

- `/cover` — the covering adult's screen: their classes, today's lesson per class, one button.
- `/school/cover` — the principal makes a slip (pick a teacher to select all their classes, or
  classes one at a time — a class is a period), sees live slips, and can take one back.
- A grant permits exactly one thing: launching those classes' own teachers' planned lessons.
  It cannot read the teacher's plan (title and objective only), reach a class not on the slip,
  or work on another day. Tested in `test/cover-api.test.mjs`.
- No lesson planned, or a lesson without a standard and objective: the screen says so and
  points at VIC practice, which students start themselves. Nothing for the adult to do.

**Not built, deliberately:** a coverage dashboard. Saint Peter's has no sub pool, so "do we
have a sub?" is a decision Rob makes that morning, not a field. The dashboard already shows
who is here, late and out, and that is enough. For the same reason sub coverage got no nav
item of its own — see the dashboard rework, still to be designed.

**Groundwork that had to come first:** `ap_staff` (attendance) and `users`/`classes` (teaching)
are two lists of the same people, joined only at `ap_staff.auth_user_id`, which was unset for
most of the staff — so an absence could not be walked through to the classes it leaves
uncovered. Migration `20261023120000` linked 12 active staff by matching email, Sandra Morgan
and Shontae Mack among them. Amber Manuel has no AskVic login at all, which the printed-code
route handles without one.

**Still open here:** surfacing a slip on a covering teacher's own `/teach` screen, so staff who
do have logins need not type a code; and whether a sub should be recorded for payroll.

## First real day, Oct 26 — VIC was finishing lessons in ten minutes

Shontae's report from the VIC Room's first period: VIC teaches well, but the time frame is far
too short. It asked a couple of questions, the student got them right, it said the skill was
complete and to move on — and then there was nothing. Rob: even when a child seems to
understand it, we do not want them done in 10–20 minutes, and we do not want VIC to stop
teaching. It should either go deeper into the concept or work a project with the student.

Two causes, and only one of them was VIC.

1. **The student page announced it.** On any goal verdict, `/askvic` showed a large
   "⭐ Skill done! Ready for the next one?" banner with a "Next skill →" button. That is the
   "skill complete, move on" Shontae saw, and it fired the moment a verdict arrived — which is
   early by design. Now a quiet line that says VIC is taking it further, with a plain "Switch
   to a different skill" for a child who really is finished.
2. **The brain treated the verdict as a bell.** The goal tag is evidence for the adults, but
   emitting it read as the end of the lesson, and its own rules said to tell the student "what
   comes next". New **AFTER THE GOAL TAG** section (brain v3.7): the tag never ends a lesson,
   VIC must not say the skill is complete or offer another skill, and on `met` it continues on
   the same standard either by GO DEEPER (harder and non-routine cases, the edges, why it
   works, another representation, teach-it-back, find-the-error, two ideas at once) or by
   BUILD SOMETHING (Mini Project Mode). Where it fits the student chooses which.

Also: **Mini Project Mode was capped at "2–5 minutes, 1–3 steps" and "do NOT assign long
projects"** — so even the enrichment path was built to be brief. It is now the body of a
lesson rather than a lap of honour: several turns, real decisions, at least three meaningful
steps, nothing hurried to its end and no busywork padding either.

**The line that is deliberately kept:** a child who says they want to stop may stop. VIC offers
the deeper version or the project once, then stops warmly. The fix must not become a trap —
"learning continues until the student chooses otherwise" still holds. What changed is that VIC
is never the one who suggests the exit.

**Not changed, on purpose:** what earns `met` (still three correct in a row unaided). The
complaint was about stopping, not about the verdict being wrong, and the verdict is the
evidence stream behind the principal's on-level card. Guarded by `test/vic-brain.test.mjs`.

## Later: Hiring (employment and interviews), Oct 22

Rob built a teacher hiring system for Saint Peter's Academy (repo `DrRobF/SaintPetersAcademy`:
`app/employment`, `lib/employment-screening.ts`, `components/employment/EmploymentInbox.tsx`).
It has an employment inquiry form, invitation links to a recorded video screening (five
questions, up to five minutes each, plus résumé and consent), and a private staff inbox where
reviewers score each answer 1–5 with notes and move a candidate to second round, hold or not
advancing. Rob wants it in AskVic as another perk for school leaders. Not started — talk it
through with Rob after the current work is clean.

## Still open

- The red-flag rule for the principal's "on level / red flag" card (Rob, Oct 21).
- Home page wording that says both halves: Designer for teachers, VIC for students.
- Who receives a child's follow-up report in a middle school with five teachers.
- Whether the context chooser gets its own approval flow, or just quietly
  personalises and logs what it chose.
- What a 9pm disclosure to VIC should do differently from a 10am one.
