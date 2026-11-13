-- A candidate's resume, attached on the screening page. The file lives in the private hiring-media
-- bucket under the candidate's own folder; these columns just remember which file and what it was
-- called, so the panel can open it next to the recordings.
alter table public.ap_hiring_candidates
  add column if not exists resume_path text,
  add column if not exists resume_name text;

comment on column public.ap_hiring_candidates.resume_path is
  'Storage path in hiring-media. Removed with the rest of the candidate''s files at the disposal date.';
