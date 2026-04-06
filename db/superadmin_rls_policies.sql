-- superadmin_rls_policies.sql
-- Superadmin panel (public/js/superadmin.js) loads organisations and saas_config with the
-- anon key + user JWT. Row Level Security often restricts organisations to org_members only,
-- so superadmins see an empty list. These policies allow allowlisted emails full access.
--
-- Apply in Supabase SQL Editor (or psql). Idempotent: safe to re-run.
--
-- IMPORTANT: Keep the email list in sync with SUPERADMIN_EMAILS in public/js/superadmin.js
-- (and any rows you rely on in the superadmin_organisations view for login).

create or replace function public.is_superadmin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(coalesce(
    auth.jwt() ->> 'email',
    auth.jwt() -> 'user_metadata' ->> 'email',
    ''
  ))) in (
    'g.depaula85@gmail.com',
    'gleydson@reservationsdirect.co.uk',
    'test2@gmail.com'
  );
$$;

comment on function public.is_superadmin_user() is
  'True when JWT email matches superadmin allowlist. Sync with SUPERADMIN_EMAILS in superadmin.js.';

grant execute on function public.is_superadmin_user() to authenticated;
grant execute on function public.is_superadmin_user() to service_role;

-- organisations
drop policy if exists "superadmin_all_organisations" on public.organisations;
create policy "superadmin_all_organisations"
  on public.organisations
  for all
  to authenticated
  using (public.is_superadmin_user())
  with check (public.is_superadmin_user());

-- saas_config (Plans & Pricing page)
drop policy if exists "superadmin_all_saas_config" on public.saas_config;
create policy "superadmin_all_saas_config"
  on public.saas_config
  for all
  to authenticated
  using (public.is_superadmin_user())
  with check (public.is_superadmin_user());
