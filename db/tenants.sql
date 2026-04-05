create table public.tenants (
  id uuid not null default extensions.uuid_generate_v4 (),
  name text not null,
  property_id uuid null,
  property_name text null,
  room_number integer null,
  room_type text null,
  rent numeric(10, 2) null,
  freq text null default 'weekly'::text,
  pay_day text null default 'Monday'::text,
  pay_day_of_month integer null,
  method text null default 'bank'::text,
  status text null default 'active'::text,
  arrears numeric(10, 2) null default 0,
  deposit numeric(10, 2) null,
  deposit_status text null default 'held'::text,
  whatsapp text null,
  email text null,
  move_in date null,
  start_date date null,
  notice_date date null,
  move_out_date date null,
  created_at timestamp with time zone null default now(),
  payment_history jsonb null default '[]'::jsonb,
  notes text null,
  portal_username text null,
  portal_password text null,
  previous_tenancies jsonb null default '[]'::jsonb,
  org_id uuid null,
  constraint tenants_pkey primary key (id),
  constraint tenants_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint tenants_property_id_fkey foreign KEY (property_id) references properties (id)
) TABLESPACE pg_default;

create index IF not exists idx_tenants_property on public.tenants using btree (property_name) TABLESPACE pg_default;

create index IF not exists idx_tenants_status on public.tenants using btree (status) TABLESPACE pg_default;