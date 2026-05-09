-- plan_caps_add_enterprise.sql
-- Adds Enterprise tier to the DB-side plan-cap function. Enterprise is unlimited
-- on properties, tenants, and users (fully self-serve paid plan above Business).
--
-- Also falls back to UNLIMITED for any unknown plan key so custom plans added
-- via superadmin don't get hard-capped at 3 by the default branch. If you want
-- stricter caps per custom plan, wire them through by editing this function.
--
-- Run on piufcteaqmxemidfdoim.

begin;

create or replace function public._plan_caps(_plan text)
returns table (max_properties integer, max_tenants integer, max_users integer)
language sql
stable
as $$
  with p as (select lower(coalesce(_plan, 'free')) as k)
  select
    case (select k from p)
      when 'free'         then 3
      when 'starter'      then 15
      when 'professional' then 25
      when 'business'     then 60
      when 'enterprise'   then 2147483647
      when 'trial'        then 5
      -- Unknown plan key (e.g. custom plan added via superadmin) → unlimited
      -- so it doesn't get mis-capped by the 'else 3' fallback. Tighten if needed.
      else 2147483647
    end as max_properties,
    case (select k from p)
      when 'free'         then 15
      when 'starter'      then 75
      when 'professional' then 2147483647
      when 'business'     then 2147483647
      when 'enterprise'   then 2147483647
      when 'trial'        then 30
      else 2147483647
    end as max_tenants,
    case (select k from p)
      when 'free'         then 2
      when 'starter'      then 3
      when 'professional' then 5
      when 'business'     then 15
      when 'enterprise'   then 2147483647
      when 'trial'        then 3
      else 2147483647
    end as max_users
$$;

commit;

notify pgrst, 'reload schema';
