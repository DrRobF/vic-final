-- Teaching the child in front of you (Oct 27, 2026).
--
-- Three problems that turned out to be one problem: a 5th grader who cannot read well enough
-- to use VIC, a 6th grader working at a 1st grade level, and a 6th grader already past the
-- 6th grade curriculum. In each case the system knows one thing about the child -- the grade
-- on the roster -- and teaches to it. This migration separates what the roster says from what
-- the child can do, and records what help was switched on when a verdict was earned.
--
-- The rule underneath all of it: support everything except the thing being measured. Reading
-- a math word problem aloud removes a barrier that is not the point. Reading a comprehension
-- passage aloud removes the point itself. Which of those a standard is lives in
-- data/lesson-standards.json (`audio`, `translate`), not here -- see
-- scripts/tag-standard-supports.py.
--
-- Server-only throughout: row level security on with no policies, so only the service role
-- reads these, same as vic_goal_results and cover_grants.

-- ---------------------------------------------------------------------------
-- 1. Where the child actually is, as distinct from what grade they are in.
-- ---------------------------------------------------------------------------
-- users.grade_level is administrative: it is what the roster, the state and the report card
-- say, and it does not move because a child is behind. This is the instructional level --
-- which grade's standards VIC should actually teach -- and it moves in both directions. One
-- row per subject, because a child can be on level in math and two years back in reading.
--
-- Deliberately NOT per strand yet. Strand granularity (behind in fractions, fine in
-- computation) is the right eventual shape and the table is keyed so it can be added without
-- a rewrite, but subject is the cut that solves the children in front of us this week.
create table if not exists public.student_levels (
  student_id bigint not null references public.users(id) on delete cascade,
  subject text not null check (subject in ('math', 'reading')),
  -- Same scale as users.grade_level: 0 is K. May sit above or below the enrolled grade --
  -- a child a year ahead is the same mechanism as a child four years behind.
  level smallint not null check (level between 0 and 12),
  -- How this level was arrived at. 'placement' means VIC proposed it from a probe and a
  -- teacher has not confirmed it yet; a proposed level that nobody has looked at should not
  -- be presented as fact.
  source text not null default 'teacher' check (source in ('teacher', 'placement', 'iep', 'ixl')),
  set_by uuid references auth.users(id) on delete set null,
  -- Null until a human agrees. VIC may teach to an unconfirmed level, but no report may
  -- describe a child by one.
  confirmed_at timestamptz,
  note text not null default '' check (char_length(note) <= 300),
  updated_at timestamptz not null default now(),
  primary key (student_id, subject)
);
alter table public.student_levels enable row level security;

