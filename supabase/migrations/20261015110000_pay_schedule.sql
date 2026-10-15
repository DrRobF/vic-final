-- Pay periods: every two weeks from a start date, or twice a month (1st–15th and 16th–end).
alter table public.ap_schools add column if not exists pay_schedule text not null default 'biweekly';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ap_schools_pay_schedule_check') then
    alter table public.ap_schools add constraint ap_schools_pay_schedule_check check (pay_schedule in ('biweekly','semimonthly'));
  end if;
end $$;
