-- ─────────────────────────────────────────────────────────────────────────────
-- Marketing leads table
--
-- Captures email addresses from the exit-intent popup (and any future
-- top-of-funnel lead magnets). Decoupled from `auth.users` and `org_members`
-- because most leads will NEVER sign up — they want the PDF and a nurture
-- sequence, not a trial.
--
-- Columns kept deliberately minimal; we can layer tags / source / utm_*
-- fields later as we add more capture surfaces.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id           uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  email        text        NOT NULL,
  -- Where this lead came from. Examples: 'exit_intent_compliance_pdf',
  -- 'landing_pricing_form', 'rooms_listing_inquiry'. Lets marketing slice
  -- conversion by source without adding more columns later.
  source       text        NOT NULL,
  -- The lead magnet they asked for (or 'newsletter' / null for plain
  -- email-list signups). Lets the email sender attach the right PDF.
  asset        text        NULL,
  -- Optional UTM-style attribution from the page that captured them.
  referrer     text        NULL,
  user_agent   text        NULL,
  -- Soft-link to an org if/when this lead later signs up. Populated on
  -- signup by matching their email; NULL until then.
  converted_to_org_id  uuid NULL REFERENCES public.organisations(id) ON DELETE SET NULL,
  converted_at         timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Same-source same-email re-submits update created_at rather than insert.
  CONSTRAINT marketing_leads_email_source_unique UNIQUE (email, source)
);

CREATE INDEX IF NOT EXISTS idx_marketing_leads_email   ON public.marketing_leads (email);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_source  ON public.marketing_leads (source);
CREATE INDEX IF NOT EXISTS idx_marketing_leads_created ON public.marketing_leads (created_at DESC);

-- RLS: this table is written exclusively by the server (service role) and
-- never read by clients. Enable RLS with NO policies so direct browser
-- access is blocked even if someone discovers the table name.
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

-- Superadmin-only read access (so the marketing dashboard can list leads
-- without granting service_role to the browser).
DROP POLICY IF EXISTS marketing_leads_superadmin_read ON public.marketing_leads;
CREATE POLICY marketing_leads_superadmin_read ON public.marketing_leads
  FOR SELECT TO authenticated
  USING (public.is_superadmin_user());

NOTIFY pgrst, 'reload schema';
