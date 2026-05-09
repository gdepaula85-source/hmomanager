-- superadmin_rls_policies.sql
-- Superadmin panel (public/js/superadmin.js) loads organisations and saas_config with the
-- anon key + user JWT. Row Level Security often restricts organisations to org_members only,
-- so superadmins see an empty list. These policies allow allowlisted users full access.
--
-- Apply in Supabase SQL Editor (or psql). Idempotent: safe to re-run.
--
-- LOGIN vs RLS: superadmin.js can grant access via SUPERADMIN_EMAILS or the
-- superadmin_organisations view. RLS only used to see those emails — updates were blocked.
-- Fix: add rows to public.superadmin_allowlist (email and/or user_id) for any admin who is
-- not in the hardcoded list below. Example:
--   insert into public.superadmin_allowlist (email, user_id) values ('you@company.com', null);
--   insert into public.superadmin_allowlist (email, user_id) values (null, 'uuid-from-auth.users');

-- ── Allowlist table (RLS: no policies = no direct client access; SECURITY DEFINER function reads it)
create table if not exists public.superadmin_allowlist (
  id uuid not null default gen_random_uuid() primary key,
  email text null,
  user_id uuid null,
  created_at timestamptz null default now(),
  constraint superadmin_allowlist_email_or_user check (email is not null or user_id is not null)
);

create unique index if not exists superadmin_allowlist_user_id_key
  on public.superadmin_allowlist (user_id) where user_id is not null;

create unique index if not exists superadmin_allowlist_email_lower_key
  on public.superadmin_allowlist (lower(trim(email))) where email is not null;

alter table public.superadmin_allowlist enable row level security;

comment on table public.superadmin_allowlist is
  'Superadmins for RLS (organisations, saas_config). Match superadmin.js / superadmin_organisations. Managed via SQL or service role.';

grant select, insert, update, delete on public.superadmin_allowlist to service_role;

create or replace function public.is_superadmin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select
      auth.uid() as uid,
      lower(trim(coalesce(
        auth.jwt() ->> 'email',
        auth.jwt() -> 'user_metadata' ->> 'email',
        ''
      ))) as email
  )
  select
    u.email in (
      'g.depaula85@gmail.com',
      'gleydson@reservationsdirect.co.uk',
      'test2@gmail.com'
    )
    or (u.email <> '' and exists (
      select 1
      from public.superadmin_allowlist s
      where s.email is not null
        and lower(trim(s.email)) = u.email
    ))
    or (u.uid is not null and exists (
      select 1
      from public.superadmin_allowlist s
      where s.user_id is not null
        and s.user_id = u.uid
    ))
  from u;
$$;

comment on function public.is_superadmin_user() is
  'True for hardcoded bootstrap emails or rows in public.superadmin_allowlist (email or user_id). Sync with SUPERADMIN_EMAILS / superadmin_organisations in superadmin.js.';

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
