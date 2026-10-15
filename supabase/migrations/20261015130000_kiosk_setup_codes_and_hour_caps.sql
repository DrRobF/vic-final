-- Set up a kiosk with a short one-time code (no leader login on that computer),
-- and cap paid hours per day (school default + per person) with leader-approved extra time.
alter table public.ap_kiosks add column if not exists setup_code_hash text;
alter table public.ap_kiosks add column if not exists setup_expires_at timestamptz;
alter table public.ap_kiosks add column if not exists claimed_at timestamptz;
update public.ap_kiosks set claimed_at = created_at where claimed_at is null;
create unique index if not exists ap_kiosks_setup_code_idx on public.ap_kiosks(setup_code_hash) where setup_code_hash is not null;
alter table public.ap_staff add column if not exists max_daily_hours numeric;
alter table public.ap_schools add column if not exists max_daily_hours numeric;
alter table public.ap_punches add column if not exists extra_approved boolean not null default false;
alter table public.ap_punches add column if not exists approved_by uuid;
