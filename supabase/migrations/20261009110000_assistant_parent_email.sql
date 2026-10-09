-- Add the "Parent email from my notes" tool to the educator personal assistant.
alter table public.educator_assistant_work drop constraint if exists educator_assistant_work_kind_check;
alter table public.educator_assistant_work add constraint educator_assistant_work_kind_check
 check (kind in ('parent_email','weekly','communication','meeting','pd','tasks'));
