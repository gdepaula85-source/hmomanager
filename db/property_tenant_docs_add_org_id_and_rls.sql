-- property_tenant_docs_add_org_id_and_rls.sql
-- The property_docs / tenant_docs tables on this env were created without org_id,
-- which is why:
--   a) the dashboard's GET ...?org_id=eq.<uuid> returns 400
--   b) the previous RLS migration errored ("column property_docs.org_id does not exist")
--
-- This migration:
--   1. Adds org_id to both tables (nullable first so existing rows don't block it)
--   2. Backfills org_id from the parent property / tenant
--   3. Adds FK to organisations
--   4. Enables RLS + org-scoped policies
--
-- Run on piufcteaqmxemidfdoim.

begin;

-- ── 1. Add org_id columns (nullable for backfill) ──────────────────
alter table public.property_docs add column if not exists org_id uuid;
alter table public.tenant_docs   add column if not exists org_id uuid;

-- ── 2. Backfill from parent rows ───────────────────────────────────
update public.property_docs pd
   set org_id = p.org_id
  from public.properties p
 where pd.org_id is null
   and pd.property_id = p.id::text;

update public.tenant_docs td
   set org_id = t.org_id
  from public.tenants t
 where td.org_id is null
   and td.tenant_id = t.id::text;

-- ── 3. Foreign-key to organisations (optional, matches repo style) ─
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'property_docs_org_id_fkey'
  ) then
    alter table public.property_docs
      add constraint property_docs_org_id_fkey
      foreign key (org_id) references public.organisations(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
     where conname = 'tenant_docs_org_id_fkey'
  ) then
    alter table public.tenant_docs
      add constraint tenant_docs_org_id_fkey
      foreign key (org_id) references public.organisations(id) on delete cascade;
  end if;
end $$;

-- Helpful index for the common ?org_id=eq.<uuid> filter.
create index if not exists property_docs_org_id_idx on public.property_docs(org_id);
create index if not exists tenant_docs_org_id_idx   on public.tenant_docs(org_id);

-- ── 4. RLS + org-scoped policies ───────────────────────────────────
alter table public.property_docs enable row level security;
alter table public.tenant_docs   enable row level security;

drop policy if exists property_docs_select on public.property_docs;
drop policy if exists property_docs_insert on public.property_docs;
drop policy if exists property_docs_update on public.property_docs;
drop policy if exists property_docs_delete on public.property_docs;

create policy property_docs_select on public.property_docs for select
  using (exists (select 1 from public.org_members om where om.org_id = property_docs.org_id and om.user_id = auth.uid()));
create policy property_docs_insert on public.property_docs for insert
  with check (exists (select 1 from public.org_members om where om.org_id = property_docs.org_id and om.user_id = auth.uid()));
create policy property_docs_update on public.property_docs for update
  using (exists (select 1 from public.org_members om where om.org_id = property_docs.org_id and om.user_id = auth.uid()))
  with check (exists (select 1 from public.org_members om where om.org_id = property_docs.org_id and om.user_id = auth.uid()));
create policy property_docs_delete on public.property_docs for delete
  using (exists (select 1 from public.org_members om where om.org_id = property_docs.org_id and om.user_id = auth.uid()));

drop policy if exists tenant_docs_select on public.tenant_docs;
drop policy if exists tenant_docs_insert on public.tenant_docs;
drop policy if exists tenant_docs_update on public.tenant_docs;
drop policy if exists tenant_docs_delete on public.tenant_docs;

create policy tenant_docs_select on public.tenant_docs for select
  using (exists (select 1 from public.org_members om where om.org_id = tenant_docs.org_id and om.user_id = auth.uid()));
create policy tenant_docs_insert on public.tenant_docs for insert
  with check (exists (select 1 from public.org_members om where om.org_id = tenant_docs.org_id and om.user_id = auth.uid()));
create policy tenant_docs_update on public.tenant_docs for update
  using (exists (select 1 from public.org_members om where om.org_id = tenant_docs.org_id and om.user_id = auth.uid()))
  with check (exists (select 1 from public.org_members om where om.org_id = tenant_docs.org_id and om.user_id = auth.uid()));
create policy tenant_docs_delete on public.tenant_docs for delete
  using (exists (select 1 from public.org_members om where om.org_id = tenant_docs.org_id and om.user_id = auth.uid()));

commit;

-- Force PostgREST to pick up the new columns + policies.
notify pgrst, 'reload schema';

-- Optional sanity check — rows that still have no org_id (orphaned docs you may want to delete).
-- select id, property_id from public.property_docs where org_id is null;
-- select id, tenant_id   from public.tenant_docs   where org_id is null;
