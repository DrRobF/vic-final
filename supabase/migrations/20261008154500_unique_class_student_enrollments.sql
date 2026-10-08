-- Keep a student enrolled once per classroom, including concurrent add requests.
create unique index if not exists enrollments_class_student_unique
on public.enrollments(class_id,student_id);
