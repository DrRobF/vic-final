-- Staff attendance read from a school's own Google Sheets (check-in log and absence form).
-- Service-role access only; only school leaders see this data through the API.
alter table public.ap_staff add column if not exists pay_type text not null default 'salaried';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_staff_pay_type_check') then
    alter table public.ap_staff add constraint ap_staff_pay_type_check check (pay_type in ('salaried','hourly'));
  end if;
end $$;

create table if not exists public.ap_sheet_links (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  kind text not null check (kind in ('attendance','absences')),
  spreadsheet_id text not null,
  tab text not null,
  mapping jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  aliases jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (school_id, kind)
);

create table if not exists public.ap_attendance (
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  staff_key text not null,
  staff_name text not null,
  day date not null,
  clock_in text,
  clock_out text,
  status text,
  late_minutes integer,
  early_minutes integer,
  primary key (school_id, staff_key, day)
);

create table if not exists public.ap_absence_reports (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  staff_key text not null,
  staff_name text not null,
  start_date date,
  end_date date,
  absence_type text,
  portion text,
  coverage text,
  problem text
);
create index if not exists ap_absence_reports_school_idx on public.ap_absence_reports(school_id, staff_key);

create table if not exists public.ap_reminders (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  staff_id uuid references public.ap_staff(id) on delete set null,
  subject text not null,
  body text not null,
  sent_to text,
  sent_by uuid,
  sent_at timestamptz not null default now()
);

alter table public.ap_sheet_links enable row level security;
alter table public.ap_attendance enable row level security;
alter table public.ap_absence_reports enable row level security;
alter table public.ap_reminders enable row level security;
revoke all on public.ap_sheet_links, public.ap_attendance, public.ap_absence_reports, public.ap_reminders from anon, authenticated;
