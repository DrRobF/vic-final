# The Virtual Room — agreed design (Oct 18, amended Oct 19, 2026)

Decided with Dr. Rob Furman, principal of Saint Peter's Academy (grades 3–5).
This is the agreed plan. Build against it; don't redesign it without asking him.

Rob's mantra governs everything here: **cool technology has to be an academic
advantage, not just cool.** Anything that fails that test gets cut, however
good it looks.

Budget is **zero dollars up front.** Every asset named below is free and
license-clean. Rob has 15–20 hours a week, after a full principal's day.

## Why

Rob has wanted this for thirty years: AI as the teacher, a virtual world as the
classroom, augmented reality as the resources, and the human teacher as the
facilitator of discussion, emotion and discipline. AskVic already has the hard
part — a teaching brain, standards, a lesson designer, and reporting back to the
human. What it doesn't have is a room to teach in.

This is that room — and, more importantly, the thing that decides which room.

## 0. The venue chooser — this IS the product

A teacher says: *"teach Johnny standard 2.3."*

VIC reasons about three things, then picks a place:

- what the concept actually is
- who this child is — what they care about, where they are
- which room on the shelf lets that concept be **physically present**

The classroom becomes that place and VIC teaches there.

Johnny lives for soccer, so area happens on a pitch, measuring the penalty box —
a real rectangle with real dimensions. The child at the next desk gets two rocks
on Mars and the distance between them. Same standard, same hour, different
worlds.

**The intelligence is not in the room. It is in choosing the room.** That is the
engine. Everything else in this document is plumbing for it.

This is explicitly *not* a content library. We are not building lessons in
places; we are building the thing that reasons about how to teach and where it
will land hardest.

### The rule that keeps it honest

**VIC may only choose a venue where the thing being taught physically exists in
that venue.**

- Area → the penalty box. The rectangle is really there.
- Measurement → two Mars rocks. The distance is really there.
- Long division → not a soccer pitch. Nothing on a pitch is long division.

If the concept cannot be found in the place, VIC picks a different place or
teaches it plainly. This is the mantra enforced by the engine rather than by
anyone's discipline at 10pm.

### Variety takes care of itself

Decided Oct 19: **no "stretch" dial.** The standard constrains the venue, so a
year of standards produces a year of varied places on its own — social studies
and science standards mostly will not fit a pitch. Watch one thing only: a lot
of grade 3–5 *math* fits a soccer pitch, so a soccer-mad child could end up
living there for math specifically. Observe that before building anything to
counter it.

### Whole-group discussion still works

The standard is shared even when the venue isn't. The human teacher asks
"Johnny, how did you find area on a pitch? Maria, how did you do it on Mars?"
Several representations of one concept is stronger teaching than everyone having
done the identical thing. The personalisation makes the group discussion richer,
not thinner.

## 0a. Who decides, and how the teacher signs off

VIC proposes, the teacher disposes. She does the reasoning and makes the call,
but nothing reaches a child until a human has had the chance to look. This is
the same rule already standing in AskVic for emails — the principal approves
every one, nothing sends itself. A venue choice is a pedagogical judgment and
gets the same treatment until trust is earned.

This lives inside the existing lesson flow, at the Plan step, where the teacher
is already handing lessons to VIC.

### The toggle

**Let VIC decide** (the default) or **Teacher decides.**

- **Teacher decides** — one dropdown sets the venue for the whole class, then
  individual children can be overridden. The per-child dropdown lists *the rooms
  where this standard physically fits* first (see §0's rule — it prunes the list
  automatically, usually to a handful), with "all rooms" underneath for the
  teacher who wants to be stubborn.
- **Let VIC decide** — VIC picks for every child, then the teacher approves with
  a single whole-class button, or changes one child or several from their own
  dropdowns. Teaching does not start until she has signed off.

### The approval screen must be a scan, not a form

An approval nobody reads is worse than no approval: it adds a click and supplies
false assurance. A teacher planning a week faces five lessons across 25 children
— she will not read 125 justifications, and pretending otherwise builds
friction without safety.

So the task is **scanning for outliers**, not approving items. One screen, one
row per child: venue name and a six-word reason. Ten seconds to read, tap
whatever looks wrong.

**VIC flags her own uncertainty.** "Confident on 23, unsure about 2." The
teacher then looks at two. That turns 25 decisions into 2, and it is honest —
VIC genuinely knows when a standard only barely fit a room.

