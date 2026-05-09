-- ============================================================================
-- PRODUCTION_MIGRATION_ALL.sql  (version: 2026-04-24)
-- LandlordApp — Complete migration for the landlordapp.io production Supabase.
-- ============================================================================
--
-- Consolidates EVERY schema / RLS / function change made on the test project
-- (piufcteaqmxemidfdoim) into a single idempotent script for the main prod DB.
--
-- INSTRUCTIONS:
--   1. Open production Supabase → SQL Editor
--   2. Uncomment + run STEP 0 (pre-flight) first — shows users without org_members
--   3. Run STEPS 1-9 top-to-bottom (all idempotent, safe to re-run)
--   4. Uncomment + run STEP 10 queries to verify everything applied
--
-- All statements use IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE so
-- they are SAFE TO RE-RUN. If a column/table/policy already exists, it's skipped.
--
-- COVERAGE (what's in this file):
--   - Schema additions to organisations, properties, tenants, payments,
--     maintenance, expenses, companies, property_docs, tenant_docs
--   - STR / Airbnb columns (properties.is_str_enabled, payments.income_source
--     / period_start / period_end) for hybrid HMO + SA portfolios
--   - Tenant demographics: dob + nationality
--   - Property gallery (photos/videos) + inspections (jsonb)
--   - New tables: saas_config, email_log, superadmin_allowlist
--   - Plan caps with Enterprise tier + billing_override='free' bypass
--     (so FREE GRANT / partner / demo orgs are truly unlimited)
--   - Row-level security on every operational table, org-scoped via org_members
--   - Superadmin RLS bypass for cross-org admin views
--
-- POST-RUN:
--   - Seed demo org via db/demo_seed.sql (optional — for demo accounts)
--   - Schedule daily demo refresh via db/demo_seed_schedule.sql (needs pg_cron)
--   - If you add custom Stripe plans later, set STRIPE_PRICE_<KEY> env vars
-- ============================================================================


-- ============================================================================
-- STEP 0: PRE-FLIGHT — Run this SELECT first (do NOT skip)
-- Shows auth.users who have NO org_members row — they would be locked out by RLS.
-- ============================================================================
-- SELECT
--   au.id        AS user_id,
--   au.email     AS email,
--   au.created_at
-- FROM auth.users au
-- LEFT JOIN public.org_members om ON om.user_id = au.id
-- WHERE om.user_id IS NULL
-- ORDER BY au.created_at;
--
-- If the above returns rows you want to keep, add them to org_members first.
-- Then proceed with the rest of this file.


-- ============================================================================
-- STEP 1: SCHEMA CHANGES — New columns on existing tables
-- All use IF NOT EXISTS — safe to re-run
-- ============================================================================

-- 1a. organisations — email settings
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS email_settings JSONB DEFAULT '{}'::jsonb;

-- 1b. organisations — app config (branding, roles)
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS app_config JSONB NULL DEFAULT '{}'::jsonb;

-- 1c. organisations — public listings
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS public_listings_whatsapp TEXT NULL;
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS public_listings_whatsapp_skipped BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS public_listings_tagline TEXT NULL;

-- 1d. organisations — currency & language
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS currency        VARCHAR(10)  DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5)   DEFAULT '£',
  ADD COLUMN IF NOT EXISTS language        VARCHAR(10)  DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_format     VARCHAR(20)  DEFAULT 'DD/MM/YYYY';

UPDATE public.organisations
SET currency = 'GBP', currency_symbol = '£', language = 'en', date_format = 'DD/MM/YYYY'
WHERE currency IS NULL;

-- 1e. organisations — billing override (indefinite free grant) + time-boxed free_until grant
ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS billing_override TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_override_note TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS free_until DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS free_until_note TEXT DEFAULT NULL;

-- 1f. properties — status + archived_at
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS status TEXT NULL DEFAULT 'active';
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS archived_at DATE NULL;

UPDATE public.properties SET status = 'active' WHERE status IS NULL OR status = '';

-- 1g. properties — inspections, gallery, STR flag
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS inspections   JSONB   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS gallery       JSONB   NOT NULL DEFAULT '{"photos":[],"videos":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_str_enabled BOOLEAN NOT NULL DEFAULT false;