-- ---------------------------------------------------------------------------
-- 2. What help this child gets, and in what language.
-- ---------------------------------------------------------------------------
-- Set by a teacher or the special education teacher, usually from what the child's IEP
-- already says. The IEP itself is not copied here and no disability flag is stored: nothing
-- in AskVic needs to know *why* a child gets read-aloud in order to give it to them, and a
-- field nothing reads is a field that can only leak.
create table if not exists public.student_supports (
  student_id bigint primary key references public.users(id) on delete cascade,
  -- off          - no speaker buttons; the default for a fluent reader.
  -- on_request   - speaker buttons everywhere the standard allows; the child taps.
  -- always       - VIC speaks every turn without being asked. K-2, and any child for whom
  --                reading the screen is itself the obstacle.
  read_aloud text not null default 'off' check (read_aloud in ('off', 'on_request', 'always')),
  -- The language VIC explains in. Scaffolding is translated; English text under study is
  -- never translated -- that is the `translate` policy on the standard, not a choice here.
  language text not null default 'en' check (language in ('en', 'es', 'ht')),
  -- Teach from the alternate standards (Florida Access Points) rather than the general
  -- catalogue. For students with significant cognitive disabilities, on the authority of an
  -- IEP team -- never inferred from low scores, which is how a struggling reader gets
  -- quietly moved onto an alternate diploma track.
  alternate_standards boolean not null default false,
  set_by uuid references auth.users(id) on delete set null,
  note text not null default '' check (char_length(note) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.student_supports enable row level security;

-- ---------------------------------------------------------------------------
-- 3. The denominator: what VIC tried, not only what it concluded.
-- ---------------------------------------------------------------------------
-- The first real day produced 85 verdicts across 13 students and every one was 'met'. That is
-- not thirteen children mastering everything; it is a stream that only records success. VIC
-- gives a verdict "once per lesson, when you are sure", and 'not_yet' requires having taught
-- a thing two ways and the child still cannot do it -- so a struggling child produces silence
-- rather than a row. The red-flag children are the ones missing from the table.
--
-- An attempt row is written when VIC STARTS working a standard with a child, before anyone
-- knows how it goes. That is load-bearing: written at the same moment as the verdict, this
-- table would reproduce the same censorship with more columns. resolved_at null and verdict
-- null is the fact that was previously unrecordable -- we tried, and it did not land.
create table if not exists public.vic_goal_attempts (
  id bigserial primary key,
  student_id bigint not null references public.users(id) on delete cascade,
  class_id bigint references public.classes(id) on delete set null,
  lesson_id bigint references public.lessons(id) on delete set null,
  -- One attempt per assignment: the practice path makes an assignment per standard, and
  -- resuming today's unfinished practice must update the attempt rather than open a second.
  assignment_id bigint unique references public.assignments(id) on delete set null,
  standard_id text,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Null while the attempt is open, and still null if it was simply abandoned.
  resolved_at timestamptz,
  verdict text check (verdict in ('met', 'partly', 'not_yet')),
  turns integer not null default 0,

  -- The support condition in force, snapshotted. A 'met' earned with the passage read aloud
  -- is not the same fact as a 'met' earned cold, and today the table cannot tell them apart.
  -- Recording it also produces, as a byproduct, the list of children who only reach 'met'
  -- with audio -- which is a reading-intervention roster nobody has to assemble by hand.
  audio_policy text check (audio_policy in ('free', 'stem_only', 'none', 'required')),
  audio_used boolean not null default false,
  -- True only when audio was applied to the ASSESSED content, which is the case that changes
  -- what the verdict means. Reading the directions aloud does not.
  audio_on_assessed boolean not null default false,
  language text not null default 'en',
  alternate_standard boolean not null default false,

  -- Both of these move, and a verdict recorded in October has to still be readable in May.
  instructional_level smallint check (instructional_level between 0 and 12),
  enrolled_grade smallint check (enrolled_grade between 0 and 12)
);
create index if not exists vic_goal_attempts_student on public.vic_goal_attempts (student_id, started_at desc);
create index if not exists vic_goal_attempts_class on public.vic_goal_attempts (class_id, started_at desc);
-- The query the red-flag rule will be built on: repeated unresolved attempts at one standard.
create index if not exists vic_goal_attempts_open on public.vic_goal_attempts (student_id, standard_id, started_at desc) where resolved_at is null;
alter table public.vic_goal_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Carry the support condition onto the verdict itself.
-- ---------------------------------------------------------------------------
-- Everything that reads student evidence today reads vic_goal_results. Rather than make every
-- one of those queries learn a join before it can be honest, the three facts that change what
-- a verdict MEANS live on the verdict too.
alter table public.vic_goal_results add column if not exists attempt_id bigint references public.vic_goal_attempts(id) on delete set null;
alter table public.vic_goal_results add column if not exists audio_on_assessed boolean not null default false;
alter table public.vic_goal_results add column if not exists language text not null default 'en';
alter table public.vic_goal_results add column if not exists alternate_standard boolean not null default false;

-- The 85 rows that already exist predate any of this. They were earned under unknown
-- conditions, so the defaults above are an assumption, not a record -- treat anything before
-- this migration as unverified when the dashboard is finally built.
