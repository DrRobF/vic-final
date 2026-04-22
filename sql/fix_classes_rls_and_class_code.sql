-- VIC backend fix script
-- Run this in the Supabase SQL editor.
-- This script safely:
-- 1) ties public.users rows to auth.users via auth_user_id
-- 2) fixes classes RLS so teachers can only manage their own classes
-- 3) auto-generates unique class_code values on insert/update
-- 4) ensures users.parent_email exists for teacher roster parent contact persistence

begin;

-- -------------------------------------------------------------------
-- A) Tie profile rows (public.users) to Supabase Auth users (auth.users)
-- -------------------------------------------------------------------
alter table public.users
add column if not exists auth_user_id uuid;

create unique index if not exists users_auth_user_id_key
on public.users (auth_user_id)
where auth_user_id is not null;

-- Optional backfill by matching email address where possible.
update public.users u
set auth_user_id = au.id
from auth.users au
where u.auth_user_id is null
  and lower(u.email) = lower(au.email);

-- Ensure student parent contact field exists for teacher dashboard save/read.
alter table if exists public.users
add column if not exists parent_email text;

-- -------------------------------------------------------------------
-- B) Ensure class_code exists and is unique + human-friendly
-- -------------------------------------------------------------------
alter table public.classes
add column if not exists class_code text;

create unique index if not exists classes_class_code_key
on public.classes (class_code)
where class_code is not null;

create or replace function public.generate_class_code(code_length integer default 7)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  try_count integer := 0;
begin
  if code_length < 6 then
    code_length := 6;
  end if;

  loop
    candidate := '';

    for i in 1..code_length loop
      candidate := candidate || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;

    if not exists (select 1 from public.classes c where c.class_code = candidate) then
      return candidate;
    end if;

    try_count := try_count + 1;
    if try_count > 30 then
      raise exception 'Unable to generate unique class code after % attempts', try_count;
    end if;
  end loop;
end;
$$;

create or replace function public.set_class_code_if_missing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.class_code is null or length(trim(new.class_code)) = 0 then
    new.class_code := public.generate_class_code(7);
  else
    new.class_code := upper(trim(new.class_code));
  end if;

  return new;
end;
$$;

drop trigger if exists classes_set_class_code on public.classes;
create trigger classes_set_class_code
before insert or update of class_code on public.classes
for each row
execute function public.set_class_code_if_missing();

-- Backfill existing classes without a code.
update public.classes
set class_code = public.generate_class_code(7)
where class_code is null or length(trim(class_code)) = 0;

-- -------------------------------------------------------------------
-- C) RLS for classes
-- Teachers can only view/insert/update/delete their own classes.
-- Ownership is resolved via public.users.auth_user_id = auth.uid().
-- -------------------------------------------------------------------
alter table public.classes enable row level security;

-- Remove older policies that may conflict.
drop policy if exists "Teachers can view own classes" on public.classes;
drop policy if exists "Teachers can insert own classes" on public.classes;
drop policy if exists "Teachers can update own classes" on public.classes;
drop policy if exists "Teachers can delete own classes" on public.classes;

create policy "Teachers can view own classes"
on public.classes
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = classes.teacher_id
      and u.role = 'teacher'
      and u.auth_user_id = auth.uid()
  )
);

create policy "Teachers can insert own classes"
on public.classes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = classes.teacher_id
      and u.role = 'teacher'
      and u.auth_user_id = auth.uid()
  )
);

create policy "Teachers can update own classes"
on public.classes
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = classes.teacher_id
      and u.role = 'teacher'
      and u.auth_user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = classes.teacher_id
      and u.role = 'teacher'
      and u.auth_user_id = auth.uid()
  )
);

create policy "Teachers can delete own classes"
on public.classes
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = classes.teacher_id
      and u.role = 'teacher'
      and u.auth_user_id = auth.uid()
  )
);

commit;
