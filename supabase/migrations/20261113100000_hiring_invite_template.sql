-- Each position carries its own invitation email and its own default time to submit. A null subject
-- or body means "use the standard wording"; the standard wording lives in code so improving it
-- reaches every position that never customised it.
alter table public.ap_hiring_postings
  add column if not exists invite_subject text,
  add column if not exists invite_body text,
  add column if not exists invite_hours integer not null default 48;

alter table public.ap_hiring_postings
  drop constraint if exists ap_hiring_postings_invite_hours_check;
alter table public.ap_hiring_postings
  add constraint ap_hiring_postings_invite_hours_check check (invite_hours between 1 and 720);
