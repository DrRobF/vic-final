-- Who is accountable for the children in a room, as distinct from who may open its screen
-- (Oct 28, 2026).
--
-- A VIC Room's `staff_ids` has been doing two unrelated jobs: deciding who may open the room,
-- and deciding who is emailed when a child tells VIC something worrying. That was harmless
-- while the only room had one aide on it. It stops being harmless the moment a principal adds
-- the rest of the staff so they can cover a room or learn the screen -- because every one of
-- them then starts receiving other people's children's safety disclosures, and a child's worst
-- morning is mailed to a dozen adults who do not teach them.
--
-- The fan-out also damages the alerts themselves. An alert that reaches people with nothing to
-- do about it is an alert people learn to skim, and this is the one email in the product that
-- must never be skimmed.
--
-- So: `staff_ids` keeps its original meaning, access, and `aide_ids` holds the adults actually
-- on duty for these children. Safety alerts go to the child's own class teachers plus the
-- room's aides. Backfilled from `staff_ids`, so no existing room loses a recipient today.
--
-- Note for whoever changes the room UI next: adding somebody to `staff_ids` deliberately does
-- NOT put them on the alert list. The room screen now prints who the recipients are, so an
-- aide who ought to be on it is visible rather than silently missing.

alter table public.vic_rooms
  add column if not exists aide_ids bigint[] not null default '{}'::bigint[];

-- Every room that exists today was using staff_ids as its alert list, so that is what its
-- aides are. Only runs where aide_ids has not already been set.
update public.vic_rooms
   set aide_ids = staff_ids
 where aide_ids = '{}'::bigint[]
   and staff_ids <> '{}'::bigint[];

comment on column public.vic_rooms.staff_ids is
  'Adults who may OPEN this room''s screen. Not the safety-alert list.';
comment on column public.vic_rooms.aide_ids is
  'Adults on duty for these children. Receive safety alerts alongside the child''s class teachers.';
