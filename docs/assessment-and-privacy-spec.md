# What VIC knows about a child — agreed design (Oct 19, 2026)

Decided with Dr. Rob Furman. This is the agreed plan. Build against it; don't
change it without asking him.

## The idea in one line

**Assessment without testing.** VIC knows what a child can do because she worked
through it with them and watched where they hesitated — not because they got
question 7 wrong.

Rob's framing, and it is the right one:

> VIC will know a student much like a teacher does, not like a test does. Tests
> know right answers and wrong answers. A teacher can tell you that Johnny needs
> help with this standard or that one *and why* — and that teacher intuition is
> also useful for knowing why this child needs this extra bit of whatever they
> need.

Every adaptive platform already does know-the-data-then-fill-the-gap. IXL does
it; so do Khan, i-Ready and the rest. But all of them learn about the child from
**scored items** — a right answer, a wrong answer, a response time. The child is
a vector of correctness.

Here the evidence comes from teaching. That is the claim, and it is defensible.
Don't overclaim "first ever"; claim *assessment without testing*.

## Why this is the next thing built

AskVic currently produces a great deal of teaching and captures almost nothing
about learning. The lesson planner builds weeks, VIC teaches, worksheets print,
walkthroughs happen — and the evidence about an actual child amounts to "Johnny
completed it." That is attendance for a worksheet, not knowledge.

VIC already has the real evidence and throws it away: she talked to him.

It is also a **dependency of the venue chooser** (see `virtual-room-spec.md`
§0). VIC cannot pick a good room for Johnny if all she knows is that he likes
soccer. Knowing "gets area, stalls when he has to choose which numbers to use"
makes every venue choice and every lesson sharper.

## The Follow up step

Plan → Print → Teach → **Follow up**. The fourth box is the weakest link in
every lesson flow ever shipped, this one included.

After a lesson, VIC writes the teacher two sentences about *this* child: what
they can do, and where they stopped.

> "Johnny can find area when the numbers are given. He stalls when he has to
> decide which numbers to use — he asked me twice which side was the length."

A teacher with 25 children cannot know that about all 25. VIC can.

## Behavior and evidence, never traits

**The most important rule in this document.** Every statement describes what
happened and cites the moment it came from.

| Write this | Never this |
|---|---|
| "Johnny asked twice which side was the length." | "Johnny struggles with problem-solving." |
| "He stalled when the problem had two steps." | "He lacks spatial reasoning." |
| "She finished early and asked for a harder one." | "She's one of the bright ones." |

The left column is a fact about a moment a teacher can check and a parent can
picture. The right column is a **diagnosis of a child** — and neither VIC nor
anyone here is licensed to make one. No labels, no trait language, no
predictions about what a child will be able to do later.

The error class matters. A wrong quiz score is a wrong number. **A wrong
sentence about a child is a story a parent carries for years.** Parents forget
scores; they never forget "his teacher said he struggles with…".

Rob's note, worth keeping: the data backing a statement will always be more
impactful than an opinion statement — and he hopes teachers will write the same
way.

## Who sees what

| | Sees |
|---|---|
| **Teacher** | Everything about their own students |
| **Parent** | Their own child only, and only statements the teacher chose to send |
| **Principal** | Progress by school, grade level and teacher. **No individual children** — except around a parent/teacher meeting about that child |
| **Student** | Their own work and what VIC said to them |

**The teacher decides what goes to families.** VIC drafts; the teacher picks
which statements are sent and can edit them. Nothing reaches a parent
automatically. This is the same rule already standing for staff emails and for
venue picks — VIC proposes, a human disposes, three times over now.

### The principal's single-student view

Allowed, around a meeting, with two conditions:

1. **A reason line.** The principal types why they are opening this child's
   record right now, before it opens.
2. **The teacher sees it.** The access, with its reason, appears to the
   teacher — not as a permission request, which would add friction and make the
   principal ask, but as a visible record after the fact.

Trust survives, nobody waits for approval, and the norm enforces itself.

### Aggregate is not anonymous at this size

"Grade-level progress, no individuals" breaks in a small school. If 4th grade
has 18 children and the dashboard says *"2 students below grade level in
fractions,"* the teacher knows exactly who, and so can anyone who can count.

**Rule: do not display a cell below a minimum of five children.** Show "fewer
than 5" instead of the number. Otherwise this is individual visibility with
extra steps, after teachers were promised otherwise.

## Gap filling must never become a remediation treadmill

A child who is behind gets served more fractions, then more fractions, then more
fractions — and never gets the interesting thing, because the engine decided
they had not earned it. That is how a child learns they are the dumb one, from
an algorithm nobody meant to be cruel.

**Rule: every child gets both, every week — something to close and something to
stretch — regardless of how far behind they look.** Never pure remediation.

This is also the difference from the platform already in the building. IXL will
grind the gap. VIC closes the gap *and* takes the child somewhere.

## Alongside it: spaced retrieval

VIC knows what Johnny learned three weeks ago. Nobody in elementary school
systematically brings it back — the curriculum marches forward and September has
evaporated by November.

Two minutes at the start of a lesson: "remember this?", drawn from *that
child's* own history rather than a generic review sheet. Retrieval practice is
one of the strongest and cheapest effects in the research literature, and almost
nobody implements it well because it requires knowing what each individual child
did and when. AskVic knows.

Small build. Compounds every week it runs.

## What not to build

**More lesson production.** There is plenty. Production was the bottleneck a
year ago; it is not now. More ways to generate plans make the product bigger
without making one child learn more.

## Still open

- Whether a child ever sees VIC's written statement about them, or only the work
  and the conversation. Current answer: not yet, and never a statement a parent
  has not seen first.
- How long statements are kept. The virtual-room rule is "not past the unit";
  the follow-up record probably needs to live longer to be useful, which means
  deciding a real retention period.
- Whether parents can reply to a statement, and who reads it if they do.
