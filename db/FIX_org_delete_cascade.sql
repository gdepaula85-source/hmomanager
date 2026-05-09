-- FIX_org_delete_cascade.sql
-- Makes every FK that points at organisations(id) cascade on delete, so deleting
-- an org from the superadmin panel also removes all its data. Without this,
-- Postgres rejects the delete with a 23503 FK-violation error.
--
-- Iterates every FK in the public schema that references public.organisations(id)
-- and recreates it with ON DELETE CASCADE.
--
-- SAFE TO RE-RUN.

do $$
declare
  r record;
  new_name text;
  col_name text;
begin
  for r in
    select
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema    = tc.table_schema
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
     and rc.constraint_schema = tc.constraint_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = rc.unique_constraint_name
     and ccu.constraint_schema = rc.unique_constraint_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and ccu.table_schema = 'public'
      and ccu.table_name   = 'organisations'
      and ccu.column_name  = 'id'
  loop
    col_name := r.column_name;
    new_name := r.table_name || '_' || col_name || '_fkey';

    raise notice 'Rewriting FK %.%  →  ON DELETE CASCADE', r.table_name, r.constraint_name;

    execute format('alter table public.%I drop constraint %I', r.table_name, r.constraint_name);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.organisations(id) on delete cascade',
      r.table_name, new_name, col_name
    );
  end loop;
end $$;

notify pgrst, 'reload schema';

-- Sanity check — list the FKs now to confirm all say CASCADE:
-- select
--   tc.table_name,
--   kcu.column_name,
--   rc.delete_rule
-- from information_schema.table_constraints tc
-- join information_schema.key_column_usage kcu
--   on kcu.constraint_name = tc.constraint_name
-- join information_schema.referential_constraints rc
--   on rc.constraint_name = tc.constraint_name
-- join information_schema.constraint_column_usage ccu
--   on ccu.constraint_name = rc.unique_constraint_name
-- where tc.constraint_type = 'FOREIGN KEY'
--   and tc.table_schema = 'public'
--   and ccu.table_name = 'organisations'
-- order by tc.table_name;
