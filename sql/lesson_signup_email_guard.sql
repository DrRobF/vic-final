create function public.claim_lesson_signup_email(email_bucket text,ip_bucket text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare total_count integer; item record;
begin
 insert into public.lesson_request_windows values ('email-global',date_trunc('day',now()),0)
 on conflict (bucket) do update set started_at=case when lesson_request_windows.started_at < date_trunc('day',now()) then date_trunc('day',now()) else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at < date_trunc('day',now()) then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket='email-global' for update;
 if total_count>=75 then return false; end if;
 for item in select * from (values ('email:'||email_bucket,3),('ip:'||ip_bucket,10)) as limits(bucket,cap) loop
 insert into public.lesson_request_windows values(item.bucket,now(),0)
 on conflict(bucket) do update set started_at=case when lesson_request_windows.started_at<now()-interval '10 minutes' then now() else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at<now()-interval '10 minutes' then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket=item.bucket for update;
 if total_count>=item.cap then return false; end if;
 end loop;
 update public.lesson_request_windows set requests=requests+1 where bucket in ('email-global','email:'||email_bucket,'ip:'||ip_bucket);
 return true;
end $$;
revoke all on function public.claim_lesson_signup_email(text,text) from public,anon,authenticated;
grant execute on function public.claim_lesson_signup_email(text,text) to service_role;
