create table public.landlords (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  phone text null,
  email text null,
  bank text null,
  sort_code text null,
  account_no text null,
  notes text null,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint landlords_pkey primary key (id),
  constraint landlords_org_id_fkey foreign KEY (org_id) references organisations (id)
) TABLESPACE pg_default;