# Principal dashboard — agreed design (Oct 15, 2026)

Decided with Dr. Rob Furman, principal of Saint Peter's Academy. This is the
agreed plan. Build against it; don't redesign it without asking him.

Rob has ADHD (calm, uncluttered screens) and is red-green colorblind
(never use red/green to carry meaning).

## Why

The audit found onboarding a staff member took five different pages, there was
no page showing one person's history, absences couldn't be edited, and the
dashboard didn't answer "how is today going?". What a principal wants the moment
he sits down: who's here, who needs me, how my teachers are growing. Setup work
(adding people, codes, sheets, pay rules) matters but belongs behind a button.

## 1. The staff grid (the heart of it)

Every active staff member gets a tile. One group, alphabetical, same position
every day so the eye learns the layout. Tiles refresh on their own each minute,
so you watch them fill in as people arrive.

Colorblind-safe: each state carries fill + symbol + a word. Never color alone.

| State | Fill | Symbol | Label |
|---|---|---|---|
| Here | solid dark blue | check | time in, e.g. "7:22" |
| Late | solid orange | clock | "12 min late" |
| No check-in (needs action) | white, thick dashed border | ! | "No check-in" |
| Out, told us | light diagonal stripes | envelope | "Sick" / "Personal" / "Planned" |
| Not due yet / off today | pale gray, faded | — | "Starts 8:00" / "Off today" |

Blue vs orange is the safe pair for red-green colorblindness, and the shapes and
words still work in black and white.

## 2. "Needs you" strip (above the grid)

Only things needing action, most urgent first, 3–5 items max. A short list means
a good day. Each item links to the person. Sources: no check-in unclassified,
paid days off at or near zero, missing clock-outs, lesson plans not in,
coverage gaps on planned absences, pending day-off requests.

## 3. Slide-out person panel

Clicking a name slides a panel in from the right. It never leaves the grid.

- Today: in at 7:22, minutes late
- Days off: bar showing "6 of 10 left", absences this year, late count this month
- Day-by-day history, newest first (date, in, out, late, or absence type)
- Growth: walkthroughs (count, last date, last "next step"), Learning Paths and
  their status, lesson plans in or missing
- Quick actions: Start walkthrough / Assign Learning Path / Days-left reminder
  (draft only) / Mark a planned absence / Fix a day
- Edit: name, role, assignment, email, phone, start date, emergency contact,
  notes, schedule, pay type, max daily hours, paid days off, check-in code
- Onboarding checklist, with a check per finished piece: email, phone and
  emergency contact, check-in code, paid days off set, AskVic login, joined the
  school, class set up. Shows at a glance what a new hire is still missing.

## 4. Teacher growth

No single score. Rob explicitly does not want one — scores make teachers compare
themselves. Show the elements separately: walkthroughs done, Learning Paths in
progress or finished, lesson plans on time. The dashboard growth strip also
names teachers not visited in 30+ days, so visits stay fair.

## 5. Privacy mode

One click hides days-off balances and growth details, leaving only the tiles and
their states. Principal screens get read by whoever walks into the office.

## 6. Absences: check-in is the source of truth

No check-in on a school day means absent. Period. The Google Form is optional
from here on (keep the connector working — other schools may rely on one — but
Saint Peter's doesn't need it).

Instead, classification happens in one click on the tile:
Sick / Personal / School business / Unpaid / Half day, plus who's covering.
Sick and personal use a paid day; school business does not; unpaid applies once
paid days run out. **An unclassified no-show defaults to Sick** so the day
math stays right, and stays editable afterward.

Planned absences: "Mark a planned absence" in the person panel takes a date or
range, a reason and a coverage note. That day the tile reads "Out (planned)" and
is never flagged. The dashboard shows a coming-up line, and calls out coverage
gaps.

Teachers with a login get "Request a day off" on their own dashboard. The
request lands in the principal's "Needs you" strip to approve or decline, so he
stops typing their absences himself.

## 7. Paid days off rules

One pool per person (stored in ap_staff.sick_days), 10 days at Saint Peter's.
A classified paid absence draws it down. At zero, the principal gets an alert and
payroll starts recording unpaid days. Half days count 0.5.

## 8. Navigation

Dashboard · Lesson plans · Walkthroughs · Payroll, plus a Setup button.
Setup (/school/setup) holds: add a person, check-in codes, kiosks, Google
Sheets links, school hours, pay periods, days-off rules, accounts and
passwords, classrooms, roster upload.

## 9. Students — later, and optional

Deliberately left out for now. Rob will explain how to do it after the rest
ships. AskVic only knows what students do in AskVic; IXL data lives in IXL and
would need an import. Student academics must stay optional, never required.

## Standing rules from Rob

- The principal sends and approves everything. **No email ever sends itself.**
  Drafts only; he hits send.
- Free perks for schools are fine: "if it helps the school and doesn't hurt me
  or the program then we give it to them free."
- Every hourly person has a daily maximum (Mary 3h, Yalonda 2h, teachers 8h),
  paid unless extra time is approved.
- 10 paid days off per person; payroll runs the 1st and 16th.

## Build order — all five done (Oct 15, 2026)

1. Staff profile fields + person-detail API — migration
   20261015150000_staff_profile_fields; actions `person` / `save_profile`;
   per-person history; `days_left` reminder draft.
2. Dashboard (pages/school.js) — tile grid, Needs-you, staff growth, privacy
   toggle, refresh every minute, deep link `/school?staff=ID&tab=...`.