### Autonomy is earned, not assumed

The default is **Let VIC decide**, because a default nobody changes decides the
product, and teacher-decides-by-default means the engine never gets used.

But every teacher starts in a mode where the reasoning is shown prominently.
After roughly forty approved picks with no changes, VIC offers: *"you haven't
changed a pick in a while — want me to go straight ahead on whole-class
lessons?"* Front-load the scrutiny, then let it relax once it has been earned.

### Log every override

When a teacher changes a pick, record what VIC chose, what the teacher chose
instead, the standard, and the child.

Two things at once:

- **The only feedback loop on the chooser.** Venue choice is taste and cannot be
  unit tested, so overrides are the sole signal for whether VIC is reasoning
  well. Without this, the differentiator is unmeasurable.
- **A sales number.** "Teachers changed VIC's choice 4% of the time last month"
  is the most persuasive line available if it's low, and a bug report found
  before a customer finds it if it's high.

### Build the chooser before the UI

Sequence matters here. First make VIC pick and log her reasoning somewhere only
Rob can see it. Read fifty picks. *Then* build the approval screens — once it's
known whether her reasoning is worth showing a teacher at all.

The whole UI above is roughly a week of evenings. It is the right week, but it
must not land inside the same week as the chooser itself, or week 3 becomes
week 6.

## 0b. What gets stored, and when

**Sunday produces decisions, not content.**

A venue pick is one row — lesson, student, room, reason, confidence, who
approved it and when. Roughly 250 bytes. One teacher's week of 5 lessons × 25
children is about 30 KB; a 20-teacher school is about 600 KB a week, or on the
order of 100,000 rows a year. Postgres does not notice this, and VIC holds
nothing between picks — each reasoning pass is built, used and discarded.

Pre-generating the actual *taught* lesson would be the mistake: children get
sick, plans shift, and a four-day-old generated lesson is stale. The teaching is
generated when the child sits down, so it can account for everything that
happened since Sunday.

### Batch the picks per lesson, not per child

The real cost is reasoning calls, not storage. Done naively that is 125 calls
for one teacher's week; batched into one call per lesson it is 5 — a 25×
reduction.

Batching is also better teaching. Seeing the whole roster at once, VIC can
spread venues across a class, avoid putting everyone in the same room, or
deliberately place two children in the same place so they can compare notes
afterwards. Per-child calls make 25 blind decisions with no sense of the class.

### Re-validate at teach time

A pick approved on Sunday can be stale by Thursday. If the roster changed, VIC
picks for the new child and flags it in the teacher's next view, rather than
silently having no venue.

### ELA standards are one strong wrapper — not the product

Social studies has no budget. ELA has budget and panic. But the wrapper isn't a
dodge — it's better practice than what most schools do:

Reading comprehension runs on background knowledge, not free-floating skill.
The classic demonstration is Recht & Leslie (1988), where children who knew
baseball out-comprehended stronger readers who didn't. E.D. Hirsch built a
career on the same finding. Schools that cut social studies to buy more
comprehension drilling ended up drilling comprehension on passages with nothing
in them to comprehend.

So where a room carries rich content, assessing it against ELA standards is a
strong play: the content *is* the reading instruction, and ELA is where the
budget and the panic live. But it is one wrapper among several, not the
product's definition. A kitchen teaching fractions is not an ELA lesson and
doesn't need to be.

**Don't promise reading test gains in year one.** Background knowledge pays off
over years. Promise what can actually move fast: writing quality, use of
evidence, oral language, engagement.

## The filter — every room must pass all three

1. Could this be taught as well with a photo and a worksheet? If yes, don't
   build the room.
2. Does the room let a student **do** something impossible in a classroom —
   not see, *do*?
3. **Would this room still earn its place if it were ugly?**

Question 3 is the real test. If the pedagogy survives bad graphics, the pedagogy
is load-bearing. The research on multimedia learning says decorative detail
*reduces* learning, so the zero-dollar version is likely to teach better than a
funded competitor's beautiful one. That is a feature, not a consolation.

## 1. Screen first. Headset never required.

Same lesson, same URL, three tiers:

- **Tier 1 — Chromebook.** 360° environment on screen, drag to look around.
  This is the version that gets used Monday morning. Build this one.
