-- ─────────────────────────────────────────────────────────────
-- organisations_public_brand_with_logo.sql
-- Extends get_organisation_public_brand() to also return the logo URL
-- so the public /rooms.html page can show the operator's logo.
--
-- The logo is stored inside app_config.config.logoUrl (JSON).
-- RUN ON BOTH TEST and PROD.
-- ─────────────────────────────────────────────────────────────

drop function if exists public.get_organisation_public_brand(uuid);

create function public.get_organisation_public_brand(p_org_id uuid)
returns table (
  org_name text,
  tagline text,
  whatsapp text,
  whatsapp_skipped boolean,
  logo_url text
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
    coalesce(o.public_listings_whatsapp_skipped, false),
    nullif(coalesce(o.app_config -> 'config' ->> 'logoUrl', ''), '')::text
  from public.organisations o
  where o.id = p_org_id;
$$;

grant execute on function public.get_organisation_public_brand(uuid) to anon, authenticated;
