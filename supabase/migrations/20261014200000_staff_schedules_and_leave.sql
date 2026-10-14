-- Per-person schedule (late / left-early checks), paid leave allowances, and odd-row flags from the check-in sheet.
alter table public.ap_staff add column if not exists shift_start text;
alter table public.ap_staff add column if not exists shift_end text;
alter table public.ap_staff add column if not exists sick_days numeric;
alter table public.ap_staff add column if not exists personal_days numeric;
alter table public.ap_attendance add column if not exists flag text;
