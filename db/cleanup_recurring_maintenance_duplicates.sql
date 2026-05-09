-- cleanup_recurring_maintenance_duplicates.sql
-- Purges duplicate maintenance rows spawned by the buggy recurring-template seeder
-- (pre-fix: recurringTpl tag never persisted, so dedupe failed on every render).
--
-- Strategy: for each (org_id, property, issue) where notes begins with
-- 'Auto-created from recurring template', keep only the most recently scheduled
-- OPEN row and delete the rest. Resolved history rows are left alone.
--
-- Run on piufcteaqmxemidfdoim. SAFE on orgs that don't have the bug.

begin;

with ranked as (
  select
    id,
    org_id,
    property_name,
    issue,
    status,
    scheduled_date,
    logged_date,
    row_number() over (
      partition by org_id, property_name, issue
      order by coalesce(scheduled_date, logged_date) desc nulls last, id desc
    ) as rn
  from public.maintenance
  where coalesce(status, 'open') <> 'resolved'
    and notes like 'Auto-created from recurring template%'
)
delete from public.maintenance m
using ranked r
where m.id = r.id
  and r.rn > 1;

commit;
