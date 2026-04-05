create table public.expenses (
  id uuid not null default extensions.uuid_generate_v4 (),
  category text null,
  description text not null,
  amount numeric(10, 2) null,
  type text null,
  status text null default 'estimated'::text,
  freq text null default 'one-off'::text,
  recurring boolean null default false,
  start_date date null,
  property_id uuid null,
  property_name text null,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint expenses_pkey primary key (id),
  constraint expenses_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint expenses_property_id_fkey foreign KEY (property_id) references properties (id)
) TABLESPACE pg_default;