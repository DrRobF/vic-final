-- Assignments must be scoped to the class in which the teacher created them.
alter table public.assignments add column if not exists class_id bigint references public.classes(id) on delete cascade;

create index if not exists assignments_student_class_assigned_idx
  on public.assignments (student_id, class_id, assigned_at desc);

-- Existing rows cannot be class-scoped reliably when a student has multiple enrollments.
-- Backfill only the unambiguous single-enrollment case; teachers can reassign ambiguous lessons.
update public.assignments a
set class_id = e.class_id
from public.enrollments e
where a.class_id is null
  and a.student_id = e.student_id
  and 1 = (select count(*) from public.enrollments e2 where e2.student_id = a.student_id);
