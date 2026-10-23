-- Non-destructive: formatting/preferences live in existing JSONB payloads.
-- Historical creation times are unknown. Do NOT infer them from updated_at.
begin;
alter table public.planner_records add column created_at timestamptz;
alter table public.planner_records alter column created_at set default now();
comment on column public.planner_records.created_at is
  'Server insertion time. NULL for legacy records whose creation time is unknown. Never used for subjective entry labels.';
-- Paragraphs mirror the searchable plain text; large Chinese notes can exceed
-- the original 1 MiB ceiling. Broaden only the size limit, retaining object validation.
alter table public.planner_records drop constraint planner_records_payload_check;
alter table public.planner_records add constraint planner_records_payload_check
  check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 4194304);
-- save_planner_record does not update this column. It remains immutable on edits.
commit;
