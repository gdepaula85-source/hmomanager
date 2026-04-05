create table public.landlord_payments (
  id uuid not null default extensions.uuid_generate_v4 (),
  landlord_id uuid null,
  landlord_name text null,
  property_id uuid null,
  property_name text null,
  month_key text null,
  month_label text null,
  amount numeric(10, 2) null,
  due_date date null,
  paid_date date null,
  status text null default 'pending'::text,
  method text null default 'bank'::text,
  ref text null,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint landlord_payments_pkey primary key (id),
  constraint landlord_payments_property_id_month_key_key unique (property_id, month_key),
  constraint landlord_payments_landlord_id_fkey foreign KEY (landlord_id) references landlords (id),
  constraint landlord_payments_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint landlord_payments_property_id_fkey foreign KEY (property_id) references properties (id)
) TABLESPACE pg_default;

create index IF not exists idx_landlord_payments_month on public.landlord_payments using btree (month_key) TABLESPACE pg_default;