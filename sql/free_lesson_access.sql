create table public.lesson_memberships (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 newsletter_consent boolean not null,
 consent_text text not null, consent_version text not null,
 consented_at timestamptz not null default now(), unsubscribed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.lesson_memberships enable row level security;
revoke all on public.lesson_memberships from anon,authenticated;
grant all on public.lesson_memberships to service_role;
create table public.lesson_request_windows (
 bucket text primary key, started_at timestamptz not null, requests integer not null
);
alter table public.lesson_request_windows enable row level security;
revoke all on public.lesson_request_windows from anon,authenticated;
grant all on public.lesson_request_windows to service_role;
create function public.claim_lesson_request(request_user uuid, daily_budget integer default 500)
returns boolean language plpgsql security invoker set search_path = public,pg_temp as $$
declare user_count integer; total_count integer;
begin
 -- Fixed lock order gives an atomic global cost ceiling across concurrent server instances.
 insert into public.lesson_request_windows values ('global',date_trunc('day',now()),0)
 on conflict (bucket) do update set started_at=case when lesson_request_windows.started_at < date_trunc('day',now()) then date_trunc('day',now()) else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at < date_trunc('day',now()) then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket='global' for update;
 if total_count >= greatest(1,least(daily_budget,10000)) then return false; end if;
 insert into public.lesson_request_windows values (request_user::text,now(),0)
 on conflict (bucket) do update set started_at=case when lesson_request_windows.started_at < now()-interval '10 minutes' then now() else lesson_request_windows.started_at end,
 requests=case when lesson_request_windows.started_at < now()-interval '10 minutes' then 0 else lesson_request_windows.requests end;
 select requests into user_count from public.lesson_request_windows where bucket=request_user::text for update;
 if user_count>=10 then return false; end if;
 update public.lesson_request_windows set requests=requests+1 where bucket in ('global',request_user::text);
 return true;
end $$;
revoke all on function public.claim_lesson_request(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_lesson_request(uuid,integer) to service_role;
