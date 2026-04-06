-- plan_limit_enforcement.sql
-- Enforces plan-based caps at database level so limits cannot be bypassed by client code.
--
-- Covered tables:
-- - properties   (property cap)
-- - tenants      (tenant cap)
-- - org_members  (seat/user cap)
--
-- Plan caps (must match dashboard _dmPlanCaps / _dmResolveOrgBillingStatus):
-- free         -> 3 properties, 15 tenants, 2 users
-- starter      -> 15 properties, 75 tenants, 3 users
-- professional -> 25 properties, unlimited tenants, 5 users
-- business     -> 60 properties, unlimited tenants, 15 users
-- trial        -> 5 properties, 30 tenants, 3 users (legacy compatibility)
--
-- Effective plan: when plan is free but org is still in trial window, use trial caps
-- (same as client: status=trial or empty status + trial_ends_at > now() with plan=free).

begin;

create or replace function public._plan_caps(_plan text)
returns table (max_properties integer, max_tenants integer, max_users integer)
language sql
stable
as $$
  select
    case lower(coalesce(_plan, 'free'))
      when 'free' then 3
      when 'starter' then 15
      when 'professional' then 25
      when 'business' then 60
      when 'trial' then 5
      else 3
    end as max_properties,
    case lower(coalesce(_plan, 'free'))
      when 'free' then 15
      when 'starter' then 75
      when 'professional' then 2147483647
      when 'business' then 2147483647
      when 'trial' then 30
      else 15
    end as max_tenants,
    case lower(coalesce(_plan, 'free'))
      when 'free' then 2
      when 'starter' then 3
      when 'professional' then 5
      when 'business' then 15
      when 'trial' then 3
      else 2
    end as max_users
$$;

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_plan text;
  v_status text;
  v_trial_ends timestamptz;
  v_resolved_status text;
  v_effective_plan text;
  v_cap_properties integer;
  v_cap_tenants integer;
  v_cap_users integer;
  v_count integer;
begin
  v_org_id := coalesce(new.org_id, old.org_id);
  if v_org_id is null then
    return new;
  end if;

  select plan, status, trial_ends_at
  into v_plan, v_status, v_trial_ends
  from public.organisations
  where id = v_org_id;

  if not found then
    return new;
  end if;

  -- Hard stop on inactive organisations.
  if coalesce(v_status, 'active') in ('paused', 'cancelled') then
    raise exception 'Organisation is % and cannot be modified.', v_status
      using errcode = 'P0001';
  end if;

  -- Mirror dashboard: empty plan -> free; free + in-trial window -> trial caps (5 properties, etc.).
  v_effective_plan := lower(coalesce(nullif(trim(coalesce(v_plan, '')), ''), 'free'));
  v_resolved_status := nullif(trim(lower(coalesce(v_status, ''))), '');
  if v_resolved_status is null then
    if v_trial_ends is not null and v_trial_ends > now() then
      v_resolved_status := 'trial';
    else
      v_resolved_status := 'active';
    end if;
  end if;
  if v_effective_plan = 'free' and v_resolved_status = 'trial' then
    v_effective_plan := 'trial';
  end if;

  select max_properties, max_tenants, max_users
  into v_cap_properties, v_cap_tenants, v_cap_users
  from public._plan_caps(v_effective_plan);

  if tg_table_name = 'properties' then
    -- Archived properties do not count toward the cap (same as dashboard filters).
    select count(*)
    into v_count
    from public.properties p
    where p.org_id = v_org_id
      and coalesce(p.status, 'active') <> 'archived'
      and (tg_op <> 'UPDATE' or p.id <> old.id);

    if v_count >= v_cap_properties then
      raise exception 'Plan limit reached: max % properties for plan %.', v_cap_properties, coalesce(v_effective_plan, 'free')
        using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'tenants' then
    -- Only count active/non-inactive tenants toward caps.
    if coalesce(new.status, 'active') <> 'inactive' then
      select count(*)
      into v_count
      from public.tenants t
      where t.org_id = v_org_id
        and coalesce(t.status, 'active') <> 'inactive'
        and (tg_op <> 'UPDATE' or t.id <> old.id);

      if v_count >= v_cap_tenants then
        raise exception 'Plan limit reached: max % active tenants for plan %.', v_cap_tenants, coalesce(v_effective_plan, 'free')
          using errcode = 'P0001';
      end if;
    end if;
  elsif tg_table_name = 'org_members' then
    select count(*)
    into v_count
    from public.org_members om
    where om.org_id = v_org_id
      and (tg_op <> 'UPDATE' or om.id <> old.id);

    if v_count >= v_cap_users then
      raise exception 'Plan limit reached: max % users for plan %.', v_cap_users, coalesce(v_effective_plan, 'free')
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_plan_limits_properties on public.properties;
create trigger trg_enforce_plan_limits_properties
before insert or update of org_id on public.properties
for each row
execute function public.enforce_plan_limits();

drop trigger if exists trg_enforce_plan_limits_tenants on public.tenants;
create trigger trg_enforce_plan_limits_tenants
before insert or update of org_id, status on public.tenants
for each row
execute function public.enforce_plan_limits();

drop trigger if exists trg_enforce_plan_limits_org_members on public.org_members;
create trigger trg_enforce_plan_limits_org_members
before insert or update of org_id on public.org_members
for each row
execute function public.enforce_plan_limits();

commit;

