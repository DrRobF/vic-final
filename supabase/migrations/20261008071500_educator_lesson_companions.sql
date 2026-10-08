create table public.educator_lesson_companions (
 user_id uuid not null references auth.users(id) on delete cascade,
 lesson_id uuid not null,
 kind text not null check (kind in ('prep','family','next','vic')),
 notes text not null default '' check (char_length(notes)<=1500),
 draft text not null default '' check (char_length(draft)<=12000),
 updated_at timestamptz not null default now(),
 primary key (user_id,lesson_id,kind),
 foreign key (user_id,lesson_id) references public.educator_lessons(user_id,id) on delete cascade
);
create index educator_lesson_companions_recent on public.educator_lesson_companions(user_id,updated_at desc);
alter table public.educator_lesson_companions enable row level security;
revoke all on public.educator_lesson_companions from public,anon,authenticated;
grant select,insert,update,delete on public.educator_lesson_companions to service_role;
