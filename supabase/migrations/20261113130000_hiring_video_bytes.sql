-- How large each recording actually is.
--
-- A school on a storage plan it can only just afford needs to see what it is using, on the screen
-- where it decides whose recordings to keep. Without this the only honest answer to "how much room
-- is left" is a guess from durations, and a guess is what runs a hiring round into a full bucket on
-- a Sunday night with a candidate halfway through uploading.
alter table public.ap_hiring_responses
  add column if not exists video_bytes bigint;

comment on column public.ap_hiring_responses.video_bytes is
  'Size of the stored recording, as storage reported it when the upload was confirmed. Null once deleted.';
