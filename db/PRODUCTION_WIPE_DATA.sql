-- PRODUCTION_WIPE_DATA.sql
-- Clean-slate: wipes every row of operational data from the prod Supabase
-- but KEEPS the schema, auth.users, superadmin_allowlist, and saas_config.
--
-- After this:
--   - All orgs / properties / tenants / payments / etc. are gone.
--   - Existing Supabase auth users can still log in, but they'll have no org_members
--     row, so they'll be routed to the first-time signup / create-org flow.
--   - Your superadmin accounts still resolve (superadmin_allowlist is preserved).
--   - Plan pricing configured via superadmin is preserved (saas_config).
--
-- SAFE TO RE-RUN. Uses TRUNCATE ... CASCADE where FKs exist.

-- Supabase SQL editor runs each statement in its own transaction, so we don't wrap.
-- Child tables first (belt + braces — the CASCADEs below will sweep any stragglers).

truncate table
  public.payments,
  public.landlord_payments,
  public.maintenance,
  public.expenses,
  public.contractors
  restart identity;

-- Docs — only if those tables exist on this env.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='property_docs')
    then execute 'truncate table public.property_docs restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tenant_docs')
    then execute 'truncate table public.tenant_docs restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='property_documents')
    then execute 'truncate table public.property_documents restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tenant_documents')
    then execute 'truncate table public.tenant_documents restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='rooms')
    then execute 'truncate table public.rooms restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='rent_schedule')
    then execute 'truncate table public.rent_schedule restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='void_dates')
    then execute 'truncate table public.void_dates restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='daily_insights')
    then execute 'truncate table public.daily_insights restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='email_log')
    then execute 'truncate table public.email_log restart identity';
  end if;
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='app_users')
    then execute 'truncate table public.app_users restart identity';
  end if;
end $$;

-- Now the parents.
truncate table
  public.tenants,
  public.properties,
  public.landlords,
  public.companies
  restart identity;

-- Finally the org scaffolding. CASCADE sweeps anything we missed.
truncate table public.org_members restart identity cascade;
truncate table public.organisations restart identity cascade;

-- Force PostgREST to pick up a clean schema.
notify pgrst, 'reload schema';

-- Sanity check: everything below should return 0.
-- select count(*) from public.organisations;
-- select count(*) from public.properties;
-- select count(*) from public.tenants;
-- select count(*) from public.payments;
-- select count(*) from public.expenses;
-- select count(*) from public.maintenance;
-- select count(*) from public.landlords;
-- select count(*) from public.companies;

-- Superadmin + plan config should still have rows:
-- select * from public.superadmin_allowlist;
-- select * from public.saas_config;