-- 1g-i. payments — Airbnb / STR income source tracking
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS income_source TEXT DEFAULT 'rent',
  ADD COLUMN IF NOT EXISTS period_start  DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS period_end    DATE DEFAULT NULL;

-- 1h. tenants — date of birth + nationality
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS dob DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT NULL;

-- 1i. maintenance — scheduled date/time for diary
ALTER TABLE public.maintenance
  ADD COLUMN IF NOT EXISTS scheduled_date DATE NULL,
  ADD COLUMN IF NOT EXISTS scheduled_time TIME NULL;

-- 1j. expenses — receipt attachment columns
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS receipt_url  TEXT NULL,
  ADD COLUMN IF NOT EXISTS receipt_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS receipt_type TEXT NULL;

-- 1k. companies — add org_id + whatsapp (if not already present)
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

CREATE INDEX IF NOT EXISTS companies_org_id_idx ON public.companies(org_id);

-- 1l. property_docs — add org_id + data_url
ALTER TABLE public.property_docs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS data_url TEXT;

CREATE INDEX IF NOT EXISTS property_docs_org_id_idx ON public.property_docs(org_id);

-- 1m. tenant_docs — add org_id + data_url
ALTER TABLE public.tenant_docs
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS data_url TEXT;

CREATE INDEX IF NOT EXISTS tenant_docs_org_id_idx ON public.tenant_docs(org_id);

-- Reload PostgREST schema cache so new columns appear in API immediately
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- STEP 2: NEW TABLES
-- ============================================================================

-- 2a. saas_config — superadmin Plans & Pricing storage
CREATE TABLE IF NOT EXISTS public.saas_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2b. email_log — email audit trail
CREATE TABLE IF NOT EXISTS public.email_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_id TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_dedup
  ON public.email_log (org_id, tenant_id, template_id, (metadata->>'due_date'));
CREATE INDEX IF NOT EXISTS idx_email_log_org
  ON public.email_log (org_id, created_at DESC);


-- ============================================================================
-- STEP 3: SUPERADMIN INFRASTRUCTURE
-- ============================================================================

