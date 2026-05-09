-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNOSTIC: tenant deletes don't stick
--
-- Read-only. Safe to run on prod (kzumoubhxdoqqcucdact). Returns 8 result sets
-- — copy ALL of them back to me and I'll tell you exactly which fix to apply.
--
-- HOW TO RUN:
--   1. Open Supabase Studio → SQL Editor → New query
--   2. Make sure the "Project" selector at the top reads
--      kzumoubhxdoqqcucdact (NOT piufcteaqmxemidfdoim — that's test).
--   3. Sign in as the SAME user that's been deleting tenants in the app
--      (the SQL Editor authenticates as your logged-in Supabase user, so
--      RLS sees you as your normal account — which is what we want).
--   4. Paste this whole file. Click Run.
--   5. You'll get 8 result tabs. Click each, copy the rows, paste back here.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. SCHEMA: did the May-2026 field-fixes migration actually run?
--    Expected: 4 rows (one per column). If any row is missing, that migration
--    has NOT run on this project. (Doesn't itself cause the delete bug, but
--    indicates whether the user's "I ran it" belief is accurate.)
SELECT 'tenants.archived_at'        AS expected, column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='tenants' AND column_name='archived_at'
UNION ALL
SELECT 'properties.lease_start_date', column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='properties' AND column_name='lease_start_date'
UNION ALL
SELECT 'properties.landlord_pay_day', column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='properties' AND column_name='landlord_pay_day'
UNION ALL
SELECT 'org_members.invited_name', column_name, data_type
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='org_members' AND column_name='invited_name';

-- 2. WHO AM I? Confirm we're authenticated and which org we belong to.
--    auth.uid() should be a UUID, not null. org_id should match the org
--    where tenants are reappearing. role should be 'admin'.
SELECT auth.uid() AS my_user_id,
       om.org_id,
       om.role,
       o.name AS org_name,
       o.plan
  FROM public.org_members om
  JOIN public.organisations o ON o.id = om.org_id
 WHERE om.user_id = auth.uid();

-- 3. RLS POLICIES on tenants. Critically: is there a row with cmd IN ('ALL','DELETE')?
--    If only SELECT/UPDATE/INSERT show up, deletes are silently rejected.
SELECT policyname,
       permissive,
       roles,
       cmd,                 -- ALL / SELECT / INSERT / UPDATE / DELETE
       qual    AS using_expr,
       with_check
  FROM pg_policies
 WHERE schemaname='public' AND tablename='tenants'
 ORDER BY cmd, policyname;

-- 4. TRIGGERS on tenants. A BEFORE DELETE trigger that returns NULL would
--    silently abort the delete with no error (zero rows affected). Worth
--    ruling out.
SELECT trigger_name,
       event_manipulation,
       action_timing,
       action_statement
  FROM information_schema.triggers
 WHERE event_object_schema='public' AND event_object_table='tenants'
 ORDER BY trigger_name;

-- 5. TENANT COUNTS for your org, broken down by status.
--    Compare these numbers to what you see in the Tenants tab after a refresh.
--    Substitute the org_id from result #2 if you want to be explicit; the
--    coalesce() defaults to whatever org you belong to.
WITH me AS (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1)
SELECT t.status,
       COUNT(*) AS n,
       COUNT(*) FILTER (WHERE t.archived_at IS NOT NULL) AS n_with_archived_at,
       COUNT(*) FILTER (WHERE t.move_out_date IS NOT NULL) AS n_with_move_out
  FROM public.tenants t
  JOIN me ON me.org_id = t.org_id
 GROUP BY t.status
 ORDER BY t.status;

-- 6. DEMO-ORG SAFETY CHECK. If your org_id matches this, pg_cron resets your
--    tenants every hour and the bug is by design. Returns 0 rows = you're
--    NOT on demo, which is the expected case.
SELECT id, name, plan, created_at
  FROM public.organisations
 WHERE id = '00000000-0000-0000-0000-00000000d3d0'
   AND id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid());

-- 7. PG_CRON JOBS that might re-create tenants. The known one is
--    refresh_demo_org_hourly. Anything ELSE that touches public.tenants?
--    Returns the demo-org refresher (expected) and any other suspect.
SELECT jobid, schedule, command, jobname, active
  FROM cron.job
 WHERE command ILIKE '%tenants%'
    OR command ILIKE '%demo%'
 ORDER BY jobid;

-- 8. CAN YOU ACTUALLY DELETE? Picks a tenant the user already tried to delete
--    (status='inactive' with an archived_at — i.e. one they binned through the
--    app), and attempts the same delete the dashboard would. Wrapped in
--    BEGIN/ROLLBACK so NOTHING IS COMMITTED — pure read-test.
--
--    Three signals:
--      a) RETURNING returns 1 row → DELETE works, RLS is fine, the bug is
--         elsewhere (autosave race / multi-tab / re-insert from another path).
--      a) RETURNING returns 0 rows → RLS is silently blocking. We need to add
--         a DELETE policy. (Will surface this with NOTICE before ROLLBACK.)
--      c) An exception fires → trigger or FK is the cause. The error message
--         tells us which.
DO $$
DECLARE
  v_org    uuid;
  v_target uuid;
  v_count  integer;
BEGIN
  SELECT org_id INTO v_org
    FROM public.org_members
   WHERE user_id = auth.uid()
   LIMIT 1;

  IF v_org IS NULL THEN
    RAISE NOTICE '[8] No org_members row for current user — cannot test.';
    RETURN;
  END IF;

  -- Prefer an inactive tenant (representative of "user already archived this").
  SELECT id INTO v_target
    FROM public.tenants
   WHERE org_id = v_org AND status = 'inactive'
   LIMIT 1;
  IF v_target IS NULL THEN
    SELECT id INTO v_target
      FROM public.tenants
     WHERE org_id = v_org
     LIMIT 1;
  END IF;
  IF v_target IS NULL THEN
    RAISE NOTICE '[8] No tenants exist for org %, nothing to test.', v_org;
    RETURN;
  END IF;

  -- Clear FK children, mirroring the dashboard.
  DELETE FROM public.payments WHERE tenant_id = v_target AND org_id = v_org;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[8] Cleared % payment row(s) for tenant %.', v_count, v_target;

  -- The actual test:
  DELETE FROM public.tenants WHERE id = v_target AND org_id = v_org;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE NOTICE '[8] *** DELETE returned 0 rows — RLS or trigger is silently blocking. ***';
    RAISE NOTICE '[8] Tenant id was: %', v_target;
  ELSE
    RAISE NOTICE '[8] DELETE worked: % row(s) removed for tenant %.', v_count, v_target;
    RAISE NOTICE '[8] So the bug is NOT a silent block — look at autosave race / multi-tab.';
  END IF;

  -- Roll back so nothing is permanently changed.
  RAISE EXCEPTION '[8] Intentional rollback — diagnostic only. No data was modified.'
    USING ERRCODE = 'P0001';
EXCEPTION WHEN SQLSTATE 'P0001' THEN
  -- Re-raise our own NOTICE messages by ignoring the rollback exception.
  -- (The notices above were already emitted before the exception.)
  NULL;
END $$;
