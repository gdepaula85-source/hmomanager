-- Email log table for tenant email module
-- Tracks all emails sent to tenants and landlords for deduplication and audit

CREATE TABLE IF NOT EXISTS email_log (
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

-- Deduplication index: prevent sending same template for same due date twice
CREATE INDEX IF NOT EXISTS idx_email_log_dedup
  ON email_log (org_id, tenant_id, template_id, (metadata->>'due_date'));

-- Query index: fetch email history for an org
CREATE INDEX IF NOT EXISTS idx_email_log_org
  ON email_log (org_id, created_at DESC);

-- RLS
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_log_org_isolation" ON email_log
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_members WHERE user_id = auth.uid()
    )
  );
