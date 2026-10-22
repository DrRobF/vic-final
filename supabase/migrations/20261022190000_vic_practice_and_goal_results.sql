-- VIC practice path and goal results (Oct 22, 2026).
-- A practice lesson is an ordinary lesson + assignment that VIC made for one student from a standard;
-- practice_standard names that standard. vic_goal_results records VIC's verdict on any lesson:
-- met, partly, or not yet. This is the evidence behind "students on level" and red flags.
alter table public.lessons add column if not exists practice_standard text;
create table if not exists public.vic_goal_results (
  id bigserial primary key,
  student_id bigint not null references public.users(id) on delete cascade,
  class_id bigint references public.classes(id) on delete set null,
  lesson_id bigint references public.lessons(id) on delete set null,
  assignment_id bigint references public.assignments(id) on delete set null,
  standard_id text,
  verdict text not null check (verdict in ('met','partly','not_yet')),
  practice boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists vic_goal_results_student on public.vic_goal_results (student_id, created_at desc);
create index if not exists vic_goal_results_class on public.vic_goal_results (class_id, created_at desc);
alter table public.vic_goal_results enable row level security;
