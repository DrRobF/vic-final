-- Teacher hiring in the school leadership workspace (Nov 12, 2026).
--
-- Saint Peter's already runs a video screening on its own website: an invited candidate enters
-- a code, records five short video answers, writes five short responses, and optionally attaches
-- a resume. That part works. What does not exist anywhere yet is the half that decides anything --
-- a scored rubric, several panel members scoring independently, and one place that shows where a
-- candidate stands. Principals currently hold that in their head and in a Word packet.
--
-- The design follows Dr. Rob Furman's own hiring process, built over twenty years and about a
-- thousand resumes for a single elementary opening:
--
--   screener (12) -> video (50) + written (20) -> in-person (50) -> demo (80) + plan/debrief (20)
--
-- Two things in here are deliberate and should not be "simplified" later.
--
-- ONE: every panel member scores separately, and nobody's score overwrites anyone else's.
-- ap_hiring_scores is keyed by (response, scorer). Three people's independent scores summed is
-- the whole point of a panel; one shared editable score is just the loudest person in the room
-- with extra steps.
--
-- TWO: each question carries its own look_for_strong and look_for_weak text, and the review screen
-- shows them next to the recording while the scorer is scoring. The old paper packet had a blank
-- "Look for..." column, which meant three scorers were quietly using three different bars. The
-- rubric is the product; a question without its look-fors is half a question.

create table if not exists public.ap_hiring_postings (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 title text not null check (char_length(title) between 2 and 160),
 grade_band text not null default '' check (char_length(grade_band)<=60),
 subject text not null default '' check (char_length(subject)<=80),
 status text not null default 'open' check (status in ('draft','open','closed','filled')),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 closed_at timestamptz
);
create index if not exists ap_hiring_postings_school_idx on public.ap_hiring_postings(school_id,status,created_at desc);

-- Questions live per posting, seeded from the school's default set, so that editing the wording for
-- an aide posting cannot quietly change the rubric a teaching candidate was already scored against.
create table if not exists public.ap_hiring_questions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 posting_id uuid not null references public.ap_hiring_postings(id) on delete cascade,
 stage text not null check (stage in ('video','written','interview')),
 ordinal smallint not null check (ordinal between 1 and 30),
 prompt text not null check (char_length(prompt) between 5 and 1200),
 domain text not null default '' check (char_length(domain)<=60),
 -- The two halves of the blank column. Shown to the scorer, never to the candidate.
 look_for_strong text not null default '' check (char_length(look_for_strong)<=2000),
 look_for_weak text not null default '' check (char_length(look_for_weak)<=2000),
 -- Substance is capped well above delivery on purpose: a polished speaker with nothing behind it
 -- must not be able to outscore a nervous candidate with real classroom judgment.
 max_substance smallint not null default 8 check (max_substance between 1 and 50),
 max_delivery smallint not null default 2 check (max_delivery between 0 and 10),
 created_at timestamptz not null default now(),
 unique (posting_id, stage, ordinal)
);
create index if not exists ap_hiring_questions_posting_idx on public.ap_hiring_questions(posting_id,stage,ordinal);

create table if not exists public.ap_hiring_candidates (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 posting_id uuid not null references public.ap_hiring_postings(id) on delete cascade,
 name text not null check (char_length(name) between 2 and 160),
 email text not null check (char_length(email) between 3 and 254),
 phone text not null default '' check (char_length(phone)<=40),
 cert_areas text not null default '' check (char_length(cert_areas)<=400),
 -- The code the candidate types to open their screening. Not a password and not secret enough to
 -- be one: it identifies an invitation, and it is the only thing standing in front of someone
 -- else's application, so it is long enough not to be guessed and it expires.
 invite_code text not null unique check (char_length(invite_code) between 8 and 40),
 invite_expires_at timestamptz,
 stage text not null default 'invited'
  check (stage in ('invited','screening_submitted','interview','demo','references','offer','hired','declined','withdrawn')),
 -- Commute is a real concern and a terrible thing to score: a points system built on where people
 -- live tracks housing patterns, and housing patterns track race and income. So it is asked of the
 -- candidate and recorded as their own answer, and it earns no points anywhere.
 commute_sustainable text not null default '' check (char_length(commute_sustainable)<=600),
 -- Entirely separate from the application, by design. See the comment on the column below.
 marketing_opt_in boolean not null default false,
 marketing_opt_in_at timestamptz,
 recording_notice_accepted_at timestamptz,
 -- Applicant video is personal information about people who do not work here. It gets a disposal
 -- date at creation, not a vague intention to tidy up later.
 delete_after date,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 submitted_at timestamptz,
 decided_at timestamptz
);
create index if not exists ap_hiring_candidates_posting_idx on public.ap_hiring_candidates(posting_id,stage,created_at desc);
create index if not exists ap_hiring_candidates_school_idx on public.ap_hiring_candidates(school_id,created_at desc);
create index if not exists ap_hiring_candidates_disposal_idx on public.ap_hiring_candidates(delete_after) where delete_after is not null;

