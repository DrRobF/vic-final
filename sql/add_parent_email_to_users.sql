-- Adds a reusable parent email field for each student profile.
-- Safe to run multiple times.

alter table if exists public.users
  add column if not exists parent_email text;
