-- ─────────────────────────────────────────────────────────────────────────────
-- Field fixes — May 2026
--
-- Three columns that the JS code expects but were never added to the schema:
--
--   1. tenants.archived_at      → archiveTenant fails with "column not found
--                                  in schema cache" because this column was
--                                  never created on tenants (only properties).
--   2. properties.lease_start_date → user-set lease start date wasn't
--                                    persisting because the column didn't
--                                    exist (and propToRow didn't include it).
--   3. properties.landlord_pay_day → new column for the "Landlord Pay Day"
--                                    input on the property modal, decoupled
--                                    from leaseStartDate's day-of-month.
--
-- After running this, deploy the new dashboard.bundle.js — the row mappers
-- will now read/write these columns correctly.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add archived_at to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS archived_at DATE NULL;

-- 2. Add lease_start_date to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS lease_start_date DATE NULL;

-- 3. Add landlord_pay_day to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS landlord_pay_day SMALLINT NULL
    CHECK (landlord_pay_day IS NULL OR (landlord_pay_day BETWEEN 1 AND 31));

-- 4. Reload the PostgREST schema cache so the new columns are visible
--    immediately to the dashboard via supabase-js. Without this, the first
--    request after the migration would still see "column not in schema cache".
NOTIFY pgrst, 'reload schema';
