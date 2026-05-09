-- ============================================================================
-- add_billing_override_columns.sql
-- Add billing_override and billing_override_note to organisations table
-- Run this in the Supabase SQL Editor before using the Billing Override feature
-- ============================================================================

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS billing_override text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_override_note text DEFAULT NULL;

-- billing_override values: NULL (normal billing), 'free' (free grant, skip Stripe)
-- billing_override_note: optional reason for the override (e.g. "Partner company")

COMMENT ON COLUMN public.organisations.billing_override IS 'NULL = normal billing, ''free'' = admin-granted free access to paid plan';
COMMENT ON COLUMN public.organisations.billing_override_note IS 'Optional reason for billing override';
