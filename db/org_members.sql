create table public.org_members (
  id uuid not null default gen_random_uuid (),
  org_id uuid null,
  user_id uuid null,
  role text null default 'admin'::text,
  created_at timestamp with time zone null default now(),
  constraint org_members_pkey primary key (id),
  constraint org_members_org_id_user_id_key unique (org_id, user_id),
  constraint org_members_org_id_fkey foreign KEY (org_id) references organisations (id) on delete CASCADE,
  constraint org_members_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete CASCADE
) TABLESPACE pg_default;