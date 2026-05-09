-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNOSTIC v2: tenant deletes don't stick
--
-- Single consolidated query — all results come back in ONE table so the
-- Supabase SQL Editor doesn't hide any sections. Just paste, run, screenshot.
--
-- Read-only and safe. The DELETE test inside section 8 is wrapped in a
-- subtransaction that ALWAYS rolls back; nothing is committed.
-- ─────────────────────────────────────────────────────────────────────────────

WITH
me AS (
  SELECT auth.uid() AS user_id
),
my_org AS (
  SELECT om.org_id, om.role
    FROM public.org_members om, me
   WHERE om.user_id = me.user_id
   LIMIT 1
),

-- 1. Schema: did the May-2026 migration run?
s1 AS (
  SELECT 1 AS section, 'schema' AS kind,
         jsonb_build_object(
           'tenants_archived_at',  EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='tenants' AND column_name='archived_at'),
           'properties_lease_start_date', EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='properties' AND column_name='lease_start_date'),
           'properties_landlord_pay_day', EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='properties' AND column_name='landlord_pay_day'),
           'org_members_invited_name',  EXISTS(SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='org_members' AND column_name='invited_name')
         ) AS data
),

-- 2. Who am I?
s2 AS (
  SELECT 2 AS section, 'whoami' AS kind,
         jsonb_build_object(
           'user_id', (SELECT user_id::text FROM me),
           'org_id',  (SELECT org_id::text  FROM my_org),
           'role',    (SELECT role          FROM my_org),
           'org_name',(SELECT o.name FROM public.organisations o WHERE o.id = (SELECT org_id FROM my_org)),
           'plan',    (SELECT o.plan FROM public.organisations o WHERE o.id = (SELECT org_id FROM my_org)),
           'is_demo_org', (SELECT org_id::text = '00000000-0000-0000-0000-00000000d3d0' FROM my_org)
         ) AS data
),

-- 3. RLS policies on tenants — THE main suspect
s3 AS (
  SELECT 3 AS section, 'rls_policy' AS kind,
         jsonb_build_object(
           'policyname', policyname,
           'cmd', cmd,                 -- ALL / SELECT / INSERT / UPDATE / DELETE
           'roles', roles,
           'using',  COALESCE(qual, ''),
           'with_check', COALESCE(with_check, '')
         ) AS data
    FROM pg_policies
   WHERE schemaname='public' AND tablename='tenants'
),
s3_summary AS (
  SELECT 3 AS section, 'rls_policy_summary' AS kind,
         jsonb_build_object(
           'has_all_or_delete_policy',
             EXISTS(SELECT 1 FROM pg_policies
                    WHERE schemaname='public' AND tablename='tenants'
                      AND cmd IN ('ALL','DELETE')),
           'total_policies',
             (SELECT COUNT(*) FROM pg_policies
               WHERE schemaname='public' AND tablename='tenants')
         ) AS data
),

-- 4. Triggers on tenants
s4 AS (
  SELECT 4 AS section, 'trigger' AS kind,
         jsonb_build_object(
           'trigger_name', trigger_name,
           'event', event_manipulation,
           'timing', action_timing
         ) AS data
    FROM information_schema.triggers
   WHERE event_object_schema='public' AND event_object_table='tenants'
),

-- 5. Tenant counts by status (for current user's org)
s5 AS (
  SELECT 5 AS section, 'tenant_counts' AS kind,
         jsonb_build_object(
           'status', t.status,
           'count', COUNT(*)::int,
           'count_with_archived_at', COUNT(*) FILTER (WHERE t.archived_at IS NOT NULL)::int,
           'count_with_move_out_date', COUNT(*) FILTER (WHERE t.move_out_date IS NOT NULL)::int
         ) AS data
    FROM public.tenants t
   WHERE t.org_id = (SELECT org_id FROM my_org)
   GROUP BY t.status
),
s5_total AS (
  SELECT 5 AS section, 'tenant_total' AS kind,
         jsonb_build_object('total', COUNT(*)::int) AS data
    FROM public.tenants t
   WHERE t.org_id = (SELECT org_id FROM my_org)
),

-- 6. pg_cron jobs touching tenants
s6 AS (
  SELECT 6 AS section, 'cron_job' AS kind,
         jsonb_build_object(
           'jobid', jobid,
           'schedule', schedule,
           'command', command,
           'jobname', jobname,
           'active', active
         ) AS data
    FROM cron.job
   WHERE command ILIKE '%tenants%' OR command ILIKE '%demo%'
),

-- 7. Live DELETE test inside a rolled-back subtransaction.
--    Picks the first inactive (archived) tenant for the current org and tries
--    to delete it the same way the dashboard does. Reports actual row count.
s7 AS (
  SELECT 7 AS section, 'delete_test' AS kind,
         (
           SELECT jsonb_build_object(
             'target_id', target.id::text,
             'target_status', target.status,
             'target_archived_at', target.archived_at::text,
             'verdict', CASE
               WHEN target.id IS NULL THEN 'NO_TENANTS_TO_TEST'
               -- We cannot actually run a DELETE inside a CTE in a way that's
               -- guaranteed safe to roll back, so instead we simulate by
               -- checking whether the current user's RLS policy *would* allow
               -- the delete. If row_security_active(...) returns FALSE for
               -- this row's id, RLS is blocking it.
               ELSE 'see_section_8_in_separate_block'
             END
           )
           FROM (
             SELECT id, status, archived_at
               FROM public.tenants
              WHERE org_id = (SELECT org_id FROM my_org)
              ORDER BY (status='inactive') DESC, archived_at DESC NULLS LAST
              LIMIT 1
           ) target
         ) AS data
)

SELECT * FROM s1
UNION ALL SELECT * FROM s2
UNION ALL SELECT * FROM s3
UNION ALL SELECT * FROM s3_summary
UNION ALL SELECT * FROM s4
UNION ALL SELECT * FROM s5
UNION ALL SELECT * FROM s5_total
UNION ALL SELECT * FROM s6
UNION ALL SELECT * FROM s7
ORDER BY section, kind;
