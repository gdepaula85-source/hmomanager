-- tenants_nationality_dob.sql
-- Adds nationality + dob columns the app already references.
-- PostgREST 400s on POST/PATCH when a sent column isn't in the schema cache.
-- Run on piufcteaqmxemidfdoim.

begin;

alter table public.tenants
  add column if not exists nationality text,
  add column if not exists dob date;

comment on column public.tenants.nationality is 'Tenant nationality (free text, e.g. British).';
comment on column public.tenants.dob is 'Tenant date of birth.';

commit;

-- Reload PostgREST schema cache (Supabase Dashboard → Database → API → Reload schema,
-- OR run: notify pgrst, 'reload schema'; from SQL editor).
notify pgrst, 'reload schema';
