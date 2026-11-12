-- The rest of the packet: the rounds either side of the screening interview (Nov 12, 2026).
--
-- The paper workbook this replaces followed a candidate from the resume screen through to the
-- teaching demonstration, and the point of it was that one sheet carried every round. The digital
-- version had only the middle: the recorded interview. A principal could score five videos and
-- still have nowhere to put the resume screen or the demo lesson.
--
-- Both are optional. Not every position gets a demo lesson, and a school hiring one aide from four
-- applicants does not need a scored resume screen. A round nobody used contributes nothing and is
-- not shown as a zero -- a round that was skipped and a round that scored zero are different
-- things, and a packet that confuses them makes a candidate look worse than they were.

create table if not exists public.ap_hiring_round_scores (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 candidate_id uuid not null references public.ap_hiring_candidates(id) on delete cascade,
 scorer_user_id uuid not null references auth.users(id),
 scorer_name text not null default '' check (char_length(scorer_name)<=120),
 round text not null check (round in ('screener','demo','plan')),
 -- The earned lines, keyed by the rubric key in lib/hiring.mjs. Kept rather than only the total,
 -- so that a cutoff can be shown later: if a rejected candidate ever asks how the line was drawn,
 -- the answer is this, and it is a much better answer than anybody's memory.
 points jsonb not null default '{}'::jsonb check (jsonb_typeof(points)='object'),
 total smallint not null default 0 check (total between 0 and 500),
 note text not null default '' check (char_length(note)<=4000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 -- One row per scorer per round. A second panel member scoring the demo does not touch the first's.
 unique (candidate_id, scorer_user_id, round)
);
create index if not exists ap_hiring_round_scores_candidate_idx on public.ap_hiring_round_scores(candidate_id, round);

alter table public.ap_hiring_round_scores enable row level security;
revoke all on public.ap_hiring_round_scores from public, anon, authenticated;
grant select, insert, update, delete on public.ap_hiring_round_scores to service_role;
