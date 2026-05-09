-- clients.sql
-- Business / individual clients that can hold MULTIPLE tenancies.
-- A "client" is the entity that signed up (e.g. a rent-to-rent company); each
-- tenancy in public.tenants represents one property occupancy and links back
-- to its parent client via tenants.client_id. Per-property rent / contract /
-- signing flows continue to operate on the tenancy row, unchanged.
--
-- Run on test (piufcteaqmxemidfdoim) and prod (kzumoubhxdoqqcucdact).

create table if not exists public.clients (
  id              uuid primary key default extensions.uuid_generate_v4(),
  org_id          uuid not null references public.organisations (id) on delete cascade,
  name            text not null,
  type            text not null default 'business',           -- 'business' | 'individual'
  company_no      text null,
  contact_person  text null,
  email           text null,
  phone           text null,
  whatsapp        text null,
  address         text null,
  notes           text null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_clients_org on public.clients (org_id);
create index if not exists idx_clients_name on public.clients (lower(name));

alter table public.tenants
  add column if not exists client_id uuid null references public.clients (id) on delete set null;

create index if not exists idx_tenants_client on public.tenants (client_id);

-- ── RLS ───────────────────────────────────────────────────────────────────
-- Mirrors the org_isolation pattern from phase1_rls_all_tables.sql so the
-- dashboard's authenticated requests can read/write only their own org's
-- clients (membership lookup via public.org_members → user_id = auth.uid()).
alter table public.clients enable row level security;
drop policy if exists "org_isolation_clients" on public.clients;
create policy "org_isolation_clients" on public.clients
  for all to authenticated
  using      (org_id in (select org_id from public.org_members where user_id = auth.uid()))
  with check (org_id in (select org_id from public.org_members where user_id = auth.uid()));

-- Reload PostgREST schema cache so the new table + column are visible to the API.
notify pgrst, 'reload schema';