3. Slide-out panel (components/StaffPanel.js) — overview, attendance, growth,
   profile and setup tabs; add a new staff member; onboarding checklist.
4. Absences — migration 20261015160000_staff_day_marks (`ap_day_marks`);
   actions `mark_day` and `plan_absence`; unpaid days in payroll and CSV;
   teacher day-off requests in migration 20261015170000_day_off_requests
   (`ap_day_requests`), /api/educator/day-off, components/DayOffCard.js on
   /teach, and `decide_request` with Approve / Decline on the dashboard.
5. Setup hub (pages/school/setup.js) + nav cut to
   Dashboard · Walkthroughs · Lesson plans · Payroll · ⚙ Setup.

Tile state names in code are `here` / `late` / `missing` / `told` / `waiting`
/ `off` (lib/staff-ui.mjs `tileState`).

## Added after the first merge (Oct 15)

- **Tile order is the principal's.** "Change the order" turns the board into
  ↑ / ↓ controls (keyboard and phone friendly, no dragging), with a
  "Teachers first" shortcut. Saved per person in `ap_staff.board_order`;
  anyone new falls in by last name until moved.
- **"Was here (forgot to check in)"** was already one of the day options in the
  panel's Attendance tab — it clears the absence and the lateness for that day.
- **Where the day-off count starts.** AskVic can only count days it has
  check-ins for (at Saint Peter's that is 2026-09-30 onward). Setup now has
  "Start counting from" (`ap_schools.leave_from`, blank = July 1), and each
  person has "Already used before AskVic" (`ap_staff.leave_used_before`) so a
  balance carried over from paper is right. The panel shows "since <date>
  · +N before" under the absence count, so a surprising number explains itself.

## Fixes from Rob using it (Oct 15, afternoon)

- **Today's no-show now gets a row in Day by day straight away**, labelled
  "No check-in yet today", so "Was here (forgot to check in)" is reachable the
  moment he notices. It still costs no paid day until the day is over.
- **Fixing a day's times, any day.** The Attendance tab has a **✎ Fix a day**
  button that takes any date — already passed, today, or coming up — plus the
  in and out time and a reason. Every row in Day by day also has a plain
  **Fix times** / **Add times** button that fills that form in and scrolls to
  it. Both use `edit_punch`, so the previous time, the reason and who changed
  it stay on record. The date picker matters because a day with no check-in on
  a day that wasn't a school day never appears in the list at all.

## Rework — Oct 23, 2026

Decided with Rob. Where this disagrees with the sections above, this wins.

**What he asked for:** wasted space gone; things he doesn't use daily off the page; a
screening/interviews section coming; the dashboard as a command centre that reaches
everywhere while showing only what matters.

**He wanted buttons to summon the hidden panels. We did not build those**, and the reason is
section 1's own rule: "same position every day so the eye learns the layout." A page that
changes shape fights that, and six panels plus six toggles is a control panel to operate
rather than a board to read. Instead: a small dashboard that never changes shape, and
everything else a door wearing its own state.

**The rule, which is the point of the whole rework:** permanent space is for what changes
every day; everything else is a door; anything behind a door that needs attention raises its
hand in Needs you. Screening lands as a door plus a Needs-you item when candidates wait — no
redesign, and the dashboard does not grow as AskVic does.

### What changed

- **A clock**, large, top right, with the date under it. Rob asked for it by name.
- **Needs you holds only what he can settle from here, and every item carries the button
  that settles it.** His words: it gets annoying after you read it once. The cause is that
  reading an item never fixes it, so it repeats itself every morning. Items with no exit
  moved to door status lines: lesson plans to review, Learning Path suggestions, missing
  clock-outs, unmatched check-in names. What stays: no check-in today (Say why), out today
  or tomorrow needing a sub (Make a cover slip, which arrives at /school/cover with that
  teacher's classes already ticked), out of paid days, and day-off requests (Approve /
  Decline, already settled in place). Each also has "Handled it" for when he fixed it in the
  hallway. On a quiet day the whole panel is one line.
- **Cut:** the five-item legend (every tile already states its own state in words), the
  Staff growth panel, the "Add staff" tile inside the grid, and "Change the order" from the
  section header. The last two moved to one quiet line under the board — a few-times-a-year
  job was charging daily rent in the thing he scans fastest.
- **Growth belongs to the person, not the board.** Rob: walkthrough counts go on the teacher
  panel. They were already there — the slide-out's Overview opens with "Walkthroughs: 4 this
  year · last Oct 2 (21 days ago)" and the Growth tab holds every visit. Nothing was built.
- **A dashboard-level "N teachers not visited in 30+ days" nag was proposed and rejected.**
  Rob pointed out it reads 8 only because he, Ruth and Dale have not started walkthroughs: a
  rule about 30-day gaps says nothing until there are visits to have gaps between. It can
  come back once walkthroughs are in use.
- **Doors** (each with its live state): Sub coverage, Lesson plans, Walkthroughs, Payroll,
  Attendance detail, My teaching. Sub coverage is outlined when somebody is out and no slip
  is made.
- **Top nav cut from six to three**: Dashboard · VIC Room · ⚙ Setup. The doors beat a menu
  that shows only names. VIC Room stays because the aide running it has it open all day and
  is not the principal.

## Still open

- Student academics (section 9) — Rob will say how he wants this.
- A business manager login of their own for payroll.
- Replacing the old saintpetersacademy.org kiosk page with a "we've moved" note.
