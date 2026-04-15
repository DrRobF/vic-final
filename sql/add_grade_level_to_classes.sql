-- Add grade_level support for class context and teacher class creation.
alter table public.classes
add column if not exists grade_level text;
