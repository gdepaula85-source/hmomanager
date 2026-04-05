create table public.contractors (
  id text not null,
  name text not null,
  trade text null default 'General'::text,
  phone text null default ''::text,
  whatsapp text null default ''::text,
  email text null default ''::text,
  notes text null default ''::text,
  rating integer null,
  last_used date null,
  call_out_charge numeric(10, 2) null default 0,
  created_at timestamp with time zone null default now(),
  org_id uuid null,
  constraint contractors_pkey primary key (id),
  constraint contractors_org_id_fkey foreign KEY (org_id) references organisations (id),
  constraint contractors_rating_check check (
    (
      (rating >= 1)
      and (rating <= 5)
    )
  )
) TABLESPACE pg_default;