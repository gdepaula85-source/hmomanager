-- ─────────────────────────────────────────────────────────────
-- expenses_receipt_columns.sql
-- Adds optional receipt attachment + budget storage support to expenses.
-- The receipt is stored as a data URL (base64-encoded image/PDF) inline
-- in the row. Future enhancement: move to Supabase Storage and keep only the URL.
--
-- Run on TEST and PROD before deploying the corresponding bundle.
-- ─────────────────────────────────────────────────────────────

alter table public.expenses
  add column if not exists receipt_url  text null,
  add column if not exists receipt_name text null,
  add column if not exists receipt_type text null;

comment on column public.expenses.receipt_url  is 'Receipt attachment — currently a data URL, can be a Supabase Storage URL in future';
comment on column public.expenses.receipt_name is 'Original filename of the attached receipt';
comment on column public.expenses.receipt_type is 'MIME type of the attached receipt (e.g. image/jpeg, application/pdf)';
