create table public.saas_config (
  key text not null,
  value text not null,
  updated_at timestamp with time zone null default now(),
  constraint saas_config_pkey primary key (key)
) TABLESPACE pg_default;