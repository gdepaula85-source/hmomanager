-- ============================================================
-- FIX: Company data isolation (multi-tenant leak)
-- Run this in the Supabase SQL editor
--
-- Problem: Companies created by Account A are visible to Account B
-- because either:
--   (a) RLS was not enabled / policy was missing on companies table
--   (b) Rows created before the migration have org_id = NULL, meaning
--       the frontend .eq('org_id', _currentOrgId) filter returns them
--       for any org that has a NULL match via OR logic — or if RLS is
--       absent they are globally visible.
-- ============================================================


-- STEP 1: Ensure RLS is enabled on the companies table
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;


-- STEP 2: Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Org members can manage their companies" ON public.companies;
DROP POLICY IF EXISTS "Companies are org-scoped" ON public.companies;
DROP POLICY IF EXISTS "companies_org_isolation" ON public.companies;


-- STEP 3: Create a tight RLS policy — only org members can see/modify their org's companies
--         Rows with org_id = NULL will be BLOCKED for all users (they're orphaned data).
CREATE POLICY "companies_org_isolation"
  ON public.companies
  FOR ALL
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );


-- STEP 4: Show any orphaned companies (org_id = NULL) so you can decide what to do with them.
--         Run this SELECT first to see what rows are affected before deleting:
SELECT id, name, org_id
FROM public.companies
WHERE org_id IS NULL;

-- STEP 5: (OPTIONAL — uncomment to delete orphaned rows with no org_id)
--         These rows are invisible to all users once RLS is enforced, but
--         to keep things clean you can delete them:
-- DELETE FROM public.companies WHERE org_id IS NULL;


-- STEP 6: Also re-enforce RLS policies on property_docs and tenant_docs
--         (these were in the previous migration but let's be sure they're applied)
ALTER TABLE public.property_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage their property_docs" ON public.property_docs;
DROP POLICY IF EXISTS "property_docs_org_isolation" ON public.property_docs;
CREATE POLICY "property_docs_org_isolation"
  ON public.property_docs
  FOR ALL
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

ALTER TABLE public.tenant_docs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage their tenant_docs" ON public.tenant_docs;
DROP POLICY IF EXISTS "tenant_docs_org_isolation" ON public.tenant_docs;
CREATE POLICY "tenant_docs_org_isolation"
  ON public.tenant_docs
  FOR ALL
  USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );


-- ============================================================
-- Verification queries (run after applying the above)
-- ============================================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE tablename IN ('companies', 'property_docs', 'tenant_docs')
-- AND schemaname = 'public';

-- Check policies created:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('companies', 'property_docs', 'tenant_docs')
-- AND schemaname = 'public';
