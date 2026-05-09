-- Tenant signature + remote-signing token columns.
-- Stores a base64 PNG data URL captured from the agreement modal canvas
-- (or from the public /sign/:token page when the tenant signs on their own device).
-- Run on test (piufcteaqmxemidfdoim) and prod (kzumoubhxdoqqcucdact).

alter table public.tenants
  add column if not exists signature                  text,
  add column if not exists signature_saved_at         timestamptz,
  -- Single-use, time-boxed token used by the public /sign/:token page.
  -- Auto-cleared by the server after a successful POST /api/sign/:token.
  add column if not exists signature_token            uuid,
  add column if not exists signature_token_expires_at timestamptz,
  -- Optional captured-name (printed name on the agreement) — separate from t.name
  -- so a signing flow can record "Robert Smith" while the tenant record stays "Bob Smith".
  add column if not exists signature_signer_name      text,
  -- Which agreement template was signed ('ast' | 'room_letting' | 'company_let'
  -- | 'lodger' | 'excluded_licence' | 'renewal'). Lets the dashboard re-render
  -- the original agreement type when the landlord clicks "View signed agreement".
  add column if not exists signed_agreement_type      text,
  -- Snapshot of the landlord side at token-issue time so the rendered signed
  -- agreement always matches what the tenant actually saw, even if Settings is
  -- changed afterwards.
  add column if not exists signed_landlord_sig        text,
  add column if not exists signed_landlord_name       text,
  add column if not exists signed_landlord_title      text,
  add column if not exists signed_landlord_date       timestamptz,
  -- Snapshot of the agreement HTML the tenant saw at signing time. Lets the
  -- public /sign/:token page render the agreement above the signature canvas
  -- without needing to port the agreement templates server-side.
  add column if not exists signed_agreement_html      text,
  -- Audit trail captured at the moment of signing — what makes the e-signature
  -- legally defensible (ECA 2000 s.7). Stored alongside the signature itself.
  add column if not exists signed_ip                  text,
  add column if not exists signed_user_agent          text;

-- Index makes /api/sign/:token lookups O(log n) and lets us add a partial RLS policy later.
create index if not exists tenants_signature_token_idx
  on public.tenants (signature_token)
  where signature_token is not null;

-- Reload PostgREST schema cache so the new columns are visible to the API.
notify pgrst, 'reload schema';
