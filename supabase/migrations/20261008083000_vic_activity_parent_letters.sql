create table public.vic_activity_snapshots (
 student_id bigint not null references public.users(id) on delete cascade,
 class_id bigint not null references public.classes(id) on delete cascade,
 assignment_id bigint not null references public.assignments(id) on delete cascade,
 turns jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now(),
 primary key (student_id,class_id,assignment_id)
);
create index vic_activity_snapshots_class_student_recent on public.vic_activity_snapshots(class_id,student_id,updated_at desc);
alter table public.vic_activity_snapshots enable row level security;
revoke all on public.vic_activity_snapshots from public,anon,authenticated;
grant select,insert,update,delete on public.vic_activity_snapshots to service_role;

create table public.parent_letter_drafts (
 id uuid primary key default gen_random_uuid(),
 teacher_auth_id uuid not null references auth.users(id) on delete cascade,
 class_id bigint not null references public.classes(id) on delete cascade,
 student_id bigint not null references public.users(id) on delete cascade,
 subject text not null check (char_length(subject)<=240),
 body text not null check (char_length(body)<=12000),
 inputs jsonb not null default '{}'::jsonb,
 status text not null default 'draft' check (status in ('draft','approved','sending','sent','failed')),
 recipient_email text,
 provider_message_id text,
 approved_at timestamptz,
 sent_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index parent_letter_drafts_teacher_class_recent on public.parent_letter_drafts(teacher_auth_id,class_id,created_at desc);
alter table public.parent_letter_drafts enable row level security;
revoke all on public.parent_letter_drafts from public,anon,authenticated;
grant select,insert,update,delete on public.parent_letter_drafts to service_role;
