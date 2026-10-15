-- Flexible-hours staff (only hours are counted, no late/absent flags) and part-time work days (0 = Sunday … 6 = Saturday).
alter table public.ap_staff add column if not exists flexible boolean not null default false;
alter table public.ap_staff add column if not exists work_days smallint[];
