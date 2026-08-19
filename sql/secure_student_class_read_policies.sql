-- Student read access is always anchored at auth.uid() -> users.auth_user_id.
-- Existing teacher policies are left intact; PostgreSQL combines permissive
-- SELECT policies with OR, so this adds student access without changing portals.
begin;

alter table public.users enable row level security;
alter table public.enrollments enable row level security;
alter table public.classes enable row level security;
alter table public.assignments enable row level security;
alter table public.lessons enable row level security;

drop policy if exists "Students can read own profile" on public.users;
create policy "Students can read own profile" on public.users
for select to authenticated
using (auth_user_id = auth.uid() and lower(role) = 'student');

drop policy if exists "Students can read own enrollments" on public.enrollments;
create policy "Students can read own enrollments" on public.enrollments
for select to authenticated
using (student_id in (
  select id from public.users
  where auth_user_id = auth.uid() and lower(role) = 'student'
));

drop policy if exists "Students can read enrolled classes" on public.classes;
create policy "Students can read enrolled classes" on public.classes
for select to authenticated
using (id in (
  select e.class_id from public.enrollments e
  join public.users u on u.id = e.student_id
  where u.auth_user_id = auth.uid() and lower(u.role) = 'student'
));

drop policy if exists "Students can read own assignments" on public.assignments;
create policy "Students can read own assignments" on public.assignments
for select to authenticated
using (student_id in (
  select id from public.users
  where auth_user_id = auth.uid() and lower(role) = 'student'
));

drop policy if exists "Students can read assigned lessons" on public.lessons;
create policy "Students can read assigned lessons" on public.lessons
for select to authenticated
using (id in (
  select a.lesson_id from public.assignments a
  join public.users u on u.id = a.student_id
  where u.auth_user_id = auth.uid() and lower(u.role) = 'student'
));

commit;
