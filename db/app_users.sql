create table public.app_users (
  id uuid not null,
  name text null,
  role text null default 'viewer'::text,
  phone text null,
  status text null default 'active'::text,
  last_login timestamp with time zone null,
  created_at timestamp with time zone null default now(),
  constraint app_users_pkey primary key (id),
  constraint app_users_id_fkey foreign KEY (id) references auth.users (id)
) TABLESPACE pg_default;