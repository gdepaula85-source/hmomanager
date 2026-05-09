create table public.companies (
  id text not null,
  name text null,
  company_no text null,
  vat_no text null,
  director text null,
  address text null,
  email text null,
  phone text null,
  whatsapp text null,
  color text null,
  org_id uuid null,
  constraint companies_pkey primary key (id),
  constraint companies_org_id_fkey foreign key (org_id) references organisations(id)
) TABLESPACE pg_default;