-- 3a. superadmin_allowlist table
CREATE TABLE IF NOT EXISTS public.superadmin_allowlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NULL,
  user_id UUID NULL,
  created_at TIMESTAMPTZ NULL DEFAULT now(),
  CONSTRAINT superadmin_allowlist_email_or_user CHECK (email IS NOT NULL OR user_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS superadmin_allowlist_user_id_key
  ON public.superadmin_allowlist (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS superadmin_allowlist_email_lower_key
  ON public.superadmin_allowlist (lower(trim(email))) WHERE email IS NOT NULL;

ALTER TABLE public.superadmin_allowlist ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.superadmin_allowlist TO service_role;

-- 3b. Seed superadmin emails
INSERT INTO public.superadmin_allowlist (email) VALUES ('g.depaula85@gmail.com') ON CONFLICT DO NOTHING;
INSERT INTO public.superadmin_allowlist (email) VALUES ('gleydson@reservationsdirect.co.uk') ON CONFLICT DO NOTHING;
INSERT INTO public.superadmin_allowlist (email) VALUES ('admin@landlordapp.io') ON CONFLICT DO NOTHING;

-- 3c. is_superadmin_user() function — DB-only, no hardcoded emails
-- DROP first in case the existing signature differs (return type / args). Policies
-- that reference this function (recreated in step 6) must be dropped first, else
-- Postgres rejects with 2BP01 "cannot drop function because other objects depend on it".
DROP POLICY IF EXISTS "superadmin_all_organisations"     ON public.organisations;
DROP POLICY IF EXISTS "superadmin_all_saas_config"       ON public.saas_config;
DROP POLICY IF EXISTS "superadmin_manage_allowlist"      ON public.superadmin_allowlist;
DROP POLICY IF EXISTS "superadmin_all_org_members"       ON public.org_members;
DROP POLICY IF EXISTS "superadmin_all_properties"        ON public.properties;
DROP POLICY IF EXISTS "superadmin_all_tenants"           ON public.tenants;
DROP POLICY IF EXISTS "superadmin_all_rooms"             ON public.rooms;
DROP FUNCTION IF EXISTS public.is_superadmin_user();
CREATE OR REPLACE FUNCTION public.is_superadmin_user()
RETURNS BOOLEAN
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

GRANT EXECUTE ON FUNCTION public.is_superadmin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin_user() TO service_role;

-- 3d. superadmin_organisations view (used by superadmin.js login check)
-- DROP first because CREATE OR REPLACE VIEW can't remove/rename columns from an older view.
DROP VIEW IF EXISTS public.superadmin_organisations;
CREATE VIEW public.superadmin_organisations AS
SELECT id, email, user_id, created_at FROM public.superadmin_allowlist;

GRANT SELECT ON public.superadmin_organisations TO authenticated;


-- ============================================================================
-- STEP 4: PUBLIC FUNCTIONS
-- ============================================================================

-- 4a. get_organisation_public_brand() — for /rooms.html
DROP FUNCTION IF EXISTS public.get_organisation_public_brand(uuid);

CREATE FUNCTION public.get_organisation_public_brand(p_org_id uuid)
RETURNS TABLE (
  org_name TEXT,
  tagline TEXT,
  whatsapp TEXT,
  whatsapp_skipped BOOLEAN,
  logo_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    coalesce(nullif(trim(o.name), ''), 'Properties')::text,
    nullif(trim(o.public_listings_tagline), '')::text,
    o.public_listings_whatsapp::text,
    coalesce(o.public_listings_whatsapp_skipped, false),
    nullif(coalesce(o.app_config -> 'config' ->> 'logoUrl', ''), '')::text
  FROM public.organisations o
  WHERE o.id = p_org_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_organisation_public_brand(uuid) TO anon, authenticated;


-- ============================================================================
-- STEP 5: PLAN LIMIT ENFORCEMENT (triggers)
-- ============================================================================

-- 5a. _plan_caps() helper function
-- Enterprise tier is unlimited on all axes. Unknown plan keys (custom plans added
-- via superadmin Plans & Pricing) default to UNLIMITED so they don't hard-cap at 3.
-- DROP first because an existing version with the same args but different RETURNS shape
-- will reject CREATE OR REPLACE ("cannot change return type").
DROP FUNCTION IF EXISTS public._plan_caps(text);
CREATE OR REPLACE FUNCTION public._plan_caps(_plan text)
RETURNS TABLE (max_properties integer, max_tenants integer, max_users integer)
LANGUAGE sql STABLE
AS $$
  WITH p AS (SELECT lower(coalesce(_plan, 'free')) AS k)
  SELECT
    CASE (SELECT k FROM p)
      WHEN 'free'         THEN 3
      WHEN 'starter'      THEN 15
      WHEN 'professional' THEN 25
      WHEN 'business'     THEN 60
      WHEN 'enterprise'   THEN 2147483647
      WHEN 'trial'        THEN 5
      ELSE 2147483647
    END AS max_properties,
    CASE (SELECT k FROM p)
      WHEN 'free'         THEN 15
      WHEN 'starter'      THEN 75
      WHEN 'professional' THEN 2147483647
      WHEN 'business'     THEN 2147483647
      WHEN 'enterprise'   THEN 2147483647
      WHEN 'trial'        THEN 30
      ELSE 2147483647
    END AS max_tenants,
    CASE (SELECT k FROM p)
      WHEN 'free'         THEN 2
      WHEN 'starter'      THEN 3
      WHEN 'professional' THEN 5
      WHEN 'business'     THEN 15
      WHEN 'enterprise'   THEN 2147483647
      WHEN 'trial'        THEN 3
      ELSE 2147483647
    END AS max_users;
$$;

-- 5b. enforce_plan_limits() trigger function (with billing_override bypass)
-- Triggers hold the function by oid, so we drop the triggers first (step 5c recreates them),
-- then drop+recreate the function to ensure signature changes apply cleanly.
DROP TRIGGER IF EXISTS trg_enforce_plan_limits_properties  ON public.properties;
DROP TRIGGER IF EXISTS trg_enforce_plan_limits_tenants     ON public.tenants;
DROP TRIGGER IF EXISTS trg_enforce_plan_limits_org_members ON public.org_members;
DROP FUNCTION IF EXISTS public.enforce_plan_limits();
CREATE OR REPLACE FUNCTION public.enforce_plan_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_org_id UUID;
  v_plan TEXT;
  v_status TEXT;
  v_trial_ends TIMESTAMPTZ;
  v_override TEXT;
  v_free_until DATE;
  v_resolved_status TEXT;
  v_effective_plan TEXT;
  v_cap_properties INTEGER;
  v_cap_tenants INTEGER;
  v_cap_users INTEGER;
  v_count INTEGER;
BEGIN
  v_org_id := coalesce(new.org_id, old.org_id);
  IF v_org_id IS NULL THEN RETURN new; END IF;

  SELECT plan, status, trial_ends_at, billing_override, free_until
  INTO v_plan, v_status, v_trial_ends, v_override, v_free_until
  FROM public.organisations WHERE id = v_org_id;

  IF NOT FOUND THEN RETURN new; END IF;

  -- Hard stop on inactive organisations
  IF coalesce(v_status, 'active') IN ('paused', 'cancelled') THEN
    RAISE EXCEPTION 'Organisation is % and cannot be modified.', v_status USING errcode = 'P0001';
  END IF;

  -- Admin-granted free access = unlimited.
  --   billing_override='free'  → indefinite
  --   free_until >= today      → time-boxed (auto-expires)
  IF lower(coalesce(v_override, '')) = 'free' THEN RETURN new; END IF;
  IF v_free_until IS NOT NULL AND v_free_until >= current_date THEN RETURN new; END IF;

  v_effective_plan := lower(coalesce(nullif(trim(coalesce(v_plan, '')), ''), 'free'));
  v_resolved_status := nullif(trim(lower(coalesce(v_status, ''))), '');
  IF v_resolved_status IS NULL THEN
    IF v_trial_ends IS NOT NULL AND v_trial_ends > now() THEN
      v_resolved_status := 'trial';
    ELSE
      v_resolved_status := 'active';
    END IF;
  END IF;
  IF v_effective_plan = 'free' AND v_resolved_status = 'trial' THEN
    v_effective_plan := 'trial';
  END IF;

  SELECT max_properties, max_tenants, max_users
  INTO v_cap_properties, v_cap_tenants, v_cap_users
  FROM public._plan_caps(v_effective_plan);

  IF tg_table_name = 'properties' THEN
    SELECT count(*) INTO v_count
    FROM public.properties p
    WHERE p.org_id = v_org_id
      AND coalesce(p.status, 'active') <> 'archived'
      AND (tg_op <> 'UPDATE' OR p.id <> old.id);
    IF v_count >= v_cap_properties THEN
      RAISE EXCEPTION 'Plan limit reached: max % properties for plan %.', v_cap_properties, coalesce(v_effective_plan, 'free') USING errcode = 'P0001';
    END IF;
  ELSIF tg_table_name = 'tenants' THEN
    IF coalesce(new.status, 'active') <> 'inactive' THEN
      SELECT count(*) INTO v_count
      FROM public.tenants t
      WHERE t.org_id = v_org_id
        AND coalesce(t.status, 'active') <> 'inactive'
        AND (tg_op <> 'UPDATE' OR t.id <> old.id);
      IF v_count >= v_cap_tenants THEN
        RAISE EXCEPTION 'Plan limit reached: max % active tenants for plan %.', v_cap_tenants, coalesce(v_effective_plan, 'free') USING errcode = 'P0001';
      END IF;
    END IF;
  ELSIF tg_table_name = 'org_members' THEN
    SELECT count(*) INTO v_count
    FROM public.org_members om
    WHERE om.org_id = v_org_id
      AND (tg_op <> 'UPDATE' OR om.id <> old.id);
    IF v_count >= v_cap_users THEN
      RAISE EXCEPTION 'Plan limit reached: max % users for plan %.', v_cap_users, coalesce(v_effective_plan, 'free') USING errcode = 'P0001';
    END IF;
  END IF;

  RETURN new;
END;
$$;

-- 5c. Attach triggers
DROP TRIGGER IF EXISTS trg_enforce_plan_limits_properties ON public.properties;
CREATE TRIGGER trg_enforce_plan_limits_properties
  BEFORE INSERT OR UPDATE OF org_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_limits_tenants ON public.tenants;
CREATE TRIGGER trg_enforce_plan_limits_tenants
  BEFORE INSERT OR UPDATE OF org_id, status ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

DROP TRIGGER IF EXISTS trg_enforce_plan_limits_org_members ON public.org_members;
CREATE TRIGGER trg_enforce_plan_limits_org_members
  BEFORE INSERT OR UPDATE OF org_id ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();


-- ============================================================================
-- STEP 6: ROW LEVEL SECURITY — Superadmin policies
-- ============================================================================

-- 6a. organisations — superadmin full access
DROP POLICY IF EXISTS "superadmin_all_organisations" ON public.organisations;
CREATE POLICY "superadmin_all_organisations"
  ON public.organisations FOR ALL TO authenticated
  USING (public.is_superadmin_user())
  WITH CHECK (public.is_superadmin_user());

-- 6b. organisations — org members can read their own org
DROP POLICY IF EXISTS "org_members_can_read_own_org" ON public.organisations;
CREATE POLICY "org_members_can_read_own_org"
  ON public.organisations FOR SELECT TO authenticated
  USING (id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()));

-- 6c. saas_config — superadmin only
DROP POLICY IF EXISTS "superadmin_all_saas_config" ON public.saas_config;
CREATE POLICY "superadmin_all_saas_config"
  ON public.saas_config FOR ALL TO authenticated
  USING (public.is_superadmin_user())
  WITH CHECK (public.is_superadmin_user());


-- ============================================================================
-- STEP 6.5: DEFENSIVE — ensure every org-scoped table has an `org_id` column
-- before step 7 tries to create policies that reference it.
-- (Missing this was the root cause of: ERROR 42703 column "org_id" does not exist)
-- ============================================================================
DO $step_6_5$
DECLARE
  t text;
  tables text[] := ARRAY[
    'app_users','companies','contractors','daily_insights','expenses',
    'landlord_payments','landlords','maintenance','payments','properties',
    'property_docs','property_documents','rent_schedule','rooms',
    'tenant_docs','tenant_documents','tenants','void_dates','email_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id)',
        t
      );
    END IF;
  END LOOP;
END
$step_6_5$;

-- Backfill org_id on property_docs / tenant_docs from their parent rows so existing
-- documents are still visible under RLS.
DO $backfill_docs$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='property_docs' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='property_docs' AND column_name='property_id'
  ) THEN
    UPDATE public.property_docs pd
       SET org_id = p.org_id
      FROM public.properties p
     WHERE pd.org_id IS NULL
       AND pd.property_id = p.id::text;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenant_docs' AND column_name='org_id'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='tenant_docs' AND column_name='tenant_id'
  ) THEN
    UPDATE public.tenant_docs td
       SET org_id = t.org_id
      FROM public.tenants t
     WHERE td.org_id IS NULL
       AND td.tenant_id = t.id::text;
  END IF;
