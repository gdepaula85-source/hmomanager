create table public.companies (
  id text not null,
  name text null,
  company_no text null,
  vat_no text null,
  director text null,
  address text null,
  email text null,
  phone text null,
  color text null,
  constraint companies_pkey primary key (id)
) TABLESPACE pg_default;