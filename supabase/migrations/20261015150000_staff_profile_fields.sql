-- Staff profile details a principal keeps in one place (add-only).
alter table public.ap_staff add column if not exists phone text check (char_length(phone) <= 40);
alter table public.ap_staff add column if not exists start_date date;
alter table public.ap_staff add column if not exists emergency_name text check (char_length(emergency_name) <= 120);
alter table public.ap_staff add column if not exists emergency_phone text check (char_length(emergency_phone) <= 40);
alter table public.ap_staff add column if not exists notes text check (char_length(notes) <= 2000);
