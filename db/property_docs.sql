create table public.property_docs (
  id text not null,
  property_id text null,
  name text null,
  type text null,
  size text null,
  expires_at date null,
  storage_path text null,
  uploaded_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint property_docs_pkey primary key (id),
  constraint property_docs_org_id_fkey foreign key (org_id) references organisations(id)
) TABLESPACE pg_default;