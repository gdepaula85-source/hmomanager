-- tenants_add_nationality_column.sql
-- Adds a nationality text column to tenants. Surfaced in the tenant profile
-- modal alongside DOB; used for right-to-rent and compliance checks.

begin;

alter table public.tenants
  add column if not exists nationality text;

comment on column public.tenants.nationality is
  'Tenant nationality — free-text, e.g. "British", "Polish". Surfaced in the tenant profile modal.';

commit;
