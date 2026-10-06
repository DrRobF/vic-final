-- Removed school accounts keep their profile and work, but lose school access.
BEGIN;
ALTER POLICY "Teachers can delete own classes" ON public.classes USING (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher'));
ALTER POLICY "Teachers can insert own classes" ON public.classes WITH CHECK (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher'));
ALTER POLICY "Teachers can read their own classes" ON public.classes USING (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher'));
ALTER POLICY "Teachers can update own classes" ON public.classes USING (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher')) WITH CHECK (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher'));
ALTER POLICY "Teachers can view own classes" ON public.classes USING (teacher_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'teacher'));
ALTER POLICY "Teachers can read enrollments for their own classes" ON public.enrollments USING (EXISTS (SELECT 1 FROM public.classes c JOIN public.users t ON t.id = c.teacher_id WHERE c.id = enrollments.class_id AND t.auth_user_id = (SELECT auth.uid()) AND lower(t.role) = 'teacher'));
ALTER POLICY "teachers_can_read_enrollments_in_own_classes" ON public.enrollments USING (EXISTS (SELECT 1 FROM public.classes c JOIN public.users t ON t.id = c.teacher_id WHERE c.id = enrollments.class_id AND t.auth_user_id = (SELECT auth.uid()) AND lower(t.role) = 'teacher'));
ALTER POLICY "Students can read their own assignments" ON public.assignments USING (student_id IN (SELECT id FROM public.users WHERE auth_user_id = (SELECT auth.uid()) AND lower(role) = 'student'));
COMMIT;
