-- Learning Paths: self-directed professional learning for educators.
create table if not exists public.educator_learning_paths (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 topic text not null check (char_length(topic) between 3 and 200),
 context text not null default '' check (char_length(context)<=600),
 path jsonb not null default '{}'::jsonb,
 resources jsonb not null default '[]'::jsonb check (jsonb_typeof(resources)='array'),
 progress jsonb not null default '{}'::jsonb,
 quiz_answers jsonb,
 quiz_score integer check (quiz_score between 0 and 100),
 reflection text not null default '' check (char_length(reflection)<=4000),
 status text not null default 'started' check (status in ('started','completed')),
 minutes integer not null default 0 check (minutes between 0 and 600),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists educator_learning_paths_recent on public.educator_learning_paths(user_id,updated_at desc);
alter table public.educator_learning_paths enable row level security;
revoke all on public.educator_learning_paths from public,anon,authenticated;
grant select,insert,update,delete on public.educator_learning_paths to service_role;
