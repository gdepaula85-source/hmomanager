-- ============================================================
-- Migration: Add org_id to companies, property_docs, tenant_docs
--            and add data_url column to both doc tables
-- Run this in the Supabase SQL editor
-- ============================================================

-- 1. companies table
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE INDEX IF NOT EXISTS companies_org_id_idx ON public.companies(org_id);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage their companies" ON public.companies;
CREATE POLICY "Org members can manage their companies"
  ON public.companies
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );


-- 2. property_docs table
ALTER TABLE public.property_docs
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS data_url text;

CREATE INDEX IF NOT EXISTS property_docs_org_id_idx ON public.property_docs(org_id);

ALTER TABLE public.property_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage their property_docs" ON public.property_docs;
CREATE POLICY "Org members can manage their property_docs"
  ON public.property_docs
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );


-- 3. tenant_docs table
ALTER TABLE public.tenant_docs
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id),
  ADD COLUMN IF NOT EXISTS data_url text;

CREATE INDEX IF NOT EXISTS tenant_docs_org_id_idx ON public.tenant_docs(org_id);

ALTER TABLE public.tenant_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage their tenant_docs" ON public.tenant_docs;
CREATE POLICY "Org members can manage their tenant_docs"
  ON public.tenant_docs
  FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );
