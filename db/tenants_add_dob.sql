-- Add date-of-birth column to tenants table
-- Safe to run multiple times (IF NOT EXISTS)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS dob DATE DEFAULT NULL;
