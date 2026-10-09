-- Walkthroughs in the school leadership workspace, Learning Path suggestions from them,
-- and principal-assigned Learning Paths. Principals see completion and reflection only, never quiz scores.
create table if not exists public.ap_walkthroughs (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 staff_id uuid not null,
 observer_user_id uuid not null references auth.users(id),
 observer_name text not null default '' check (char_length(observer_name)<=120),
 subject text not null default '' check (char_length(subject)<=80),
 visit_length text not null default '' check (char_length(visit_length)<=40),
 ratings jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings)='object'),
 strength text not null default '' check (char_length(strength)<=2000),
 next_step text not null default '' check (char_length(next_step)<=2000),
 follow_up text not null default '' check (char_length(follow_up)<=200),
 shared_feedback text not null default '' check (char_length(shared_feedback)<=4000),
 private_notes text not null default '' check (char_length(private_notes)<=4000),
 feedback_sent_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key (school_id,staff_id) references public.ap_staff(school_id,id) on delete cascade
);
create index if not exists ap_walkthroughs_school_idx on public.ap_walkthroughs(school_id,created_at desc);

create table if not exists public.ap_path_suggestions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 staff_id uuid not null,
 walkthrough_id uuid references public.ap_walkthroughs(id) on delete cascade,
 topic text not null check (char_length(topic) between 3 and 200),
 reason text not null default '' check (char_length(reason)<=500),
 status text not null default 'pending' check (status in ('pending','assigned','dismissed')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 foreign key (school_id,staff_id) references public.ap_staff(school_id,id) on delete cascade
);
create index if not exists ap_path_suggestions_pending_idx on public.ap_path_suggestions(school_id,status,created_at desc);

create table if not exists public.ap_path_assignments (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 staff_id uuid not null,
 staff_email text not null default '' check (char_length(staff_email)<=254),
 topic text not null check (char_length(topic) between 3 and 200),
 note text not null default '' check (char_length(note)<=600),
 due_date date,
 source text not null default 'manual' check (source in ('manual','walkthrough')),
 suggestion_id uuid references public.ap_path_suggestions(id) on delete set null,
 assigned_by uuid not null references auth.users(id),
 learning_path_id uuid references public.educator_learning_paths(id) on delete set null,
 created_at timestamptz not null default now(),
 foreign key (school_id,staff_id) references public.ap_staff(school_id,id) on delete cascade
);
create index if not exists ap_path_assignments_school_idx on public.ap_path_assignments(school_id,created_at desc);
create index if not exists ap_path_assignments_email_idx on public.ap_path_assignments(lower(staff_email));

alter table public.educator_learning_paths add column if not exists assignment_id uuid references public.ap_path_assignments(id) on delete set null;

alter table public.ap_walkthroughs enable row level security;
alter table public.ap_path_suggestions enable row level security;
alter table public.ap_path_assignments enable row level security;
revoke all on public.ap_walkthroughs, public.ap_path_suggestions, public.ap_path_assignments from public,anon,authenticated;
grant select,insert,update,delete on public.ap_walkthroughs, public.ap_path_suggestions, public.ap_path_assignments to service_role;
