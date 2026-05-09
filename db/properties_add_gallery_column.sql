-- properties_add_gallery_column.sql
-- Adds JSONB column to store photo/video gallery URLs per property.
-- Files themselves live in the property-docs Supabase Storage bucket under
-- properties/{property_id}/gallery/photos/ and .../videos/. This column holds
-- metadata + public URLs only.
--
-- Shape: { photos: [{name, url, storagePath, uploadedAt}], videos: [...] }
-- App caps: 20 photos, 2 videos per property (client-enforced).

begin;

alter table public.properties
  add column if not exists gallery jsonb not null default '{"photos":[],"videos":[]}'::jsonb;

comment on column public.properties.gallery is
  'Photo + video gallery: {photos:[{name,url,storagePath,uploadedAt}], videos:[...]}. Files in Supabase Storage.';

commit;
