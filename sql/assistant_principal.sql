-- Run once in the AskVic Supabase SQL editor before enabling /assistantprincipal.
-- Each school owns its configuration and records. API routes use the service role
-- only after verifying the authenticated user's membership on every request.
begin;

create extension if not exists pgcrypto;

create table if not exists public.ap_schools (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  time_zone text not null default 'America/New_York',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.ap_memberships (
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'principal', 'admin')),
  created_at timestamptz not null default now(),
  primary key (school_id, auth_user_id)
);
create index if not exists ap_memberships_user_idx on public.ap_memberships(auth_user_id);

create table if not exists public.ap_entitlements (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null check (status in ('trial', 'active', 'paused')),
  school_limit integer not null default 1 check (school_limit between 1 and 1000),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ap_staff (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 2 and 120),
  role text not null default 'teacher' check (role in ('teacher', 'office', 'support', 'leader', 'other')),
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, id)
);
create index if not exists ap_staff_school_idx on public.ap_staff(school_id, display_name);

create table if not exists public.ap_commitments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 120),
  applies_to text not null default 'teachers' check (applies_to in ('all', 'teachers')),
  cadence text not null default 'weekly' check (cadence in ('daily', 'weekly')),
  due_weekday smallint check (due_weekday between 0 and 6),
  due_time time not null default '10:00',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (school_id, id),
  check ((cadence = 'daily' and due_weekday is null) or (cadence = 'weekly' and due_weekday is not null))
);

create table if not exists public.ap_evidence (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  staff_id uuid not null,
  commitment_id uuid not null,
  period_start date not null,
  state text not null check (state in ('received', 'reviewed')),
  note text not null default '',
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  foreign key (school_id, staff_id) references public.ap_staff(school_id, id) on delete cascade,
  foreign key (school_id, commitment_id) references public.ap_commitments(school_id, id) on delete cascade,
  unique (school_id, staff_id, commitment_id, period_start)
);
create index if not exists ap_evidence_period_idx on public.ap_evidence(school_id, period_start);

create table if not exists public.ap_sources (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  kind text not null check (kind in ('attendance', 'lesson_plans', 'grades', 'walkthroughs', 'absences', 'other')),
  label text not null check (length(btrim(label)) between 2 and 120),
  url text not null check (url ~* '^https://'),
  connection_state text not null default 'reference' check (connection_state in ('reference', 'connected')),
  created_at timestamptz not null default now(),
  unique (school_id, kind)
);

create table if not exists public.ap_briefs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  week_start date not null,
  notes text not null,
  draft text not null,
  state text not null default 'draft' check (state in ('draft', 'approved')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  unique (school_id, week_start)
);

-- No direct browser read/write path. The route performs membership checks and
-- scopes every query by school_id before using the service role.
alter table public.ap_schools enable row level security;
alter table public.ap_memberships enable row level security;
alter table public.ap_entitlements enable row level security;
alter table public.ap_staff enable row level security;
alter table public.ap_commitments enable row level security;
alter table public.ap_evidence enable row level security;
alter table public.ap_sources enable row level security;
alter table public.ap_briefs enable row level security;
revoke all on public.ap_schools, public.ap_memberships, public.ap_entitlements, public.ap_staff,
  public.ap_commitments, public.ap_evidence, public.ap_sources, public.ap_briefs
  from anon, authenticated;
grant all on public.ap_schools, public.ap_memberships, public.ap_entitlements, public.ap_staff,
  public.ap_commitments, public.ap_evidence, public.ap_sources, public.ap_briefs
  to service_role;
commit;