comment on column public.ap_hiring_candidates.marketing_opt_in is
 'Optional consent to a mailing list, offered visibly separate from the application. It must never '
 'appear on a review or scoring screen, never be used to rank or sort candidates, and never be '
 'joined into anything a scorer sees. A principal who owns the software a candidate is compelled '
 'to use already holds all the power in the room; this column exists so the ask is honest, not so '
 'the answer can be acted on.';

create table if not exists public.ap_hiring_responses (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade,
 question_id uuid not null references public.ap_hiring_questions(id) on delete cascade,
 stage text not null check (stage in ('video','written','interview')),
 -- Video lives in object storage, not in this row. Five answers of up to five minutes will not fit
 -- through a serverless function body, so the upload goes straight to storage from the browser and
 -- this is the path it landed at.
 video_path text not null default '' check (char_length(video_path)<=400),
 video_seconds integer check (video_seconds between 0 and 7200),
 text_response text not null default '' check (char_length(text_response)<=20000),
 submitted_at timestamptz not null default now(),
 unique (candidate_id, question_id)
);
create index if not exists ap_hiring_responses_candidate_idx on public.ap_hiring_responses(candidate_id,stage);

create table if not exists public.ap_hiring_scores (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade,
 response_id uuid not null references public.ap_hiring_responses(id) on delete cascade,
 scorer_user_id uuid not null references auth.users(id),
 scorer_name text not null default '' check (char_length(scorer_name)<=120),
 substance smallint not null check (substance >= 0),
 delivery smallint not null default 0 check (delivery >= 0),
 -- The specific story the candidate told. The single most useful thing on the sheet six weeks
 -- later, and the thing nobody can reconstruct from a number.
 note text not null default '' check (char_length(note)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 -- One score per scorer per answer. A second panel member scoring does not touch the first's.
 unique (response_id, scorer_user_id)
);
create index if not exists ap_hiring_scores_candidate_idx on public.ap_hiring_scores(candidate_id);

-- The pre-interview screener: scored from the application alone, by the principal, before contact.
-- Stored as the earned points per line so that the cutoff used can be shown later, which is the
-- only honest answer if a rejected candidate ever asks how the line was drawn.
create table if not exists public.ap_hiring_screener (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade unique,
 points jsonb not null default '{}'::jsonb check (jsonb_typeof(points)='object'),
 total smallint not null default 0 check (total between 0 and 100),
 gpa_waived boolean not null default false,
 waiver_reason text not null default '' check (char_length(waiver_reason)<=400),
 scored_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);

create table if not exists public.ap_hiring_reference_calls (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade,
 reference_name text not null default '' check (char_length(reference_name)<=160),
 relationship text not null default '' check (char_length(relationship)<=200),
 years_known text not null default '' check (char_length(years_known)<=40),
 -- "Would you put your own child in this person's classroom?" asked first, before the small talk
 -- settles. The hesitation is the answer, so the hesitation is what gets recorded.
 kid_question text not null default '' check (kid_question in ('','yes','hesitated','no')),
 growth_area text not null default '' check (char_length(growth_area)<=2000),
 disagreement_answer text not null default '' check (char_length(disagreement_answer)<=2000),
 would_rehire text not null default '' check (would_rehire in ('','yes','hesitated','no')),
 notes text not null default '' check (char_length(notes)<=4000),
 called_by uuid not null references auth.users(id),
 called_at timestamptz not null default now()
);
create index if not exists ap_hiring_reference_calls_candidate_idx on public.ap_hiring_reference_calls(candidate_id);

alter table public.ap_hiring_postings enable row level security;
alter table public.ap_hiring_questions enable row level security;
alter table public.ap_hiring_candidates enable row level security;
alter table public.ap_hiring_responses enable row level security;
alter table public.ap_hiring_scores enable row level security;
alter table public.ap_hiring_screener enable row level security;
alter table public.ap_hiring_reference_calls enable row level security;

revoke all on public.ap_hiring_postings, public.ap_hiring_questions, public.ap_hiring_candidates,
 public.ap_hiring_responses, public.ap_hiring_scores, public.ap_hiring_screener,
 public.ap_hiring_reference_calls from public, anon, authenticated;

grant select, insert, update, delete on public.ap_hiring_postings, public.ap_hiring_questions,
 public.ap_hiring_candidates, public.ap_hiring_responses, public.ap_hiring_scores,
 public.ap_hiring_screener, public.ap_hiring_reference_calls to service_role;
