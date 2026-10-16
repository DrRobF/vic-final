-- A record of every time VIC flagged that a student may be unsafe, and whether the teacher was emailed.
create table public.vic_safety_alerts (
 id bigint generated always as identity primary key,
 student_id bigint not null references public.users(id) on delete cascade,
 class_id bigint references public.classes(id) on delete set null,
 category text not null check (category in ('self_harm','harmed_by_someone','danger_to_others','unsafe_situation')),
 source text not null check (source in ('vic','keywords','vic+keywords')),
 student_text text not null,
 vic_reply text not null default '',
 notified_emails text[] not null default '{}',
 email_status text not null default 'pending' check (email_status in ('pending','sent','failed','not_configured','no_recipient','suppressed_duplicate')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by bigint references public.users(id) on delete set null
);
create index vic_safety_alerts_student_recent on public.vic_safety_alerts(student_id,created_at desc);
create index vic_safety_alerts_class_recent on public.vic_safety_alerts(class_id,created_at desc);
alter table public.vic_safety_alerts enable row level security;
revoke all on public.vic_safety_alerts from public,anon,authenticated;
grant select,insert,update,delete on public.vic_safety_alerts to service_role;