END
$backfill_docs$;


-- ============================================================================
-- STEP 7: ROW LEVEL SECURITY — Org isolation on ALL operational tables
-- Uses a helper that no-ops if the table doesn't exist on this env, and skips
-- any table that lacks `org_id` (so custom/old schemas don't blow up the migration).
-- ============================================================================

DO $step_7$
DECLARE
  t text;
  tables text[] := ARRAY[
    'app_users','companies','contractors','daily_insights','expenses',
    'landlord_payments','landlords','maintenance','payments','properties',
    'property_docs','property_documents','rent_schedule','rooms',
    'tenant_docs','tenant_documents','tenants','void_dates','email_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip if the table doesn't exist on this environment.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=t
    ) THEN
      RAISE NOTICE 'Skipping RLS for missing table: %', t;
      CONTINUE;
    END IF;

    -- Skip if the column doesn't exist on this environment (step 6.5 should have added it,
    -- but defensive check in case of unusual schemas).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='org_id'
    ) THEN
      RAISE NOTICE 'Skipping RLS for table without org_id: %', t;
      CONTINUE;
    END IF;

    -- Always enable RLS.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop older policy names (legacy, per-table aliases) so we end up with one canonical policy.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Org members can manage their ' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_org_isolation', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'org_isolation_' || t, t);

    -- Create canonical org-isolation policy. Docs tables require org_id NOT NULL to be safe.
    IF t IN ('property_docs','tenant_docs','companies') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        || 'USING (org_id IS NOT NULL AND org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())) '
        || 'WITH CHECK (org_id IS NOT NULL AND org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))',
        'org_isolation_' || t, t
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
        || 'USING (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())) '
        || 'WITH CHECK (org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid()))',
        'org_isolation_' || t, t
      );
    END IF;
  END LOOP;
