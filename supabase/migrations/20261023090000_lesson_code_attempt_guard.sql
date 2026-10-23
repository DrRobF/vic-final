-- Rate limit for entering a sign-in code, separate from the limit on sending one.
--
-- Codes can now be typed for an alias address (the school address issued after signup),
-- which means the code box is reachable for more addresses than before. A six-digit code
-- is small enough to guess if somebody is allowed to keep trying, so attempts get their
-- own budget. Supabase limits this too; this is the second lock on the same door.
--
-- Reuses lesson_request_windows (see sql/free_lesson_access.sql) with its own bucket
-- names, so sending an email and typing a code never spend each other's allowance.
create or replace function public.claim_lesson_code_attempt(email_bucket text,ip_bucket text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare total_count integer; item record;
begin
 insert into public.lesson_request_windows values ('code-global',date_trunc('day',now()),0)
 on conflict (bucket) do update set started_at=case when lesson_request_windows.started_at < date_trunc('day',now()) then date_trunc('day',now()) else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at < date_trunc('day',now()) then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket='code-global' for update;
 if total_count>=600 then return false; end if;
 for item in select * from (values ('code-email:'||email_bucket,10),('code-ip:'||ip_bucket,20)) as limits(bucket,cap) loop
 insert into public.lesson_request_windows values(item.bucket,now(),0)
 on conflict(bucket) do update set started_at=case when lesson_request_windows.started_at<now()-interval '10 minutes' then now() else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at<now()-interval '10 minutes' then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket=item.bucket for update;
 if total_count>=item.cap then return false; end if;
 end loop;
 update public.lesson_request_windows set requests=requests+1 where bucket in ('code-global','code-email:'||email_bucket,'code-ip:'||ip_bucket);
 return true;
end $$;
revoke all on function public.claim_lesson_code_attempt(text,text) from public,anon,authenticated;
grant execute on function public.claim_lesson_code_attempt(text,text) to service_role;
