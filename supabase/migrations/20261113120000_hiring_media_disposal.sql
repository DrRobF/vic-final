-- When a candidate's recordings were disposed of, and who did it.
--
-- The recording notice promises deletion within 180 days. Until now nothing kept that promise and
-- nothing recorded that it had been kept, which is the same problem: a promise you cannot show you
-- honoured is a promise you cannot defend.
--
-- Deliberately only the recordings. The scores, the notes, the written answers and the resume are
-- the record of how a decision was made, and a school may be required to keep them; a stamp here
-- says the video is gone while that record stays intact.
alter table public.ap_hiring_candidates
  add column if not exists media_deleted_at timestamptz,
  add column if not exists media_deleted_by text;

comment on column public.ap_hiring_candidates.media_deleted_at is
  'When this candidate''s video answers were deleted from storage. The scored record is kept.';

create index if not exists ap_hiring_candidates_media_pending_idx
  on public.ap_hiring_candidates(delete_after)
  where media_deleted_at is null;
