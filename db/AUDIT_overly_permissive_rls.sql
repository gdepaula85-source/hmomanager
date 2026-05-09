-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT: overly-permissive RLS policies
--
-- The tenant-delete diagnostic uncovered this on the tenants table:
--
--   anon_all          (cmd=ALL, roles=anon,           using=true, with_check=true)
--   authenticated_all (cmd=ALL, roles=authenticated,  using=true, with_check=true)
--
-- `using=true` means "match every row" — combined with cmd=ALL, this grants
-- every authenticated AND anon user permission to do ANYTHING (SELECT/INSERT/
-- UPDATE/DELETE) to ANY row in the table. RLS uses OR semantics across
-- policies, so even though there's a properly-scoped `org_isolation_tenants`
-- policy, these loose ones override it. Net effect: every customer can read,
-- modify, and delete every other customer's data.
--
-- This audit is read-only — copy/paste into Supabase SQL Editor (prod project
-- kzumoubhxdoqqcucdact). It returns three result sets bundled into one
-- table via UNION so the editor doesn't hide any of them:
--
--   section 1: every policy that has using=true OR with_check=true (the
--              ones that bypass row-level isolation)
--   section 2: every org_isolation_* policy (these are the ones that SHOULD
--              be the only ALL-policy on each table)
--   section 3: per-table summary — how many loose policies vs. how many
--              proper isolation policies
--
-- After running, send me the output and I'll write the targeted cleanup.
-- ─────────────────────────────────────────────────────────────────────────────

WITH
loose AS (
  SELECT
    1                                  AS section,
    'loose_policy'                     AS kind,
    jsonb_build_object(
      'table',      schemaname || '.' || tablename,
      'policyname', policyname,
      'cmd',        cmd,
      'roles',      roles::text,
      'using_expr', COALESCE(qual, ''),
      'with_check', COALESCE(with_check, '')
    )                                  AS data
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (qual = 'true' OR with_check = 'true')
),
isolation AS (
  SELECT
    2                                  AS section,
    'isolation_policy'                 AS kind,
    jsonb_build_object(
      'table',      schemaname || '.' || tablename,
      'policyname', policyname,
      'cmd',        cmd,
      'roles',      roles::text
    )                                  AS data
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (policyname LIKE '%org_isolation%' OR policyname LIKE '%_org%')
),
summary AS (
  SELECT
    3                                  AS section,
    'table_summary'                    AS kind,
    jsonb_build_object(
      'table',      tablename,
      'loose_policies',
        SUM(CASE WHEN qual = 'true' OR with_check = 'true' THEN 1 ELSE 0 END)::int,
      'isolation_policies',
        SUM(CASE WHEN policyname LIKE '%org_isolation%' OR policyname LIKE '%_org%' THEN 1 ELSE 0 END)::int,
      'total_policies', COUNT(*)::int
    )                                  AS data
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
  HAVING SUM(CASE WHEN qual = 'true' OR with_check = 'true' THEN 1 ELSE 0 END) > 0
)
SELECT * FROM loose
UNION ALL SELECT * FROM isolation
UNION ALL SELECT * FROM summary
ORDER BY section, (data->>'table'), (data->>'policyname');
