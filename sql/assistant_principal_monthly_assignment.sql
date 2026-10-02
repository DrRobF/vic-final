-- Add staff assignment labels and monthly recurring commitments.
alter table public.ap_staff add column if not exists assignment text not null default '';
alter table public.ap_staff drop constraint if exists ap_staff_assignment_check;
alter table public.ap_staff add constraint ap_staff_assignment_check check (length(assignment) <= 120);

alter table public.ap_commitments add column if not exists due_monthday smallint;
alter table public.ap_commitments drop constraint if exists ap_commitments_cadence_check;
alter table public.ap_commitments add constraint ap_commitments_cadence_check
  check (cadence in ('daily', 'weekly', 'monthly'));
alter table public.ap_commitments drop constraint if exists ap_commitments_check;
alter table public.ap_commitments add constraint ap_commitments_check check (
  (cadence = 'daily' and due_weekday is null and due_monthday is null) or
  (cadence = 'weekly' and due_weekday is not null and due_monthday is null) or
  (cadence = 'monthly' and due_weekday is null and due_monthday between 1 and 31)
);

-- Same atomic import entry point; an existing staff row can gain a grade/assignment.
create or replace function public.ap_import_setup(
  p_school uuid, p_actor uuid, p_staff jsonb, p_commitments jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  added_staff int := 0;
  updated_staff int := 0;
  added_commitments int := 0;
  skipped_staff int := 0;
  skipped_commitments int := 0;
  changed int;
begin
  if jsonb_typeof(p_staff) is distinct from 'array' or jsonb_typeof(p_commitments) is distinct from 'array'
     or jsonb_array_length(p_staff) + jsonb_array_length(p_commitments) > 500
     or jsonb_array_length(p_commitments) > 100 then
    raise exception 'Invalid import size';
  end if;
  if not exists (
    select 1 from public.ap_memberships m
    join public.ap_entitlements e on e.auth_user_id = m.auth_user_id
    where m.school_id = p_school and m.auth_user_id = p_actor
      and e.status in ('trial', 'active') and (e.expires_at is null or e.expires_at > now())
  ) then raise exception 'School access denied'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_school::text, 0));
  for item in select value from jsonb_array_elements(p_staff) loop
    if not exists (
      select 1 from public.ap_staff s where s.school_id = p_school
        and lower(s.display_name) = lower(item->>'display_name') and s.role = item->>'role'
    ) then
      if (select count(*) from public.ap_staff where school_id = p_school) >= 500 then
        raise exception 'School staff limit reached';
      end if;
      insert into public.ap_staff (school_id, display_name, role, assignment, email)
      values (p_school, item->>'display_name', item->>'role', coalesce(item->>'assignment', ''), nullif(item->>'email', ''));
      added_staff := added_staff + 1;
    else
      update public.ap_staff s set
        assignment = coalesce(nullif(item->>'assignment', ''), s.assignment),
        email = coalesce(nullif(item->>'email', ''), s.email)
      where s.school_id = p_school and lower(s.display_name) = lower(item->>'display_name')
        and s.role = item->>'role'
        and ((nullif(item->>'assignment', '') is not null and s.assignment is distinct from item->>'assignment')
          or (nullif(item->>'email', '') is not null and s.email is distinct from item->>'email'));
      get diagnostics changed = row_count;
      if changed > 0 then updated_staff := updated_staff + changed;
      else skipped_staff := skipped_staff + 1; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(p_commitments) loop
    if not exists (
      select 1 from public.ap_commitments c where c.school_id = p_school
        and lower(c.title) = lower(item->>'title')
        and c.applies_to = item->>'applies_to' and c.cadence = item->>'cadence'
        and c.due_weekday is not distinct from (item->>'due_weekday')::smallint
        and c.due_monthday is not distinct from (item->>'due_monthday')::smallint
        and c.due_time = (item->>'due_time')::time
    ) then
      if (select count(*) from public.ap_commitments where school_id = p_school) >= 100 then
        raise exception 'School commitment limit reached';
      end if;
      insert into public.ap_commitments (school_id, title, applies_to, cadence, due_weekday, due_monthday, due_time)
      values (p_school, item->>'title', item->>'applies_to', item->>'cadence',
              (item->>'due_weekday')::smallint, (item->>'due_monthday')::smallint, (item->>'due_time')::time);
      added_commitments := added_commitments + 1;
    else skipped_commitments := skipped_commitments + 1; end if;
  end loop;
  return jsonb_build_object('staffAdded', added_staff, 'staffUpdated', updated_staff,
                            'commitmentsAdded', added_commitments, 'staffSkipped', skipped_staff,
                            'commitmentsSkipped', skipped_commitments);
end;
$$;
revoke all on function public.ap_import_setup(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ap_import_setup(uuid,uuid,jsonb,jsonb) to service_role;
