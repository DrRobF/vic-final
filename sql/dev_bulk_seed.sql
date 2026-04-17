-- VIC bulk developer seed data
-- Run this in the Supabase SQL editor.
-- This is safe to re-run: it upserts by email for users and avoids duplicate enrollments.

begin;

-- -------------------------------------------------------------------
-- 1) Teachers
-- -------------------------------------------------------------------
insert into public.users (name, email, role)
values
  ('Maya Thompson', 'maya.thompson@vicdemo.edu', 'teacher'),
  ('Daniel Rivera', 'daniel.rivera@vicdemo.edu', 'teacher'),
  ('Priya Patel', 'priya.patel@vicdemo.edu', 'teacher')
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role;

-- -------------------------------------------------------------------
-- 2) Students (24 total)
-- -------------------------------------------------------------------
insert into public.users (name, email, role)
values
  ('Aiden Brooks', 'aiden.brooks@vicdemo.edu', 'student'),
  ('Bella Nguyen', 'bella.nguyen@vicdemo.edu', 'student'),
  ('Caleb Foster', 'caleb.foster@vicdemo.edu', 'student'),
  ('Delilah Evans', 'delilah.evans@vicdemo.edu', 'student'),
  ('Ethan Kim', 'ethan.kim@vicdemo.edu', 'student'),
  ('Faith Johnson', 'faith.johnson@vicdemo.edu', 'student'),
  ('Gabriel Morris', 'gabriel.morris@vicdemo.edu', 'student'),
  ('Hannah Reed', 'hannah.reed@vicdemo.edu', 'student'),
  ('Isaac Turner', 'isaac.turner@vicdemo.edu', 'student'),
  ('Jasmine Collins', 'jasmine.collins@vicdemo.edu', 'student'),
  ('Kai Phillips', 'kai.phillips@vicdemo.edu', 'student'),
  ('Lila Bennett', 'lila.bennett@vicdemo.edu', 'student'),
  ('Mason Price', 'mason.price@vicdemo.edu', 'student'),
  ('Nora Hughes', 'nora.hughes@vicdemo.edu', 'student'),
  ('Owen Parker', 'owen.parker@vicdemo.edu', 'student'),
  ('Penelope Gray', 'penelope.gray@vicdemo.edu', 'student'),
  ('Quinn Ward', 'quinn.ward@vicdemo.edu', 'student'),
  ('Riley Sanders', 'riley.sanders@vicdemo.edu', 'student'),
  ('Sofia Perry', 'sofia.perry@vicdemo.edu', 'student'),
  ('Theo Flores', 'theo.flores@vicdemo.edu', 'student'),
  ('Uma Bryant', 'uma.bryant@vicdemo.edu', 'student'),
  ('Victor Ross', 'victor.ross@vicdemo.edu', 'student'),
  ('Willow Hayes', 'willow.hayes@vicdemo.edu', 'student'),
  ('Xavier Long', 'xavier.long@vicdemo.edu', 'student')
on conflict (email) do update set
  name = excluded.name,
  role = excluded.role;

-- -------------------------------------------------------------------
-- 3) Classes (5 total)
-- -------------------------------------------------------------------
with teacher_rows as (
  select id, email from public.users where email in (
    'maya.thompson@vicdemo.edu',
    'daniel.rivera@vicdemo.edu',
    'priya.patel@vicdemo.edu'
  )
)
insert into public.classes (class_name, grade_level, teacher_id)
select class_name, grade_level, teacher_id
from (
  select 'Algebra Foundations'::text as class_name, '7'::text as grade_level,
         (select id from teacher_rows where email = 'maya.thompson@vicdemo.edu') as teacher_id
  union all
  select 'Math Intervention A', '6',
         (select id from teacher_rows where email = 'maya.thompson@vicdemo.edu')
  union all
  select 'ELA Reading Lab', '7',
         (select id from teacher_rows where email = 'daniel.rivera@vicdemo.edu')
  union all
  select 'Science Skills Studio', '8',
         (select id from teacher_rows where email = 'priya.patel@vicdemo.edu')
  union all
  select 'Writing Workshop', '8',
         (select id from teacher_rows where email = 'daniel.rivera@vicdemo.edu')
) seeded
where seeded.teacher_id is not null
  and not exists (
    select 1
    from public.classes c
    where c.class_name = seeded.class_name
      and c.teacher_id = seeded.teacher_id
  );

