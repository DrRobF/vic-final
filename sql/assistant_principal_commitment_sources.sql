-- One source may supply evidence for several commitments in the same school.
-- A saved URL remains a reference until a connector verifies it.
alter table public.ap_sources add constraint ap_sources_school_id_id_unique unique (school_id, id);
alter table public.ap_commitments add column source_id uuid;
alter table public.ap_commitments add constraint ap_commitments_school_source_fk
  foreign key (school_id, source_id) references public.ap_sources (school_id, id);
create index ap_commitments_source_idx on public.ap_commitments (school_id, source_id)
  where source_id is not null;
