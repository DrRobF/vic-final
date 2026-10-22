-- A student's own grade (Oct 22, 2026). Mixed-grade classes (3/4, 4/5) mean the class grade
-- isn't the child's grade; VIC practice uses this to pick the right standards.
alter table public.users add column if not exists grade_level smallint check (grade_level between 0 and 12);
