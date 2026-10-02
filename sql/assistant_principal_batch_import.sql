-- Atomic, repeat-safe setup import. Only the server's service role can call it.
create or replace function public.ap_import_setup(
  p_school uuid, p_actor uuid, p_staff jsonb, p_commitments jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  added_staff int := 0;
  added_commitments int := 0;
  skipped_staff int := 0;
  skipped_commitments int := 0;
begin
  if jsonb_typeof(p_staff) <> 'array' or jsonb_typeof(p_commitments) <> 'array'
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

  -- Serialize two imports for the same school so duplicate checks stay reliable.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_school::text, 0));
  for item in select value from jsonb_array_elements(p_staff) loop
    if not exists (
      select 1 from public.ap_staff s where s.school_id = p_school
        and lower(s.display_name) = lower(item->>'display_name')
        and s.role = item->>'role'
    ) then
      if (select count(*) from public.ap_staff where school_id = p_school) >= 500 then
        raise exception 'School staff limit reached';
      end if;
      insert into public.ap_staff (school_id, display_name, role, email)
      values (p_school, item->>'display_name', item->>'role', nullif(item->>'email', ''));
      added_staff := added_staff + 1;
    else skipped_staff := skipped_staff + 1; end if;
  end loop;
  for item in select value from jsonb_array_elements(p_commitments) loop
    if not exists (
      select 1 from public.ap_commitments c where c.school_id = p_school
        and lower(c.title) = lower(item->>'title')
        and c.applies_to = item->>'applies_to' and c.cadence = item->>'cadence'
        and c.due_weekday is not distinct from (item->>'due_weekday')::smallint
        and c.due_time = (item->>'due_time')::time
    ) then
      if (select count(*) from public.ap_commitments where school_id = p_school) >= 100 then
        raise exception 'School commitment limit reached';
      end if;
      insert into public.ap_commitments (school_id, title, applies_to, cadence, due_weekday, due_time)
      values (p_school, item->>'title', item->>'applies_to', item->>'cadence',
              (item->>'due_weekday')::smallint, (item->>'due_time')::time);
      added_commitments := added_commitments + 1;
    else skipped_commitments := skipped_commitments + 1; end if;
  end loop;
  return jsonb_build_object('staffAdded', added_staff, 'commitmentsAdded', added_commitments,
                            'staffSkipped', skipped_staff, 'commitmentsSkipped', skipped_commitments);
end;
$$;
revoke all on function public.ap_import_setup(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ap_import_setup(uuid,uuid,jsonb,jsonb) to service_role;
