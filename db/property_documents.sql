create table public.property_documents (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  doc_type text null,
  file_name text null,
  file_url text null,
  file_size text null,
  expires_at date null,
  uploaded_at timestamp with time zone null default now(),
  constraint property_documents_pkey primary key (id),
  constraint property_documents_property_id_fkey foreign KEY (property_id) references properties (id) on delete CASCADE
) TABLESPACE pg_default;