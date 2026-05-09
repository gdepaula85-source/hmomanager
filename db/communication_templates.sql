-- ────────────────────────────────────────────────────────────────────────────
-- communication_templates.sql
-- Per-organisation editable message templates for the Tenant Communication Hub.
-- Used for both Email (via Resend) and WhatsApp (click-to-chat) channels.
-- Run on both TEST and PROD Supabase projects.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS communication_templates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  language    TEXT NOT NULL DEFAULT 'en',
  channel     TEXT NOT NULL DEFAULT 'both' CHECK (channel IN ('email','whatsapp','both')),
  subject     TEXT,
  body_text   TEXT NOT NULL,
  body_html   TEXT,
  is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT communication_templates_unique_per_org_lang UNIQUE (org_id, slug, language)
);

CREATE INDEX IF NOT EXISTS idx_comm_templates_org_lang
  ON communication_templates (org_id, language)
  WHERE is_archived = FALSE;

-- updated_at trigger
CREATE OR REPLACE FUNCTION _comm_templates_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comm_templates_updated_at ON communication_templates;
CREATE TRIGGER trg_comm_templates_updated_at
BEFORE UPDATE ON communication_templates
FOR EACH ROW EXECUTE FUNCTION _comm_templates_set_updated_at();

-- RLS
ALTER TABLE communication_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "communication_templates_org_isolation" ON communication_templates;
CREATE POLICY "communication_templates_org_isolation" ON communication_templates
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