- **Tier 2 — phone.** Augmented reality artifacts. A free 3D scan plus Google's
  `model-viewer` puts a Roman object on the kid's desk in about two lines of
  code. No app install.
- **Tier 3 — headset, if a school happens to own them.** The browser on a
  headset runs the same page. Costs nothing extra to support. This is the demo
  tier, not the product tier.

Reasons headsets are not the product: shared headsets need sanitising between
every child, teachers report being afraid of the hardware, and schools lack the
charging, storage, repair and device-management maturity to run them at scale.
Also, headset makers set minimum ages that rule out part of a 3–5 building.

## 2. The room is a prop list, not a picture

This is the single most important architectural decision.

Right now VIC teaches blind — she works in text and has no idea what's around
the student. A room must be **machine-readable to VIC**: a manifest of objects,
each with a position, a name, and what it is good for teaching.

```
room: colosseum-floor
props:
  - id: arch-entry      look: [-40, 0]   teaches: [engineering, crowd-flow]
  - id: water-channel   look: [120, -10] teaches: [aqueducts, daily-life]
  - id: crowd-tier      look: [0, 15]    teaches: [spectacle, social-class]
```

With a manifest, VIC can say "turn around and look at that," and can notice the
student never did. Without it, she's narrating into the dark.

The manifest is also the business. A room that is a *list* can be aimed at any
standard, so one Rome serves fifty lessons. **That is the engine.** A content
library is a treadmill; an engine is a product.

## 3. Stateless world, persistent notebook

Do **not** build a world with state. The room is the same static files every
visit.

What persists is the **student's notebook** — what they wrote, what they
collected, what VIC noticed. That makes "we're still in Rome this week" feel
real while costing almost nothing to store.

## 4. Audio is required, and it's free

Browser speech synthesis is built into every Chromebook, iPad, Mac and Windows
machine. No API, no account, no bill.

**Every piece of text gets a speaker button.** This is not optional. The whole
academic argument is that content builds comprehension — if the content is gated
behind reading, the weakest readers get the least content, which is exactly
backwards.

Free voices are flat and will mispronounce "Colosseum" and "Juvenal." Ship it
anyway and find out whether the children care. If VIC's own voice later turns
out to matter: her scripted lines never change, so generate those once with a
paid voice and serve them as cached audio files. Pay once for what's fixed, free
for everything else.

Speech *recognition* is free in the same browser API. Offer it for the student's
spoken account (see below) — an 8-year-old's thinking is bottlenecked by typing
speed, not by ideas. But recognition is weaker on children's voices and useless
in a room of twenty talking at once, so always fall back to typing.

## 5. One lesson pattern: the eyewitness sequence

One good pattern among many — worth writing down because it shows what a room
buys you that a worksheet cannot. It is not the product and not the only shape
a lesson takes.

1. The student **witnesses** an event — a chariot race, a Senate vote.
2. VIC asks what they saw. The student gives **their own account**, spoken or
   typed, *before seeing any source.*
3. *Then* the primary sources arrive — and they disagree with each other **and
   with the student.**
4. Point of view is no longer a vocabulary word. It's a conflict the student is
   personally inside of. They were there, and they still got it wrong, and VIC
   gets to ask why.

Step 2 is impossible on a worksheet. That is the room earning its place.

### One room, three grades — the dial is the standard, not the room

Point-of-view standards escalate across 3–5 almost exactly along this design:

| Grade | What the standard asks | What the room does |
|---|---|---|
| 3 | distinguish your own point of view from the author's | the student's account vs. one source |
| 4 | compare firsthand and secondhand accounts of one event | their account vs. one ancient account |
| 5 | analyse multiple accounts, comparing points of view | two ancient accounts that also disagree |

Fill in the exact standard codes for whatever framework Saint Peter's is held
to. The progression is the point.

### Sources at a 3rd-grade reading level

Juvenal in translation is middle-school-plus. Don't hand that to an 8-year-old —
show **both**: VIC's plain-English version in large type, the real line beneath
it in smaller type, labelled "here's what he actually wrote."

Grade 3 reads VIC's version. Grade 5 reads both. The curious kid reads the real
one and feels like they got away with something. Adapted primary sources are
standard practice, and this builds the on-ramp to the eventual 5–8 market
without building anything twice.

## 6. Where the writing happens

**Beside the room, not in it.** Split screen: environment on one side, the
student's writing on the other, source visible while they write. Works on a
Chromebook, survives the move to a headset later (you cannot type in goggles),
and matches how writing actually works — look at the thing, write about the
thing.

