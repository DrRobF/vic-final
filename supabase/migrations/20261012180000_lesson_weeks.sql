-- Weekly lesson plans: a teacher plans five daily lessons (one standard per day), then sends the week
-- to their school leaders. Every planned standard is also stored as its own row so later releases can
-- build a curriculum map and show which standards are missing or repeated across the year.
-- Each day's full lesson stays in the teacher's private library (educator_lessons). Leaders only ever see
-- the snapshot stored in lesson_weeks.submission when the teacher sends the week.

create table if not exists public.lesson_weeks (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 week_of date not null check (extract(isodow from week_of)=1),
 state text not null default '' check (char_length(state)<=60),
 grade text not null default '' check (char_length(grade)<=30),
 subject text not null default '' check (char_length(subject)<=100),
 minutes integer not null default 45 check (minutes between 10 and 180),
 days jsonb not null default '[]'::jsonb check (jsonb_typeof(days)='array'),
 settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings)='object'),
 status text not null default 'draft' check (status in ('draft','submitted','reviewed')),
 school_id uuid references public.ap_schools(id) on delete set null,
 staff_id uuid,
 teacher_name text not null default '' check (char_length(teacher_name)<=120),
 sent_to_email text check (sent_to_email is null or char_length(sent_to_email)<=254),
 submission jsonb check (submission is null or jsonb_typeof(submission)='object'),
 submitted_at timestamptz,
 edited_after_submit boolean not null default false,
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id) on delete set null,
 reviewer_name text not null default '' check (char_length(reviewer_name)<=120),
 principal_comment text not null default '' check (char_length(principal_comment)<=2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists lesson_weeks_user_idx on public.lesson_weeks(user_id,week_of desc);
create index if not exists lesson_weeks_school_idx on public.lesson_weeks(school_id,week_of desc,status) where school_id is not null;
create index if not exists lesson_weeks_email_sends_idx on public.lesson_weeks(user_id,submitted_at) where sent_to_email is not null;

create table if not exists public.lesson_week_standards (
 week_id uuid not null references public.lesson_weeks(id) on delete cascade,
 day_index smallint not null check (day_index between 0 and 4),
 user_id uuid not null references auth.users(id) on delete cascade,
 school_id uuid references public.ap_schools(id) on delete set null,
 lesson_date date not null,
 state text not null default '',
 grade text not null default '',
 subject text not null default '',
 standard_code text not null check (char_length(standard_code) between 1 and 100),
 standard_text text not null default '' check (char_length(standard_text)<=5000),
 origin text not null check (origin in ('official','teacher')),
 primary key (week_id,day_index,standard_code)
);
create index if not exists lesson_week_standards_school_idx on public.lesson_week_standards(school_id,subject,grade,standard_code) where school_id is not null;
create index if not exists lesson_week_standards_user_idx on public.lesson_week_standards(user_id,standard_code);

alter table public.lesson_weeks enable row level security;
alter table public.lesson_week_standards enable row level security;
revoke all on public.lesson_weeks, public.lesson_week_standards from public,anon,authenticated;
grant select,insert,update,delete on public.lesson_weeks, public.lesson_week_standards to service_role;

-- Building a full week takes up to ten AI requests (five lessons and five worksheets), so week requests
-- may use a higher per-user burst. The global daily budget is unchanged and still caps total cost.
-- The two-argument call used everywhere else keeps the original limit of 10 per 10 minutes.
drop function if exists public.claim_lesson_request(uuid,integer);
create or replace function public.claim_lesson_request(request_user uuid, daily_budget integer default 500, user_limit integer default 10)
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
 if user_count>=greatest(1,least(coalesce(user_limit,10),30)) then return false; end if;
 update public.lesson_request_windows set requests=requests+1 where bucket in ('global',request_user::text);
 return true;
end $$;
revoke all on function public.claim_lesson_request(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_lesson_request(uuid,integer,integer) to service_role;
