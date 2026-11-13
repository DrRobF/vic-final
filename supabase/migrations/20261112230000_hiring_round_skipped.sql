-- A round a school deliberately did not run (Nov 12, 2026).
--
-- Clearing a round used to delete the row, which made "we did not do this round" look exactly like
-- "nobody has got to this yet". On the progress ladder those are opposite facts: a skipped round
-- should stop being a gate, and an unscored one should keep the candidate waiting.
--
-- Not every position gets a demo lesson, and a school hiring one aide from four applicants does not
-- need a scored resume screen. Without this, such a candidate sits one rung short forever.
alter table public.ap_hiring_round_scores add column if not exists skipped boolean not null default false;

comment on column public.ap_hiring_round_scores.skipped is
 'True when the school deliberately did not run this round for this candidate. A skipped round '
 'contributes nothing to the packet total on either side, and does not hold the progress ladder '
 'open. It is never the same as a round scored zero.';