END
$step_7$;

-- org_members — special case. Must NOT self-reference in the policy because Postgres
-- re-runs RLS on the subquery, causing infinite recursion (42P17).
-- Split into (a) a simple self-row policy and (b) a SECURITY DEFINER helper +
-- policy for seeing other members of the orgs you belong to.
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_isolation_org_members" ON public.org_members;
DROP POLICY IF EXISTS "org_members_self" ON public.org_members;
DROP POLICY IF EXISTS "org_members_read_other_members" ON public.org_members;

CREATE POLICY "org_members_self" ON public.org_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- SECURITY DEFINER helper — bypasses RLS so subsequent policies referencing it
-- can never recurse. Returns the set of orgs the signed-in user belongs to.
CREATE OR REPLACE FUNCTION public._current_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public._current_user_org_ids() TO authenticated;

CREATE POLICY "org_members_read_other_members" ON public.org_members
  FOR SELECT TO authenticated
  USING (org_id IN (SELECT public._current_user_org_ids()));

-- 7u. saas_config — RLS already handled by superadmin policy in step 6c
ALTER TABLE public.saas_config ENABLE ROW LEVEL SECURITY;

-- 7v. superadmin_allowlist — RLS enabled, no client policies (service_role only + SECURITY DEFINER function)
ALTER TABLE public.superadmin_allowlist ENABLE ROW LEVEL SECURITY;
-- Allow superadmins to read/write the allowlist from the panel
DROP POLICY IF EXISTS "superadmin_manage_allowlist" ON public.superadmin_allowlist;
CREATE POLICY "superadmin_manage_allowlist" ON public.superadmin_allowlist
  FOR ALL TO authenticated
  USING (public.is_superadmin_user())
  WITH CHECK (public.is_superadmin_user());


