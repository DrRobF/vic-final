-- Ensure new class enrollments default to ON-LEVEL support.
-- This only affects new rows and does not modify existing enrollments.

alter table if exists public.enrollments
  alter column support_level set default 'on_level';
