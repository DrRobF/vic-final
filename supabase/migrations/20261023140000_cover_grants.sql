-- Sub coverage: "the lesson still happens" (Oct 23, 2026).
--
-- A principal hands the day's lessons to whoever is covering a class. That person may be a
-- teacher already on staff, or a sub nobody has met who walks in at 7:30, so the credential
-- is a short code on a printed slip rather than an account: there is nothing to set up, no
-- email round-trip at the start of a school day, and nothing left behind afterwards.
--
-- What a grant can do is deliberately small. It names the exact classes and the one date it
-- is for, and all it permits is putting those classes' own teachers' planned lessons on the
-- students' screens. It cannot read the teacher's full plan, cannot touch another class, and
-- cannot be used the next day. That is why a plaintext code is safe enough here, and the
-- principal needs to re-read it to reprint a slip -- the same reasoning as vic_rooms.code.
--
-- Server-only: row level security on with no policies, so only the service role reads it.
create table if not exists public.cover_grants (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.ap_schools(id) on delete cascade,
  -- The one school day this grant is for. Coverage is a day's arrangement, never standing.
  day date not null,
  -- The classes being covered. A class is a period, so one class covers a period and
  -- several cover a day; no separate setting for which.
  class_ids bigint[] not null check (array_length(class_ids, 1) between 1 and 40),
  -- Who is covering, as the principal wrote it. For the slip, and so the record of who was
  -- in the room survives the day.
  covering_name text not null check (char_length(covering_name) between 1 and 120),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  note text not null default '' check (char_length(note) <= 300),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- Taking coverage back before the day is out: the sub did not come, or the teacher made it in.
  revoked_at timestamptz,
  last_opened_at timestamptz
);
create index if not exists cover_grants_school_day_idx on public.cover_grants (school_id, day desc);
alter table public.cover_grants enable row level security;
revoke all on public.cover_grants from public, anon, authenticated;
grant select, insert, update, delete on public.cover_grants to service_role;

-- Guessing a code is the only way in, so attempts get a budget. Eight characters from a
-- 32-letter alphabet is about 10^12 codes, and a hit would still only reach the named
-- classes on the named day -- but a lock on the door costs nothing.
create or replace function public.claim_cover_attempt(ip_bucket text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare total_count integer;
begin
 insert into public.lesson_request_windows values ('cover-ip:'||ip_bucket, now(), 0)
 on conflict (bucket) do update set
  started_at=case when lesson_request_windows.started_at < now()-interval '10 minutes' then now() else lesson_request_windows.started_at end,
  requests=case when lesson_request_windows.started_at < now()-interval '10 minutes' then 0 else lesson_request_windows.requests end;
 select requests into total_count from public.lesson_request_windows where bucket='cover-ip:'||ip_bucket for update;
 if total_count >= 20 then return false; end if;
 update public.lesson_request_windows set requests=requests+1 where bucket='cover-ip:'||ip_bucket;
 return true;
end $$;
revoke all on function public.claim_cover_attempt(text) from public,anon,authenticated;
grant execute on function public.claim_cover_attempt(text) to service_role;
