-- A leader's note on one staff member's day: what kind of absence it was, a planned absence,
-- or "was here, forgot to check in". It overrides the absence form and the default
-- ("no check-in on a school day = absent, uses a paid day"). Add-only.
create table if not exists public.ap_day_marks (
 id bigint generated always as identity primary key,
 school_id uuid not null references public.ap_schools(id) on delete cascade,
 staff_id uuid not null,
 day date not null,
 kind text not null check (kind in ('sick','personal','half','pd','excused','unpaid','present')),
 note text not null default '' check (char_length(note) <= 300),
 needs_sub boolean not null default false,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 unique (school_id, staff_id, day),
 foreign key (school_id, staff_id) references public.ap_staff(school_id, id) on delete cascade
);
create index if not exists ap_day_marks_school_day_idx on public.ap_day_marks(school_id, day);
alter table public.ap_day_marks enable row level security;
revoke all on public.ap_day_marks from public, anon, authenticated;
grant select, insert, update, delete on public.ap_day_marks to service_role;