The writing is the point, commercially. Every writing teacher fights the blank
page: "write a persuasive essay" produces nothing because the child has nothing
to be persuaded about. The room hands them something they witnessed, evidence to
cite, and a reason to care.

Positioning follows from that: this is not a virtual classroom. It is **a
writing program with a time machine attached.** "Virtual classroom" is a demo.
"My kids finally have something to write about, and I'm not grading sixty drafts
alone" is a purchase order.

## 7. The room shelf

VIC's range is the shelf's range — she can only choose from rooms that exist.
But the shelf does not need to be big. Roughly twenty rooms likely covers most
of grades 3–5:

> a soccer pitch · a basketball court · a kitchen · a grocery store ·
> a construction site · a garden · a stage · a library · a newsroom ·
> a workshop · a beach · a forest · a city street · Mars · the Moon ·
> a school hallway · a cafeteria · a playground · a museum hall · ancient Rome

That is a weekend of shooting plus a few downloads — not a content library. To a
nine-year-old, VIC choosing well among twenty is indistinguishable from
infinite, because the child never sees the shelf, only the choice. Then it grows
from teachers rather than from Rob. That is the network effect, and it is how he
avoids becoming a content factory.

### The constraint that eliminates most of the internet

A room needs the **image file**, because VIC has to stand in it under a prop
manifest. Almost every beautiful "virtual tour" online is somebody's embedded
viewer, not a file — Google's national parks, Google's and ESA's ISS tours, the
museum tours. Link-only is useless here.

After five hunts, two sources are verified:

**NASA / JPL planetary surfaces.** A real full 360° panorama from Curiosity's
position on Mars, stitched by JPL from 26 navcam frames, direct JPEG and TIFF
download, credit NASA/JPL-Caltech. NASA content is generally not copyrighted and
free for educational use. Rules: credit NASA, never use the NASA insignia or
seal, and watch for third-party images — NASA marks those with the copyright
holder's name.

**Rob's phone.** Unlimited, free, legally his outright, no attribution, and
re-shootable when a shot is bad. A lab is a lab. A newsroom is a table, a chair
and a camera. This is where most of the shelf comes from, and the only source
that scales without money.

**A trap:** the prettier Mars panoramas circulating (the Mars360 / Perseverance
stitches) are third-party work with **no stated license**, even though the source
frames are NASA's. Raw JPL only.

### Rome stays on the shelf

It is a good room — scale, crowd and spectacle are exactly what a map flattens —
and it was briefly the whole plan, so two corrections are recorded here:

- **Chariot races were at the Circus Maximus, not the Colosseum.** The Colosseum
  hosted gladiatorial games and beast hunts; its arena is far too small for a
  chariot track. The Circus Maximus today is a public park with the original
  track roughly six metres below the modern surface, so there is nothing there
  to photograph.
- **A photograph of the modern ruins does not show a child ancient Rome.** A Rome
  room has to be built from public-domain reconstruction art, or deliberately as
  a then-and-now pairing. Note also that gladiatorial content is a parent
  conversation at grades 3–5; chariot racing is spectacle without the death.

### Other free, license-clean sources

- **The Met Open Access** — 492,000+ images under CC0, free REST API. Roman
  coins, busts, mosaics, armour. <https://www.metmuseum.org/openaccess>
- **Smithsonian Open Access** — thousands of free 3D models; anything marked CC0
  is free to take and remix, any purpose. <https://3d.si.edu>
- **Historical primary sources, public domain and translated** — Project
  Gutenberg, Perseus, LacusCurtius. For a Rome room: Juvenal (who coined
  "bread and circuses" — about the chariot races, not the Colosseum),
  Suetonius, Tacitus, Pliny.
- **Panoramas** — Wikimedia Commons has a 360°-equirectangular category of
  roughly 540 freely-licensed files, but licences vary per image and the
  collection skews to European churches and city squares. Worth a proper dig
  when a specific room needs one; not yet verified as a dependable source.
- **Code** — three.js / A-Frame / WebXR, `model-viewer`, browser speech. All
  free and open source.
- **Hosting** — Vercel and Supabase, already paid for.

**Cash cost of the first rooms: zero.** A phone-shot room is always free and
always legally clean, which is why the shelf should lean on Rob's own camera and
treat third-party panoramas as a bonus rather than a dependency.

