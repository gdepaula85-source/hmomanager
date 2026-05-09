-- plan_limit_respect_billing_override.sql
-- Patches enforce_plan_limits() so orgs with billing_override='free' (FREE GRANT / partner)
-- bypass plan caps entirely — matches the client-side _dmPlanCaps behaviour.
--
-- Apply after plan_limit_enforcement.sql.

begin;

create or replace function public.enforce_plan_limits()
returns trigger
language plpgsql
as $$
declare
  v_org_id uuid;
  v_plan text;
  v_status text;
  v_trial_ends timestamptz;
  v_override text;
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

  select plan, status, trial_ends_at, billing_override
  into v_plan, v_status, v_trial_ends, v_override
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

  -- Admin-granted free access → unlimited everything (partner orgs / FREE GRANT).
  if lower(coalesce(v_override, '')) = 'free' then
    return new;
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

commit;
