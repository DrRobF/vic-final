# The Virtual Room — agreed design (Oct 18, 2026)

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

This is that room.

### Why it's an ELA product, not a social studies product

Social studies has no budget. ELA has budget and panic. But the wrapper isn't a
dodge — it's better practice than what most schools do:

Reading comprehension runs on background knowledge, not free-floating skill.
The classic demonstration is Recht & Leslie (1988), where children who knew
baseball out-comprehended stronger readers who didn't. E.D. Hirsch built a
career on the same finding. Schools that cut social studies to buy more
comprehension drilling ended up drilling comprehension on passages with nothing
in them to comprehend.

So: teach rich historical content, assess it against ELA standards. The content
is the reading instruction.

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

## 5. The lesson that only a room can teach

The eyewitness sequence. This is the heart of it.

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

## 7. Why Rome is first

Not because it's the most marketable subject. Because it is the **cheapest
subject that will ever be built**, and the room does real teaching work in it
(scale, crowd, spectacle — things a map flattens).

Free, license-clean asset stack:

- **The Met Open Access** — 492,000+ images under CC0, free REST API. Roman
  coins, busts, mosaics, armour. <https://www.metmuseum.org/openaccess>
- **Smithsonian Open Access** — thousands of free 3D models; anything marked CC0
  is free to take and remix, any purpose. <https://3d.si.edu>
- **Primary sources, all public domain and translated** — Juvenal (who coined
  "bread and circuses," which is *exactly* this lesson), Suetonius, Tacitus,
  Pliny. Project Gutenberg, Perseus, LacusCurtius.
- **Panoramas** — Wikimedia Commons, freely licensed.
- **Code** — three.js / A-Frame / WebXR, `model-viewer`, browser speech. All
  free and open source.
- **Hosting** — Vercel and Supabase, already paid for.

Cash cost of lesson one: **zero.** Later rooms cost more; the Civil War costs
more, climate costs a lot more. Rome has been out of copyright for two thousand
years.

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
witnessing the race, giving their own account, then getting blindsided by two
ancient sources that contradict them — and the look on their face when they
realise they were there and still got it wrong. Nobody buys software from a
demo. They buy it from that child's face.

**Week 1.** One room. Hardcoded, ugly, free panorama, five or six props in a
manifest, VIC teaching with speaker buttons on everything. Grade 4 version only.

**Week 2.** The eyewitness sequence and two adapted sources — *and get it in
front of one child before Friday.* Not the class. One kid, at lunch, on a
laptop, while it's still broken. Six minutes of that teaches more than three
more weeks of building.

**Week 3.** Fix what that child broke. Then three more children. Film one.

**Week 4.** The grade 3 and grade 5 dials, which are cheap now that the room
exists.

**Do not build the room-builder yet.** Build one room by hand, prove the lesson,
then automate. If week 2 slips to week 5, something has gone wrong, and it is
almost certainly that the room-builder got started early.

## Standing rules carried over from AskVic

- The teacher approves everything. Nothing sends itself.
- Free perks for schools are fine: "if it helps the school and doesn't hurt me
  or the program then we give it to them free."
- VIC teaches. She does not quiz or drill.
- If a student tells VIC something unsafe, the teacher is alerted.

## Still open

- **Each student in their own room, or everyone together?** Solo is an order of
  magnitude cheaper — one shared synchronised space means networking, voice,
  moderation and a child standing on the table. Solo is also arguably better
  teaching: every child gets a private tutor at their own pace, and discussion
  happens afterwards in the real room with the human, who now knows exactly who
  to call on. That is Rob's own model — AI teaches, human facilitates. Current
  recommendation: **build solo, keep the shared room as the dream and the
  stage demo.**
- Whether the 5–8 band gets its own rooms or just harder dials on the same ones.
- Which room is second. The free-source constraint should probably pick it.