## 8. Accessibility and clutter

- **Colorblind-safe, always.** Never color alone — fill plus symbol plus word.
  Roughly one boy in twelve is red-green colorblind, so this serves students as
  well as Rob.
- **Calm, uncluttered screens.** One thing to do at a time. This is both an
  8-year-old requirement and Rob's own.
- Speaker button on every piece of text. Keyboard reachable. No drag-only
  interactions.

## 9. Data: collect almost nothing

For the pilot, store **only** the student's writing and their conversation with
VIC. No gaze tracking, no attention logging, no behaviour analytics.

Attention data — where a student looked, what they picked up, where they stalled
— is genuinely the most interesting thing a room could produce, and is a real
future advantage. It is also a very different conversation when the students are
8 to 11 years old. Park it. Less to build, less to defend, and under-13 data is
its own legal animal.

When it is added: it goes to the teacher as "here's where Marcus stalled," never
to a dashboard, never stored past the unit, and parents are told in plain
English what's collected. Same instinct as the principal dashboard rule that
leaders see completion and reflection, never scores.

## 10. Consent before any child touches it

**Written parent permission**, even at Rob's own school, even though it feels
like overkill. He is the principal testing his own product on his own students.
If this becomes the story he tells on a stage — and it should — he wants to be
able to say it was clean from day one.

## Build order

The real deliverable is **not software. It's footage.** A video of a real child
being taught something in a place that made them care about it — the moment they
stop performing school and start actually working. Nobody buys software from a
demo. They buy it from that child's face.

**Week 1 — the shell.** One room rendering on screen, draggable, five or six
props from a manifest, speaker buttons on everything. Use the NASA Mars
panorama: the file exists and is verified, so there is zero asset friction and
nothing to hunt.

**Week 2 — the real experiment.** Re-skin that shell with a room Rob shot on his
own phone. A hallway, the cafeteria, anything. **If swapping Mars for a school
hallway takes one evening, there is an engine and a product. If it takes a week,
there is a one-off.** Better to know that in week two than in month six. The
first room proves nothing; the second room proves everything.

**Week 3 — the chooser, with no UI at all.** VIC takes a standard and a child
and picks from a shelf of three rooms, logging her choice and her reason where
only Rob can see them. Three rooms is enough to judge the reasoning. What is
being tested is the *choice*, not the scenery.

Then read fifty picks before writing any interface. If VIC picks badly, that is
a week of approval UI saved on a feature that needed rethinking first.

**Week 4 — one lesson, one child, filmed.** End to end, in front of a real kid,
while it is still rough.

**Week 5 — the approval flow** (§0a), once the picks have earned an audience:
the toggle, the whole-class button, the outlier-scan screen, the override log.

**Do not build the room-builder yet.** Hand-build the first few rooms, prove the
chooser reasons well, then automate making rooms.

### What to measure, and it is not comprehension

The venue does not make the mathematics clearer. It makes the child *willing to
do* the mathematics. Venue is an engagement lever, not a comprehension lever.

Measure engagement accordingly: time on task, whether they started without
prompting, how far they got before quitting, whether they asked a question
nobody required of them. Measuring comprehension alone will show nothing and
lead to the wrong conclusion — and for a disengaged nine-year-old, engagement is
not a side effect, it is the whole thing, because a child who will not start
learns nothing however good the instruction.

## Standing rules carried over from AskVic

- The teacher approves everything. Nothing sends itself.
- Free perks for schools are fine: "if it helps the school and doesn't hurt me
  or the program then we give it to them free."
- VIC teaches. She does not quiz or drill.
- If a student tells VIC something unsafe, the teacher is alerted.

## Still open

- **How many rooms before the chooser feels intelligent rather than lucky?**
  Three is enough to test the reasoning; twenty is the guess for real use. The
  honest number comes out of watching children, not out of this document.
- How teachers contribute rooms — who shoots, who checks the licence, who writes
  the prop manifest. The manifest is the hard part to delegate.
- Whether the 5–8 band gets its own rooms or just harder standards on the same
  ones.
- Decided and no longer open: **each child gets their own room.** One shared
  synchronised space means networking, voice, moderation and a child standing on
  the table. Solo is also better teaching — a private tutor at the child's own
  pace — and discussion then happens in the real room with the human, who now
  knows who to call on. AI teaches, human facilitates.
