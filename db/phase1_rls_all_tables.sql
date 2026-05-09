-- ============================================================================
-- phase1_rls_all_tables.sql
-- LandlordApp — Phase 1: Enable RLS on ALL operational tables
-- ============================================================================
-- Idempotent: safe to re-run (uses DROP POLICY IF EXISTS before CREATE).
-- Wrap everything in a transaction so it either all applies or nothing does.
-- ============================================================================

-- ============================================================================
-- 0. PRE-FLIGHT CHECK — run this SELECT *before* enabling RLS
--    It finds auth.users who have NO org_members row.
--    Those users would be locked out once org-scoped RLS is live.
-- ============================================================================
SELECT
  au.id        AS user_id,
  au.email     AS email,
  au.created_at
FROM auth.users au
LEFT JOIN public.org_members om ON om.user_id = au.id
WHERE om.user_id IS NULL
ORDER BY au.created_at;

-- If the above returns rows you are not comfortable locking out, add them to
-- org_members first, then proceed.

-- ============================================================================
-- 1. BEGIN TRANSACTION
-- ============================================================================
BEGIN;

-- ============================================================================
-- 2. UPDATE is_superadmin_user() — remove hardcoded emails, use allowlist only
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_superadmin_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH u AS (
    SELECT auth.uid() AS uid,
           lower(trim(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email', ''))) AS email
  )
  SELECT
    (u.email <> '' AND EXISTS (SELECT 1 FROM public.superadmin_allowlist s WHERE s.email IS NOT NULL AND lower(trim(s.email)) = u.email))
    OR (u.uid IS NOT NULL AND EXISTS (SELECT 1 FROM public.superadmin_allowlist s WHERE s.user_id IS NOT NULL AND s.user_id = u.uid))
  FROM u;
$$;

-- ============================================================================
-- 3. ORGANISATIONS table — add policy for regular org members to read own org
--    (superadmin policy already exists; we leave it untouched)
-- ============================================================================
DROP POLICY IF EXISTS "org_members_can_read_own_org" ON public.organisations;
CREATE POLICY "org_members_can_read_own_org" ON public.organisations
  FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 4. ORG-SCOPED RLS — standard pattern for every table with an org_id column
--    Pattern:
--      ENABLE RLS  →  DROP old policy  →  CREATE policy
--    The policy lets authenticated users access rows whose org_id matches
--    any org the user belongs to (via org_members).
-- ============================================================================

-- 4a. app_users -----------------------------------------------------------
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_app_users" ON public.app_users;
CREATE POLICY "org_isolation_app_users" ON public.app_users
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4b. companies (RLS may already be enabled — safe to re-run) -------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_companies" ON public.companies;
CREATE POLICY "org_isolation_companies" ON public.companies
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4c. contractors ---------------------------------------------------------
ALTER TABLE public.contractors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_contractors" ON public.contractors;
CREATE POLICY "org_isolation_contractors" ON public.contractors
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4d. daily_insights ------------------------------------------------------
ALTER TABLE public.daily_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_daily_insights" ON public.daily_insights;
CREATE POLICY "org_isolation_daily_insights" ON public.daily_insights
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4e. expenses ------------------------------------------------------------
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_expenses" ON public.expenses;
CREATE POLICY "org_isolation_expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4f. landlord_payments ---------------------------------------------------
ALTER TABLE public.landlord_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_landlord_payments" ON public.landlord_payments;
CREATE POLICY "org_isolation_landlord_payments" ON public.landlord_payments
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4g. landlords -----------------------------------------------------------
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_landlords" ON public.landlords;
CREATE POLICY "org_isolation_landlords" ON public.landlords
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4h. maintenance ---------------------------------------------------------
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_maintenance" ON public.maintenance;
CREATE POLICY "org_isolation_maintenance" ON public.maintenance
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4i. org_members (SPECIAL — users can see their own row + all members
--     of orgs they belong to) ---------------------------------------------
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_org_members" ON public.org_members;
CREATE POLICY "org_isolation_org_members" ON public.org_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR org_id IN (SELECT om.org_id FROM public.org_members om WHERE om.user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT om.org_id FROM public.org_members om WHERE om.user_id = auth.uid()));

-- 4j. payments ------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_payments" ON public.payments;
CREATE POLICY "org_isolation_payments" ON public.payments
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4k. properties ----------------------------------------------------------
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_properties" ON public.properties;
CREATE POLICY "org_isolation_properties" ON public.properties
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4l. property_docs (RLS may already be enabled — safe to re-run) ---------
ALTER TABLE public.property_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_property_docs" ON public.property_docs;
CREATE POLICY "org_isolation_property_docs" ON public.property_docs
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4m. property_documents --------------------------------------------------
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_property_documents" ON public.property_documents;
CREATE POLICY "org_isolation_property_documents" ON public.property_documents
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4n. rent_schedule -------------------------------------------------------
ALTER TABLE public.rent_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_rent_schedule" ON public.rent_schedule;
CREATE POLICY "org_isolation_rent_schedule" ON public.rent_schedule
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4o. rooms ---------------------------------------------------------------
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_rooms" ON public.rooms;
CREATE POLICY "org_isolation_rooms" ON public.rooms
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4p. tenant_docs (RLS may already be enabled — safe to re-run) -----------
ALTER TABLE public.tenant_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_tenant_docs" ON public.tenant_docs;
CREATE POLICY "org_isolation_tenant_docs" ON public.tenant_docs
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4q. tenant_documents ----------------------------------------------------
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_tenant_documents" ON public.tenant_documents;
CREATE POLICY "org_isolation_tenant_documents" ON public.tenant_documents
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4r. tenants -------------------------------------------------------------
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_tenants" ON public.tenants;
CREATE POLICY "org_isolation_tenants" ON public.tenants
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 4s. void_dates ----------------------------------------------------------
ALTER TABLE public.void_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_isolation_void_dates" ON public.void_dates;
CREATE POLICY "org_isolation_void_dates" ON public.void_dates
  FOR ALL TO authenticated
  USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- ============================================================================
-- 5. SEED superadmin_allowlist — preserve the 3 previously-hardcoded emails
-- ============================================================================
INSERT INTO public.superadmin_allowlist (email) VALUES ('g.depaula85@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.superadmin_allowlist (email) VALUES ('gleydson@reservationsdirect.co.uk') ON CONFLICT DO NOTHING;
INSERT INTO public.superadmin_allowlist (email) VALUES ('test2@gmail.com') ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. COMMIT
-- ============================================================================
COMMIT;

-- ============================================================================
-- 7. VERIFICATION (uncomment and run manually to check)
-- ============================================================================
-- Check which tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- Check all policies on public tables:
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Verify superadmin_allowlist has the seeded emails:
-- SELECT * FROM public.superadmin_allowlist;

-- Test is_superadmin_user() (run as an authenticated user):
-- SELECT public.is_superadmin_user();
