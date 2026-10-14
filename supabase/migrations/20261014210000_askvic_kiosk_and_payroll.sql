-- AskVic's own check-in kiosk, time corrections with an audit trail, announcements, and payroll settings.
-- Staff codes are stored only as keyed hashes. Service-role access only.
alter table public.ap_staff add column if not exists code_hash text;
create unique index if not exists ap_staff_code_hash_idx on public.ap_staff(school_id, code_hash) where code_hash is not null;

alter table public.ap_schools add column if not exists day_start text;
alter table public.ap_schools add column if not exists day_end text;
alter table public.ap_schools add column if not exists pay_period_start date;
alter table public.ap_schools add column if not exists payroll_email text;

create table if not exists public.ap_kiosks (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'Office computer',
  created_by uuid,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  fail_count integer not null default 0,
  fail_window_start timestamptz,
  locked_until timestamptz,
  revoked boolean not null default false
);

create table if not exists public.ap_punches (
  id bigint generated always as identity primary key,
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  staff_id uuid not null references public.ap_staff(id) on delete cascade,
  day date not null,
  clock_in text,
  clock_out text,
  source text not null default 'kiosk' check (source in ('kiosk','import','manual')),
  orig_in text,
  orig_out text,
  edited_by uuid,
  edited_at timestamptz,
  edit_note text,
  created_at timestamptz not null default now(),
  unique (school_id, staff_id, day)
);
create index if not exists ap_punches_school_day_idx on public.ap_punches(school_id, day);

create table if not exists public.ap_announcements (
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  day date not null,
  morning text,
  afternoon text,
  updated_at timestamptz not null default now(),
  primary key (school_id, day)
);

alter table public.ap_kiosks enable row level security;
alter table public.ap_punches enable row level security;
alter table public.ap_announcements enable row level security;
revoke all on public.ap_kiosks, public.ap_punches, public.ap_announcements from anon, authenticated;
