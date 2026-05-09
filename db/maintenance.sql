create table public.maintenance (
  id uuid not null default extensions.uuid_generate_v4 (),
  property_id uuid null,
  property_name text null,
  room_number integer null,
  location text null,
  tenant_name text null,
  issue text not null,
  category text null,
  priority text null default 'medium'::text,
  status text null default 'open'::text,
  notes text null,
  photo_url text null,
  logged_date date null default CURRENT_DATE,
  resolved_date date null,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  contractor text null,
  job_cost numeric null,
  invoice_name text null,
  invoice_url text null,
  constraint maintenance_pkey primary key (id),
  constraint maintenance_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint maintenance_property_id_fkey foreign KEY (property_id) references properties (id)
) TABLESPACE pg_default;

create index IF not exists idx_maintenance_status on public.maintenance using btree (status) TABLESPACE pg_default;