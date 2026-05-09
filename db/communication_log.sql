-- ────────────────────────────────────────────────────────────────────────────
-- communication_log.sql
-- Captures send-intent for non-email channels (WhatsApp click-to-chat, etc.)
-- so the Communication Hub history view can show all outbound messages
-- alongside email_log entries.
-- Run on both TEST and PROD Supabase projects.
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comm_log (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id           UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tenant_id        UUID REFERENCES tenants(id) ON DELETE SET NULL,
  template_id      UUID REFERENCES communication_templates(id) ON DELETE SET NULL,
  channel          TEXT NOT NULL CHECK (channel IN ('whatsapp','email_external','sms')),
  recipient_handle TEXT,
  subject          TEXT,
  preview          TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_by       UUID,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_log_org_created
  ON comm_log (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comm_log_org_tenant_created
  ON comm_log (org_id, tenant_id, created_at DESC);

ALTER TABLE comm_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comm_log_org_isolation" ON comm_log;
CREATE POLICY "comm_log_org_isolation" ON comm_log
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
