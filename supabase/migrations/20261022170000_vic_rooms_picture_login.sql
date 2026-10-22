-- VIC Room: one room of students learning with VIC, run by an aide (Oct 22, 2026).
-- A room groups existing classes; staff_ids are the extra adults (aides) who may run it.
-- Students in a room log in by tapping their name and two secret pictures.
-- Server-only tables: row level security is on (auto) with no policies, so only the service role reads them.

create table if not exists public.vic_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  class_ids bigint[] not null default '{}',
  staff_ids bigint[] not null default '{}',
  created_by bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_picture_logins (
  student_id bigint primary key references public.users(id) on delete cascade,
  pictures text[] not null check (array_length(pictures, 1) = 2),
  failed_count int not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Notes the aide or teacher adds to one child's VIC work ("work on 7s facts today").
create table if not exists public.vic_room_notes (
  id bigserial primary key,
  room_id uuid not null references public.vic_rooms(id) on delete cascade,
  student_id bigint not null references public.users(id) on delete cascade,
  note text not null check (char_length(note) between 1 and 600),
  created_by bigint references public.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists vic_room_notes_student on public.vic_room_notes (student_id) where active;

alter table public.vic_rooms enable row level security;
alter table public.student_picture_logins enable row level security;
alter table public.vic_room_notes enable row level security;
