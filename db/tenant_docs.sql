create table public.tenant_docs (
  id text not null,
  tenant_id text null,
  name text null,
  type text null,
  size text null,
  storage_path text null,
  uploaded_at timestamp with time zone null default now(),
  constraint tenant_docs_pkey primary key (id)
) TABLESPACE pg_default;