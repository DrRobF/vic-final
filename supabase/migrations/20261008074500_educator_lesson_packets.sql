create table public.educator_lesson_packets (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null,
 packet jsonb not null,
 updated_at timestamptz not null default now(),
 primary key (user_id,lesson_id),
 foreign key (user_id,lesson_id) references public.educator_lessons(user_id,id) on delete cascade
);
alter table public.educator_lesson_packets enable row level security;
revoke all on public.educator_lesson_packets from public,anon,authenticated;
grant select,insert,update,delete on public.educator_lesson_packets to service_role;
