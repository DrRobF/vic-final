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

## Still open

- Student academics (section 9) — Rob will say how he wants this.
- A business manager login of their own for payroll.
- Replacing the old saintpetersacademy.org kiosk page with a "we've moved" note.
