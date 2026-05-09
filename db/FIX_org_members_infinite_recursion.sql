-- FIX_org_members_infinite_recursion.sql
-- The previous org_members policy did:
--   USING (user_id = auth.uid() OR org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()))
-- That subquery re-triggers RLS on org_members → recursion → Postgres aborts with 42P17.
--
-- Fix: split into two non-recursive policies.
--   1. Users can see / modify their own membership row (user_id = auth.uid()).
--   2. Admin-can-see-other-members is handled via a SECURITY DEFINER helper so
--      the lookup bypasses RLS and doesn't recurse.
--
-- Run on kzumoubhxdoqqcucdact.

begin;

-- 1. Drop the recursive policy.
drop policy if exists "org_isolation_org_members" on public.org_members;

-- 2. Users can manage their own membership row.
create policy "org_members_self" on public.org_members
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 3. Helper for "which orgs does the signed-in user belong to?" — SECURITY DEFINER
--    so it bypasses RLS and can't recurse. Other tables' policies can use this
--    safely in subqueries.
create or replace function public._current_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

grant execute on function public._current_user_org_ids() to authenticated;

-- 4. Let authenticated users SELECT other members of the orgs they belong to,
--    without recursion (uses the SECURITY DEFINER helper).
drop policy if exists "org_members_read_other_members" on public.org_members;
create policy "org_members_read_other_members" on public.org_members
  for select to authenticated
  using (org_id in (select public._current_user_org_ids()));

commit;

notify pgrst, 'reload schema';
