create table public.organisations (
  id uuid not null default gen_random_uuid (),
  name text not null,
  slug text null,
  owner_email text null,
  phone text null default ''::text,
  plan text null default 'trial'::text,
  plan_seats integer null default 3,
  status text null default 'trial'::text,
  trial_ends_at timestamp with time zone null default (now() + '14 days'::interval),
  billing_email text null,
  stripe_customer_id text null,
  stripe_subscription_id text null,
  mrr numeric(10, 2) null default 0,
  email_settings jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint organisations_pkey primary key (id),
  constraint organisations_slug_key unique (slug)
) TABLESPACE pg_default;

create trigger organisations_updated_at BEFORE
update on organisations for EACH row
execute FUNCTION update_updated_at ();