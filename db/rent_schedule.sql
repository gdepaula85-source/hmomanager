create table public.rent_schedule (
  id uuid not null default extensions.uuid_generate_v4 (),
  tenant_id uuid null,
  tenant_name text null,
  property_name text null,
  room_number integer null,
  amount numeric(10, 2) null,
  due_date date not null,
  method text null default 'bank'::text,
  status text null default 'upcoming'::text,
  paid_date date null,
  freq text null,
  created_at timestamp with time zone null default now(),
  constraint rent_schedule_pkey primary key (id),
  constraint rent_schedule_tenant_id_fkey foreign KEY (tenant_id) references tenants (id) on delete CASCADE
) TABLESPACE pg_default;

create index IF not exists idx_rent_schedule_due on public.rent_schedule using btree (due_date) TABLESPACE pg_default;