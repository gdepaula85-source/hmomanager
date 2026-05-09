-- ─────────────────────────────────────────────────────────────
-- maintenance_scheduled_datetime.sql
-- Adds optional scheduled date + time to maintenance jobs so they
-- can appear on the Diary / Calendar view.
--
-- Run on TEST and PROD before deploying the corresponding bundle.
-- ─────────────────────────────────────────────────────────────

alter table public.maintenance
  add column if not exists scheduled_date date null,
  add column if not exists scheduled_time time null;

comment on column public.maintenance.scheduled_date is 'Optional date when the maintenance visit is scheduled — used to show on Diary calendar';
comment on column public.maintenance.scheduled_time is 'Optional time (24h) for the scheduled maintenance visit';
