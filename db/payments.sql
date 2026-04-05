create table public.payments (
  id uuid not null default extensions.uuid_generate_v4 (),
  tenant_id uuid null,
  tenant_name text null,
  property_name text null,
  amount numeric(10, 2) null,
  method text null default 'bank'::text,
  status text null default 'paid'::text,
  due_date date null,
  paid_date date null,
  is_partial boolean null default false,
  shortfall numeric(10, 2) null default 0,
  notes text null,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint payments_pkey primary key (id),
  constraint payments_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint payments_tenant_id_fkey foreign KEY (tenant_id) references tenants (id)
) TABLESPACE pg_default;

create index IF not exists idx_payments_tenant on public.payments using btree (tenant_id) TABLESPACE pg_default;

create index IF not exists idx_payments_date on public.payments using btree (due_date) TABLESPACE pg_default;