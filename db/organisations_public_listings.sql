-- Public /rooms.html branding & WhatsApp (per organisation).
-- Run on Supabase after deploy. Dashboard + PATCH /api/public/listings-brand update these columns.

alter table public.organisations
  add column if not exists public_listings_whatsapp text null;

alter table public.organisations
  add column if not exists public_listings_whatsapp_skipped boolean not null default false;

alter table public.organisations
  add column if not exists public_listings_tagline text null;

comment on column public.organisations.public_listings_whatsapp is 'Digits-only or E.164-style number for wa.me on public listings page';
comment on column public.organisations.public_listings_whatsapp_skipped is 'Admin chose not to show WhatsApp on public listings without a number';
comment on column public.organisations.public_listings_tagline is 'Optional subtitle next to org name in /rooms.html footer (e.g. area or strapline)';

-- Dashboard saves these via the authenticated Supabase client. If updates fail with RLS,
-- add or extend a policy so org_members can UPDATE their organisation row (same as email_settings).

-- Public /rooms.html — callable with anon key (same as property reads). Drop first if you change the signature.
drop function if exists public.get_organisation_public_brand(uuid);

create function public.get_organisation_public_brand(p_org_id uuid)
returns table (
  org_name text,
  tagline text,
  whatsapp text,
  whatsapp_skipped boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(nullif(trim(o.name), ''), 'Properties')::text,
    nullif(trim(o.public_listings_tagline), '')::text,
    o.public_listings_whatsapp::text,
    coalesce(o.public_listings_whatsapp_skipped, false)
  from public.organisations o
  where o.id = p_org_id;
$$;

grant execute on function public.get_organisation_public_brand(uuid) to anon, authenticated;
