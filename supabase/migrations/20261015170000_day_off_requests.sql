-- A teacher asks for a day off in advance; the principal approves or declines it.
-- Approving writes the matching row in ap_day_marks, so nothing changes attendance until a leader says yes. Add-only.
create table if not exists public.ap_day_requests (
 id bigint generated always as identity primary key,
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 staff_id uuid not null,
 day date not null,
 end_day date,
 kind text not null check (kind in ('sick','personal','half','pd','unpaid')),
 note text not null default '' check (char_length(note) <= 300),
 needs_sub boolean not null default false,
 status text not null default 'pending' check (status in ('pending','approved','declined','cancelled')),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 decline_note text not null default '' check (char_length(decline_note) <= 300),
 created_at timestamptz not null default now(),
 foreign key (school_id, staff_id) references public.ap_staff(school_id, id) on delete cascade
);
create index if not exists ap_day_requests_school_idx on public.ap_day_requests(school_id, status, day);
create index if not exists ap_day_requests_staff_idx on public.ap_day_requests(staff_id, day);
alter table public.ap_day_requests enable row level security;
revoke all on public.ap_day_requests from public, anon, authenticated;
grant select, insert, update, delete on public.ap_day_requests to service_role;