-- ============================================================================
-- STEP 8: SUPERADMIN RLS BYPASS — let superadmins read ALL org-scoped tables
-- (needed for Users page, Org detail usage stats, etc.)
-- ============================================================================

-- superadmin needs to read org_members across all orgs
DROP POLICY IF EXISTS "superadmin_all_org_members" ON public.org_members;
CREATE POLICY "superadmin_all_org_members" ON public.org_members
  FOR ALL TO authenticated
  USING (public.is_superadmin_user())
  WITH CHECK (public.is_superadmin_user());

-- superadmin needs to count properties/tenants/rooms for usage stats
DROP POLICY IF EXISTS "superadmin_all_properties" ON public.properties;
CREATE POLICY "superadmin_all_properties" ON public.properties
  FOR SELECT TO authenticated
  USING (public.is_superadmin_user());

DROP POLICY IF EXISTS "superadmin_all_tenants" ON public.tenants;
CREATE POLICY "superadmin_all_tenants" ON public.tenants
  FOR SELECT TO authenticated
  USING (public.is_superadmin_user());

DROP POLICY IF EXISTS "superadmin_all_rooms" ON public.rooms;
CREATE POLICY "superadmin_all_rooms" ON public.rooms
  FOR SELECT TO authenticated
  USING (public.is_superadmin_user());


-- ============================================================================
-- STEP 9: FINAL SCHEMA RELOAD
-- ============================================================================
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- STEP 10: VERIFICATION — Run these queries after to confirm everything worked
-- ============================================================================

-- 10a. Check all tables have RLS enabled:
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;

-- 10b. Check all policies:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- 10c. Check superadmin_allowlist has your emails:
-- SELECT * FROM public.superadmin_allowlist;

-- 10d. Check new columns exist on organisations:
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'organisations' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- 10e. Check triggers are attached:
-- SELECT trigger_name, event_object_table, action_timing
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
-- ORDER BY event_object_table;

-- 10f. Test is_superadmin_user() works (run as authenticated user):
-- SELECT public.is_superadmin_user();
