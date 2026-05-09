-- properties_add_inspections_column.sql
-- Adds JSONB column to store inspection reports per property.
-- Each inspection: {id, timestamp, inspector, overallRating, conditions, notes, photos[]}
-- Photos are stored in Supabase Storage (property-docs bucket); this column
-- only holds metadata + URLs.

begin;

alter table public.properties
  add column if not exists inspections jsonb not null default '[]'::jsonb;

comment on column public.properties.inspections is
  'Array of inspection report objects: {id, timestamp, inspector, overallRating, conditions, notes, photos}';

commit;
