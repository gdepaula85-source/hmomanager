-- properties_add_status_archived.sql
-- Persist property archive state (required for archive after refresh).
-- Run in Supabase SQL Editor, then wait ~1 min or reload API schema (Dashboard → Settings → API).

alter table public.properties
  add column if not exists status text null default 'active';

alter table public.properties
  add column if not exists archived_at date null;

comment on column public.properties.status is 'active | archived';
comment on column public.properties.archived_at is 'Date property was archived (optional)';

-- Backfill
update public.properties
set status = 'active'
where status is null or status = '';

-- PostgREST caches the table shape. Without this, API responses may omit `status` until the
-- pool recycles — the app then loads every property as active and debounced saves can
-- write that stale view back to the database.
notify pgrst, 'reload schema';
