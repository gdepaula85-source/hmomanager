-- blog_cms.sql
-- DB-backed blog with draft/published states + image uploads via Supabase Storage.
-- Read access: anyone can SELECT published posts; superadmin can do everything.
-- Write access: superadmin only (via is_superadmin_user() function from PRODUCTION_MIGRATION_ALL.sql).
--
-- Run on kzumoubhxdoqqcucdact.

begin;

create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  excerpt       text,
  body_html     text,
  cover_image   text,                                  -- public URL (Supabase Storage or external)
  author        text default 'Gleydson',
  category      text,                                  -- e.g. 'HMO licensing', 'R2R'
  read_minutes  integer,                               -- nullable; admin sets manually
  tags          text[] default array[]::text[],
  status        text not null default 'draft' check (status in ('draft','published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc nulls last);
create index if not exists blog_posts_slug_idx
  on public.blog_posts (slug);

-- Auto-bump updated_at on every UPDATE.
create or replace function public._blog_posts_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  -- If status flips from draft → published and published_at is null, stamp it.
  if new.status = 'published' and old.status = 'draft' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_blog_posts_touch on public.blog_posts;
create trigger trg_blog_posts_touch
  before update on public.blog_posts
  for each row execute function public._blog_posts_touch_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────
alter table public.blog_posts enable row level security;

-- Public: read published posts only.
drop policy if exists blog_public_read_published on public.blog_posts;
create policy blog_public_read_published
  on public.blog_posts for select
  to anon, authenticated
  using (status = 'published');

-- Superadmin: full access (read drafts, edit, delete).
drop policy if exists blog_superadmin_all on public.blog_posts;
create policy blog_superadmin_all
  on public.blog_posts for all
  to authenticated
  using (public.is_superadmin_user())
  with check (public.is_superadmin_user());

-- ── Storage bucket for cover images / inline post images ─────────
-- Run AFTER you create the bucket in Supabase Dashboard → Storage:
--   Name: blog-images
--   Public: yes (so <img src> tags work without signed URLs)
-- Then the policies below make it superadmin-only for writes.
do $$
begin
  -- Allow public read on the blog-images bucket.
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='blog_images_public_read') then
    execute $p$
      create policy blog_images_public_read on storage.objects
        for select to anon, authenticated
        using (bucket_id = 'blog-images')
    $p$;
  end if;

  -- Allow superadmin to upload / update / delete.
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='blog_images_superadmin_write') then
    execute $p$
      create policy blog_images_superadmin_write on storage.objects
        for all to authenticated
        using (bucket_id = 'blog-images' and public.is_superadmin_user())
        with check (bucket_id = 'blog-images' and public.is_superadmin_user())
    $p$;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';

-- After running this:
-- 1. Supabase Dashboard → Storage → New bucket → name "blog-images", make it Public.
-- 2. The bucket inherits the policies above automatically.
