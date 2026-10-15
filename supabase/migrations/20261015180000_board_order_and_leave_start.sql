-- Two leader controls (add-only):
--  board_order: the order staff tiles sit in on the dashboard, so a principal can put
--   whoever he looks at first at the top. Null falls back to last name.
--  leave_used_before / leave_from: AskVic only knows the days it has check-ins for.
--   leave_from is the date the count starts; leave_used_before carries in paid days a
--   person had already used before that, so the balance is right from day one.
alter table public.ap_staff add column if not exists board_order integer;
alter table public.ap_staff add column if not exists leave_used_before numeric check (leave_used_before >= 0 and leave_used_before <= 365);
alter table public.ap_schools add column if not exists leave_from date;
