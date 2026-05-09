-- ────────────────────────────────────────────────────────────────────────────
-- organisations_currency_language.sql
-- Adds currency, language and date_format preferences to organisations table.
-- Run on both TEST and PROD Supabase projects.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS currency        VARCHAR(10)  DEFAULT 'GBP',
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5)   DEFAULT '£',
  ADD COLUMN IF NOT EXISTS language        VARCHAR(10)  DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS date_format     VARCHAR(20)  DEFAULT 'DD/MM/YYYY';

-- Back-fill existing rows so they have explicit defaults
UPDATE organisations
SET
  currency        = 'GBP',
  currency_symbol = '£',
  language        = 'en',
  date_format     = 'DD/MM/YYYY'
WHERE currency IS NULL;

-- Notify PostgREST of the schema change (avoids a full reload restart)
NOTIFY pgrst, 'reload schema';
