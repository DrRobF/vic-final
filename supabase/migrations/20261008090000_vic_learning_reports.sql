create table public.vic_learning_reports (
 teacher_auth_id uuid not null references auth.users(id) on delete cascade,
 class_id bigint not null references public.classes(id) on delete cascade,
 student_id bigint not null references public.users(id) on delete cascade,
 report jsonb not null,
 generated_at timestamptz not null default now(),
 primary key (teacher_auth_id,class_id,student_id)
);
create index vic_learning_reports_class_student on public.vic_learning_reports(class_id,student_id);
alter table public.vic_learning_reports enable row level security;
revoke all on public.vic_learning_reports from public,anon,authenticated;
grant select,insert,update,delete on public.vic_learning_reports to service_role;
