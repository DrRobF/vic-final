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
4. **Sub coverage** — "the lesson still happens". The business case.
5. **K–2 properly**, once 1 has told us whether listening works.

Not on this list: the Virtual Room.

## Still open

- The red-flag rule for the principal's "on level / red flag" card (Rob, Oct 21).
- Home page wording that says both halves: Designer for teachers, VIC for students.
- Who receives a child's follow-up report in a middle school with five teachers.
- Whether the context chooser gets its own approval flow, or just quietly
  personalises and logs what it chose.
- What a 9pm disclosure to VIC should do differently from a 10am one.
