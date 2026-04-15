-- Add class_code support for student self-enrollment.
alter table public.classes
add column if not exists class_code text;

-- Ensure class codes are unique when present.
create unique index if not exists classes_class_code_key
on public.classes (class_code)
where class_code is not null;

-- Optional hardening: normalize class code casing at write time in app code,
-- and backfill existing rows with generated codes before enforcing NOT NULL.
