-- Scoring dimensions: content, fit, and writing (Nov 12, 2026).
--
-- The first version scored substance and delivery. Delivery turned out to be the wrong second
-- number. Nobody on a panel wants to grade a teacher's camera presence, and the thing a principal
-- is actually weighing alongside "is this answer any good" is "would this answer work here" --
-- does it match how this school teaches and what it expects of a teacher.
--
-- Content and fit are kept apart on purpose. They come apart more often than people expect: a
-- technically excellent answer can describe a school that is not this one, and a modest answer can
-- come from somebody who clearly belongs here. A panel that collapses them into one impression
-- ends up arguing without knowing what it disagrees about.
--
-- Written answers carry a third number for grammar and clarity. Teachers write to families
-- constantly, and an error rate becomes the principal's problem in week three.

alter table public.ap_hiring_questions rename column max_substance to max_content;
alter table public.ap_hiring_questions rename column max_delivery to max_fit;
alter table public.ap_hiring_questions add column if not exists max_writing smallint not null default 0;

alter table public.ap_hiring_questions drop constraint if exists ap_hiring_questions_max_substance_check;
alter table public.ap_hiring_questions drop constraint if exists ap_hiring_questions_max_delivery_check;
alter table public.ap_hiring_questions add constraint ap_hiring_questions_max_content_check check (max_content between 1 and 50);
alter table public.ap_hiring_questions add constraint ap_hiring_questions_max_fit_check check (max_fit between 0 and 50);
alter table public.ap_hiring_questions add constraint ap_hiring_questions_max_writing_check check (max_writing between 0 and 10);

-- Questions already created keep their wording and their ordinals; only the scales move.
update public.ap_hiring_questions
 set max_content = 5,
     max_fit = 5,
     max_writing = case when stage = 'written' then 3 else 0 end;

alter table public.ap_hiring_scores rename column substance to content;
alter table public.ap_hiring_scores rename column delivery to fit;
alter table public.ap_hiring_scores add column if not exists writing smallint not null default 0 check (writing >= 0);

-- A panel observation, never a verdict, and never produced by a machine. Written answers can be
-- generated; what a human can honestly notice is that a written answer does not sound like the
-- person in the video. That is a reason to ask about it in the next round, not a reason to reject
-- anyone, so it is recorded as a question to follow up and carries no points either way.
alter table public.ap_hiring_scores add column if not exists voice_mismatch boolean not null default false;

comment on column public.ap_hiring_scores.voice_mismatch is
 'Set by a human scorer who noticed the written answer does not sound like the candidate in their '
 'video. It is a prompt to ask the candidate about it in the next round, never evidence and never '
 'a score. Do not wire this to an AI-detection service: those tools report confident false '
 'positives, they are worse on non-native English writers, and a wrong call here costs somebody a '
 'job they should have had.';

-- Existing scores were given against substance and delivery. Substance carries over to content,
-- clamped to the new scale. Delivery does NOT carry over to fit -- they are different questions,
-- and copying one into the other would invent data that nobody entered. Those are zeroed, the
-- scorer's written notes are kept, and the answers need scoring again.
update public.ap_hiring_scores
 set content = least(content, 5),
     fit = 0,
     writing = 0;

alter table public.ap_hiring_scores drop constraint if exists ap_hiring_scores_substance_check;
alter table public.ap_hiring_scores drop constraint if exists ap_hiring_scores_delivery_check;
alter table public.ap_hiring_scores add constraint ap_hiring_scores_content_check check (content >= 0);
alter table public.ap_hiring_scores add constraint ap_hiring_scores_fit_check check (fit >= 0);
