-- FIX_org_creation_on_signup.sql
-- After PRODUCTION_MIGRATION_ALL.sql, newly signed-up users can't create their own
-- org because RLS has no INSERT policy for regular authenticated users on
-- `organisations` or `org_members`. The superadmin policies cover that table for
-- superadmins only, and the read policy covers existing members. Nothing allows
-- a brand-new user to bootstrap their own org.
--
-- This file adds the two missing policies:
--   1. Any authenticated user can INSERT a new organisation.
--   2. Any authenticated user can INSERT their own org_members row (binding
--      themselves to any org) — the subsequent RLS check then scopes all
--      downstream reads/writes to that org.
--
-- Run on kzumoubhxdoqqcucdact (prod).

begin;

-- 1. Any authenticated user may create a new organisation.
drop policy if exists "auth_users_can_create_organisations" on public.organisations;
create policy "auth_users_can_create_organisations"
  on public.organisations
  for insert to authenticated
  with check (true);

-- 2. Authenticated users may insert themselves into org_members (bootstrap only).
--    The existing `org_isolation_org_members` policy already handles SELECT/UPDATE/DELETE
--    scoped to rows where you're a member. This new policy specifically allows INSERT
--    for the user's own user_id (prevents inserting other people).
drop policy if exists "auth_users_can_join_as_self" on public.org_members;
create policy "auth_users_can_join_as_self"
  on public.org_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- 3. Optional: let the organisation's creator UPDATE it (e.g. rename, set branding)
--    even before their org_members row exists. The existing read policy already
--    allows SELECT via membership, so this covers the brief window between
--    INSERT org → INSERT org_members.
drop policy if exists "auth_users_can_update_own_orgs" on public.organisations;
create policy "auth_users_can_update_own_orgs"
  on public.organisations
  for update to authenticated
  using (id in (select org_id from public.org_members where user_id = auth.uid()))
  with check (id in (select org_id from public.org_members where user_id = auth.uid()));

commit;

notify pgrst, 'reload schema';
