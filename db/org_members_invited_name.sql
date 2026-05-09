-- org_members_invited_name.sql
-- Denormalize the invited user's display name + email onto org_members so the
-- dashboard's team list shows real names instead of placeholders like
-- "User f0b212". Without this, the dashboard can only read user_id/role from
-- org_members, then has to fall back to "User <last-6>" when there's no local
-- session match (e.g. another admin viewing the team on a different device).
--
-- Run on test (piufcteaqmxemidfdoim) and prod (kzumoubhxdoqqcucdact).

alter table public.org_members
  add column if not exists invited_name  text,
  add column if not exists invited_email text;

-- Backfill: copy auth.users.raw_user_meta_data->>'full_name' (and email) into
-- existing rows so already-invited team members get real names too. Uses
-- coalesce so existing values are NEVER overwritten — safe to re-run.
update public.org_members om
   set invited_name  = coalesce(
         nullif(om.invited_name, ''),
         nullif(au.raw_user_meta_data->>'full_name', ''),
         split_part(au.email, '@', 1)
       ),
       invited_email = coalesce(
         nullif(om.invited_email, ''),
         au.email
       )
  from auth.users au
 where om.user_id = au.id
   and (om.invited_name is null or om.invited_name = ''
     or om.invited_email is null or om.invited_email = '');

-- Reload PostgREST schema cache so the new columns are visible to the API.
notify pgrst, 'reload schema';
