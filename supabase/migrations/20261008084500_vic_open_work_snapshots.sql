create table public.vic_open_work_snapshots (
 student_id bigint not null references public.users(id) on delete cascade,
 class_id bigint not null references public.classes(id) on delete cascade,
 turns jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(),
 primary key (student_id,class_id)
);
create index vic_open_work_snapshots_class_recent on public.vic_open_work_snapshots(class_id,updated_at desc);
alter table public.vic_open_work_snapshots enable row level security;
revoke all on public.vic_open_work_snapshots from public,anon,authenticated;
grant select,insert,update,delete on public.vic_open_work_snapshots to service_role;
