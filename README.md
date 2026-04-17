# vic-final

## Supabase SQL scripts for VIC backend setup

### 1) Fix class creation RLS + class code generation
Run `sql/fix_classes_rls_and_class_code.sql` in the **Supabase SQL editor**.

This script:
- Adds `users.auth_user_id` to connect `public.users` to `auth.users`.
- Fixes `classes` RLS so authenticated teachers can only view/manage their own classes.
- Auto-generates a unique 7-character `class_code` if one is not provided.

### 2) Seed bulk test data
Run `sql/dev_bulk_seed.sql` in the **Supabase SQL editor**.

This script inserts:
- 3 teachers
- 24 students
- 5 classes
- enrollments linking students to classes
- 2 sample lessons
