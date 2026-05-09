-- organisations_plan_free_migration.sql
-- Purpose:
-- 1) Update organisations schema defaults for free-first onboarding.
-- 2) Backfill existing records to the expected status/plan model.

begin;

-- Schema defaults for new rows
alter table public.organisations
  alter column plan set default 'free',
  alter column status set default 'active',
  alter column trial_ends_at drop default;

-- Normalize existing records:
-- A) Keep paid plans as-is.
-- B) Trial rows with expired trial move to free-active.
-- C) Legacy rows with null/empty plan become free-active.
update public.organisations
set
  plan = 'free',
  status = 'active',
  trial_ends_at = null,
  stripe_subscription_id = null,
  mrr = 0,
  updated_at = now()
where
  (
    plan is null
    or btrim(plan) = ''
    or (status = 'trial' and trial_ends_at is not null and trial_ends_at < now())
  )
  and coalesce(plan, '') not in ('starter', 'professional', 'business');

-- D) Ensure explicitly free plan rows are active and not trial-timed.
update public.organisations
set
  status = 'active',
  trial_ends_at = null,
  stripe_subscription_id = null,
  mrr = 0,
  updated_at = now()
where plan = 'free';

commit;

