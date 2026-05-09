create table public.tenant_docs (
  id text not null,
  tenant_id text null,
  name text null,
  type text null,
  size text null,
  storage_path text null,
  uploaded_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint tenant_docs_pkey primary key (id),
  constraint tenant_docs_org_id_fkey foreign key (org_id) references organisations(id)
) TABLESPACE pg_default;