create table public.educator_lessons (
 user_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 title text not null check (char_length(title) between 1 and 300),
 subject text not null default '',
 grade text not null default '',
 draft jsonb not null check (jsonb_typeof(draft)='object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key (user_id,id)
);
create index educator_lessons_recent on public.educator_lessons(user_id,updated_at desc,id);
alter table public.educator_lessons enable row level security;
revoke all on public.educator_lessons from public,anon,authenticated;
grant select on public.educator_lessons to authenticated;
grant select,insert,update,delete on public.educator_lessons to service_role;
create policy educator_lessons_owner_read on public.educator_lessons
 for select to authenticated using ((select auth.uid())=user_id);
