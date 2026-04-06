-- Allow deleting users from Supabase Auth without FK errors.
-- Root cause: public.app_users.id references auth.users.id without ON DELETE CASCADE.

alter table public.app_users
  drop constraint if exists app_users_id_fkey;

alter table public.app_users
  add constraint app_users_id_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade;
