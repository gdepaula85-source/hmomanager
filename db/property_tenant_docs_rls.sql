-- property_tenant_docs_rls.sql
-- Enable RLS + org-scoped policies on property_docs and tenant_docs.
-- Without policies, Supabase returns 400 on every SELECT/INSERT/UPDATE/DELETE
-- even for authenticated users. Scope: a row is visible/writable only if the
-- signed-in user belongs to the same org_id via public.org_members.
--
-- Run on piufcteaqmxemidfdoim.

begin;

-- ── property_docs ───────────────────────────────────────────────
alter table public.property_docs enable row level security;

drop policy if exists property_docs_select on public.property_docs;
drop policy if exists property_docs_insert on public.property_docs;
drop policy if exists property_docs_update on public.property_docs;
drop policy if exists property_docs_delete on public.property_docs;

create policy property_docs_select on public.property_docs
  for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = property_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy property_docs_insert on public.property_docs
  for insert
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = property_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy property_docs_update on public.property_docs
  for update
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = property_docs.org_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = property_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy property_docs_delete on public.property_docs
  for delete
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = property_docs.org_id
        and om.user_id = auth.uid()
    )
  );

-- ── tenant_docs ─────────────────────────────────────────────────
alter table public.tenant_docs enable row level security;

drop policy if exists tenant_docs_select on public.tenant_docs;
drop policy if exists tenant_docs_insert on public.tenant_docs;
drop policy if exists tenant_docs_update on public.tenant_docs;
drop policy if exists tenant_docs_delete on public.tenant_docs;

create policy tenant_docs_select on public.tenant_docs
  for select
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = tenant_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy tenant_docs_insert on public.tenant_docs
  for insert
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = tenant_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy tenant_docs_update on public.tenant_docs
  for update
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = tenant_docs.org_id
        and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = tenant_docs.org_id
        and om.user_id = auth.uid()
    )
  );

create policy tenant_docs_delete on public.tenant_docs
  for delete
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = tenant_docs.org_id
        and om.user_id = auth.uid()
    )
  );

commit;

-- Force PostgREST to pick up the new policies.
notify pgrst, 'reload schema';
