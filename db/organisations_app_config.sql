-- Migration: Add app_config column to organisations table
-- This stores branding config (logo, portfolio name, site title) and custom role
-- permissions server-side so they persist across devices and browser clears.
-- Run this in the Supabase SQL editor.

ALTER TABLE public.organisations
  ADD COLUMN IF NOT EXISTS app_config jsonb NULL DEFAULT '{}'::jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.organisations.app_config IS
  'Stores org-level app configuration: branding (logo, portfolio name), custom role permissions. Replaces localStorage pm_local_config and pm_local_roles for cross-device persistence.';
