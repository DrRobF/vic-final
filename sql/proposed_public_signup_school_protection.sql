-- Approved by Rob on October 6, 2026 and applied as
-- protect_school_accounts_before_public_lesson_signup.
-- Reviewed callers use server-admin roster creation and authenticated school profiles.
drop policy if exists users_insert_own_row on public.users;
revoke insert on public.users from authenticated, anon;
drop policy if exists "Allow anon read assignments" on public.assignments;
drop policy if exists "Allow anon read lessons" on public.lessons;
drop policy if exists "Students can read lessons" on public.lessons;
create policy "Approved students can read lessons" on public.lessons
for select to authenticated
using (exists (select 1 from public.users u
  where u.auth_user_id = auth.uid() and u.role = 'student'));
