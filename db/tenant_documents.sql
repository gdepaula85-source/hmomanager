create table public.tenant_documents (
  id uuid not null default extensions.uuid_generate_v4 (),
  tenant_id uuid null,
  doc_type text null,
  file_name text null,
  file_url text null,
  file_size text null,
  uploaded_at timestamp with time zone null default now(),
  constraint tenant_documents_pkey primary key (id),
  constraint tenant_documents_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE
) TABLESPACE pg_default;