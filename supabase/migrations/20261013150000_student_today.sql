-- Student Today screen: link a VIC assignment back to the teacher's saved lesson (for leveled worksheets),
-- and keep each student's worksheet answers. Service-role access only.
alter table public.lessons add column if not exists source_lesson_id uuid;
create index if not exists lessons_source_lesson_idx on public.lessons(source_lesson_id) where source_lesson_id is not null;

create table if not exists public.student_work (
  id bigint generated always as identity primary key,
  student_id bigint not null references public.users(id) on delete cascade,
  lesson_id bigint not null references public.lessons(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'started' check (status in ('started','turned_in')),
  updated_at timestamptz not null default now(),
  turned_in_at timestamptz,
  unique (student_id, lesson_id)
);
alter table public.student_work enable row level security;
revoke all on public.student_work from anon, authenticated;
create index if not exists student_work_lesson_idx on public.student_work(lesson_id);
