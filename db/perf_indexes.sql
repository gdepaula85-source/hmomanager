-- perf_indexes.sql
-- Adds missing btree indexes on org_id for the big org-scoped tables.
-- Without these the RLS policy `org_id IN (SELECT org_id FROM org_members
-- WHERE user_id = auth.uid())` runs the membership sub-query for EVERY row
-- scanned — sequential scan × per-row sub-query = O(n²) work. With ~700
-- payments and ~140 tenants in the demo, that's plenty to trip the
-- authenticated role's 8-second statement_timeout, producing the
-- "canceling statement due to timeout" + "Failed to fetch" errors.
--
-- All `if not exists` so safe to re-run on any project. Final ANALYZE refreshes
-- the planner's stats so it picks the new indexes immediately.
--
-- Run on test (piufcteaqmxemidfdoim) and prod (kzumoubhxdoqqcucdact).

create index if not exists idx_tenants_org           on public.tenants           (org_id);
create index if not exists idx_payments_org          on public.payments          (org_id);
create index if not exists idx_expenses_org          on public.expenses          (org_id);
create index if not exists idx_maintenance_org       on public.maintenance       (org_id);
create index if not exists idx_landlord_payments_org on public.landlord_payments (org_id);
create index if not exists idx_contractors_org       on public.contractors       (org_id);
create index if not exists idx_companies_org         on public.companies         (org_id);
create index if not exists idx_landlords_org         on public.landlords         (org_id);

-- org_members has user_id index already from the FK, but the (user_id, org_id)
-- composite makes the RLS sub-query a single index lookup.
create index if not exists idx_org_members_user_org  on public.org_members       (user_id, org_id);

-- Refresh planner statistics so the new indexes are used immediately.
analyze public.tenants;
analyze public.payments;
analyze public.expenses;
analyze public.maintenance;
analyze public.landlord_payments;
analyze public.contractors;
analyze public.companies;
analyze public.landlords;
analyze public.org_members;

-- Reload PostgREST schema cache for completeness.
notify pgrst, 'reload schema';