-- -------------------------------------------------------------------
-- 4) Enrollments (24 students distributed across the 5 classes)
-- -------------------------------------------------------------------
with class_rows as (
  select id, class_name from public.classes where class_name in (
    'Algebra Foundations',
    'Math Intervention A',
    'ELA Reading Lab',
    'Science Skills Studio',
    'Writing Workshop'
  )
), student_rows as (
  select id, email from public.users where role = 'student' and email like '%@vicdemo.edu'
), enrollment_seed as (
  -- Algebra Foundations
  select (select id from student_rows where email = 'aiden.brooks@vicdemo.edu') as student_id,
         (select id from class_rows where class_name = 'Algebra Foundations') as class_id
  union all select (select id from student_rows where email = 'bella.nguyen@vicdemo.edu'), (select id from class_rows where class_name = 'Algebra Foundations')
  union all select (select id from student_rows where email = 'caleb.foster@vicdemo.edu'), (select id from class_rows where class_name = 'Algebra Foundations')
  union all select (select id from student_rows where email = 'delilah.evans@vicdemo.edu'), (select id from class_rows where class_name = 'Algebra Foundations')
  union all select (select id from student_rows where email = 'ethan.kim@vicdemo.edu'), (select id from class_rows where class_name = 'Algebra Foundations')

  -- Math Intervention A
  union all select (select id from student_rows where email = 'faith.johnson@vicdemo.edu'), (select id from class_rows where class_name = 'Math Intervention A')
  union all select (select id from student_rows where email = 'gabriel.morris@vicdemo.edu'), (select id from class_rows where class_name = 'Math Intervention A')
  union all select (select id from student_rows where email = 'hannah.reed@vicdemo.edu'), (select id from class_rows where class_name = 'Math Intervention A')
  union all select (select id from student_rows where email = 'isaac.turner@vicdemo.edu'), (select id from class_rows where class_name = 'Math Intervention A')
  union all select (select id from student_rows where email = 'jasmine.collins@vicdemo.edu'), (select id from class_rows where class_name = 'Math Intervention A')

  -- ELA Reading Lab
  union all select (select id from student_rows where email = 'kai.phillips@vicdemo.edu'), (select id from class_rows where class_name = 'ELA Reading Lab')
  union all select (select id from student_rows where email = 'lila.bennett@vicdemo.edu'), (select id from class_rows where class_name = 'ELA Reading Lab')
  union all select (select id from student_rows where email = 'mason.price@vicdemo.edu'), (select id from class_rows where class_name = 'ELA Reading Lab')
  union all select (select id from student_rows where email = 'nora.hughes@vicdemo.edu'), (select id from class_rows where class_name = 'ELA Reading Lab')
  union all select (select id from student_rows where email = 'owen.parker@vicdemo.edu'), (select id from class_rows where class_name = 'ELA Reading Lab')

  -- Science Skills Studio
  union all select (select id from student_rows where email = 'penelope.gray@vicdemo.edu'), (select id from class_rows where class_name = 'Science Skills Studio')
  union all select (select id from student_rows where email = 'quinn.ward@vicdemo.edu'), (select id from class_rows where class_name = 'Science Skills Studio')
  union all select (select id from student_rows where email = 'riley.sanders@vicdemo.edu'), (select id from class_rows where class_name = 'Science Skills Studio')
  union all select (select id from student_rows where email = 'sofia.perry@vicdemo.edu'), (select id from class_rows where class_name = 'Science Skills Studio')
  union all select (select id from student_rows where email = 'theo.flores@vicdemo.edu'), (select id from class_rows where class_name = 'Science Skills Studio')

  -- Writing Workshop
  union all select (select id from student_rows where email = 'uma.bryant@vicdemo.edu'), (select id from class_rows where class_name = 'Writing Workshop')
  union all select (select id from student_rows where email = 'victor.ross@vicdemo.edu'), (select id from class_rows where class_name = 'Writing Workshop')
  union all select (select id from student_rows where email = 'willow.hayes@vicdemo.edu'), (select id from class_rows where class_name = 'Writing Workshop')
  union all select (select id from student_rows where email = 'xavier.long@vicdemo.edu'), (select id from class_rows where class_name = 'Writing Workshop')
)
insert into public.enrollments (student_id, class_id)
select student_id, class_id
from enrollment_seed e
where e.student_id is not null
  and e.class_id is not null
  and not exists (
    select 1
    from public.enrollments existing
    where existing.student_id = e.student_id
      and existing.class_id = e.class_id
  );

-- -------------------------------------------------------------------
-- 5) Sample lessons (2 lessons)
-- -------------------------------------------------------------------
insert into public.lessons (subject, title, lesson_text, is_active)
values
  (
    'Math',
    'Two-Step Equation Warmup',
    'Solve each two-step equation and show your inverse operations. Explain each step in one sentence.',
    true
  ),
  (
    'ELA',
    'Main Idea and Evidence',
    'Read the short passage, identify the main idea, and list two details that support it.',
    true
  )
on conflict do nothing;

commit;
