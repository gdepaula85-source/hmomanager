-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: drop the catastrophically-loose RLS policies that bypass org isolation
--
-- Context: the AUDIT_overly_permissive_rls.sql diagnostic identified two
-- families of bad policies that override every other RLS rule on the same
-- table:
--
--   anon_all          — cmd=ALL, roles=anon,          using=true, with_check=true
--   authenticated_all — cmd=ALL, roles=authenticated, using=true, with_check=true
--
-- These two policies, together, give every authenticated AND every anon
-- user permission to SELECT, INSERT, UPDATE, and DELETE every row on every
-- table they appear on, in every org. The properly-scoped
-- `org_isolation_<table>` policies do nothing because RLS combines policies
-- with OR — the moment any policy says yes, the operation is allowed.
--
-- This script drops ONLY those two policy names where qual is exactly the
-- literal `true` (the dangerous form). Other policies (`Allow anon portal
-- login`, `Orgs fully manage tenants`, `tenants_org`, etc.) are left in
-- place — some may serve a real purpose (e.g. the public tenant portal
-- needing anon SELECT). Review the AUDIT output and have me write follow-up
-- migrations for those if needed.
--
-- Pre-flight check before running:
--   1. Run AUDIT_overly_permissive_rls.sql first.
--   2. Verify EVERY table that has `anon_all` / `authenticated_all` ALSO has
--      an `org_isolation_<table>` (or `<table>_org`) policy. The cleanup
--      relies on the isolation policy taking over after the loose ones go.
--      If any table is missing isolation, you'll lose access entirely.
--   3. The DO block below logs every drop with NOTICE — keep an eye on those.
--
-- Run on prod (kzumoubhxdoqqcucdact). Wrap in a transaction so you can
-- ROLLBACK if anything looks wrong; COMMIT only after a smoke test.
--
-- HOW TO ROLLBACK in case of regret:
--   -- For each table+policy that was dropped, recreate the loose form:
--   CREATE POLICY anon_all ON public.<table>
--     FOR ALL TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY authenticated_all ON public.<table>
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
--   -- (You should not need this if your isolation policies were correct.)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Defensive guard: refuse to run if any table has a loose policy but no
-- org_isolation_<table> (or <table>_org) policy. Dropping the loose policy
-- would lock that table out entirely.
DO $$
DECLARE
  bad_table text;
BEGIN
  SELECT p.tablename INTO bad_table
    FROM pg_policies p
   WHERE p.schemaname = 'public'
     AND p.policyname IN ('anon_all','authenticated_all')
     AND p.qual = 'true'
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies q
        WHERE q.schemaname = p.schemaname
          AND q.tablename  = p.tablename
          AND (q.policyname LIKE '%org_isolation%' OR q.policyname LIKE '%_org%')
     )
   LIMIT 1;

  IF bad_table IS NOT NULL THEN
    RAISE EXCEPTION
      'Refusing to drop loose policies — table "%" has a loose policy but no org_isolation policy. Add an isolation policy first.',
      bad_table;
  END IF;
END $$;

-- Drop every anon_all + authenticated_all whose `using` is the literal `true`.
-- Logs each drop so you see exactly what changed in the NOTICES tab.
DO $$
DECLARE
  pol RECORD;
  drop_count int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, roles::text AS roles
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname IN ('anon_all','authenticated_all')
       AND qual = 'true'
     ORDER BY tablename, policyname
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
    RAISE NOTICE 'Dropped %.% policy "%"  (roles=%)',
      pol.schemaname, pol.tablename, pol.policyname, pol.roles;
    drop_count := drop_count + 1;
  END LOOP;
  RAISE NOTICE 'Total policies dropped: %', drop_count;
END $$;

-- Reload PostgREST schema cache so the API immediately respects the new
-- policy set. Without this the next request might still see the old policy.
NOTIFY pgrst, 'reload schema';

-- IMPORTANT: this is a transactional change. Inspect the NOTICES, run a
-- few quick smoke tests in another session (read a tenant, edit a property,
-- archive a tenant), then COMMIT. If anything looks off, ROLLBACK and we
-- regroup.
--
-- Uncomment ONE of the next two lines:
-- COMMIT;
-- ROLLBACK;
