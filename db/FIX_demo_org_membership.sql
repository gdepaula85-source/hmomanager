-- FIX_demo_org_membership.sql
-- Ensures demo@landlordapp.io is linked to the demo org as admin.
-- Deletes any previous wrong-link row first, then re-inserts from auth.users.
-- Safe to re-run.

do $$
declare
  demo_user_id uuid;
  demo_org_id  uuid := '00000000-0000-0000-0000-00000000d3d0';
  linked_rows  int;
begin
  select id into demo_user_id from auth.users where email = 'demo@landlordapp.io' limit 1;

  if demo_user_id is null then
    raise notice 'NO demo auth user — create one in Supabase Dashboard → Authentication → Users first (email: demo@landlordapp.io, password: DemoAccount2026!, auto-confirm ticked).';
    return;
  end if;

  raise notice 'Demo user id: %', demo_user_id;

  -- Ensure email is confirmed (Supabase blocks unconfirmed logins by default).
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = demo_user_id;

  -- Remove any stale membership rows for this user (they may have landed in the
  -- wrong org via the signup flow, which would show their own org's data instead
  -- of the demo seed).
  delete from public.org_members where user_id = demo_user_id;

  -- Link cleanly to the demo org as admin.
  insert into public.org_members (id, org_id, user_id, role)
  values (gen_random_uuid(), demo_org_id, demo_user_id, 'admin');

  get diagnostics linked_rows = row_count;
  raise notice 'Inserted % org_members row(s) linking demo user → demo org.', linked_rows;
end
$$;

-- Verify:
select om.user_id, om.org_id, om.role, au.email, au.email_confirmed_at is not null as confirmed
from public.org_members om
join auth.users au on au.id = om.user_id
where au.email = 'demo@landlordapp.io';

-- Expect one row, org_id = 00000000-0000-0000-0000-00000000d3d0, confirmed = true.
