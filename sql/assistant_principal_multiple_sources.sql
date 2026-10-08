-- A school can have multiple attendance sheets or other sources of one type.
-- Commitment links use source IDs, so labels and URLs can be corrected.
alter table public.ap_sources drop constraint ap_sources_school_id_kind_key;
create index ap_sources_school_kind_idx on public.ap_sources (school_id, kind);
