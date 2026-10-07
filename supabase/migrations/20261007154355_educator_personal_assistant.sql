create table public.educator_assistant_work (
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('weekly','communication','meeting','pd','tasks')),
 notes text not null default '' check (char_length(notes)<=5000),
 draft text not null default '' check (char_length(draft)<=16000),
 tasks jsonb not null default '[]'::jsonb check (jsonb_typeof(tasks)='array' and jsonb_array_length(tasks)<=100),
 updated_at timestamptz not null default now(),
 primary key (user_id,kind)
);
alter table public.educator_assistant_work enable row level security;
revoke all on public.educator_assistant_work from public,anon,authenticated;
grant select on public.educator_assistant_work to authenticated;
grant select,insert,update,delete on public.educator_assistant_work to service_role;
create policy educator_assistant_owner_read on public.educator_assistant_work
 for select to authenticated using ((select auth.uid())=user_id);
