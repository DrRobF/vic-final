-- School join codes and seat limits; staff accounts linked by join; walkthroughs for people not on the staff list.
alter table public.ap_schools add column if not exists join_code text unique check (join_code ~ '^[A-Z0-9]{3,6}-[0-9]{4}$');
alter table public.ap_schools add column if not exists seat_limit integer not null default 50 check (seat_limit between 1 and 5000);
alter table public.ap_staff add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.ap_staff add column if not exists joined_at timestamptz;
create unique index if not exists ap_staff_school_user_idx on public.ap_staff(school_id,auth_user_id) where auth_user_id is not null;
alter table public.ap_walkthroughs alter column staff_id drop not null;
alter table public.ap_walkthroughs add column if not exists teacher_name text not null default '' check (char_length(teacher_name)<=120);
alter table public.ap_walkthroughs drop constraint if exists ap_walkthroughs_teacher_check;
alter table public.ap_walkthroughs add constraint ap_walkthroughs_teacher_check check (staff_id is not null or char_length(btrim(teacher_name))>=2);
