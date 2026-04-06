-- Org-scoped email preferences (replaces browser localStorage for triggers / manager email).
alter table public.organisations
  add column if not exists email_settings jsonb default '{}'::jsonb;

comment on column public.organisations.email_settings is 'JSON: { triggers: { rent_reminder_3day: bool, ... }, managerEmail: string }';
