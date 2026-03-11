
-- ============================================================
-- INTAKE PIPELINE SCHEMA: enums, tables, RLS, triggers, storage
-- ============================================================

-- 1. New enums
CREATE TYPE public.intake_status AS ENUM (
  'uploaded',
  'queued_for_text_extraction',
  'extracting_text',
  'text_extracted',
  'queued_for_parsing',
  'parsing',
  'parsed',
  'needs_review',
  'failed'
);

CREATE TYPE public.intake_job_type AS ENUM (
  'text_extraction',
  'document_parsing',
  'fact_extraction',
  'duplicate_detection'
);

CREATE TYPE public.intake_job_status AS ENUM (
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled'
);

CREATE TYPE public.fact_type AS ENUM (
  'medical_diagnosis',
  'treatment',
  'medication',
  'date_of_event',
  'injury_description',
  'provider_info',
  'billing_amount',
  'liability_statement',
  'witness_statement',
  'policy_detail',
  'employment_info',
  'other'
);

CREATE TYPE public.duplicate_flag_status AS ENUM (
  'flagged',
  'dismissed',
  'confirmed'
);

-- 2. Add intake_status column to existing case_documents
ALTER TABLE public.case_documents
  ADD COLUMN intake_status public.intake_status NOT NULL DEFAULT 'uploaded';

-- 3. document_pages
CREATE TABLE public.document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  extracted_text text,
  confidence_score numeric,
  image_storage_path text,
  width_px integer,
  height_px integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, page_number)
);

ALTER TABLE public.document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_pages" ON public.document_pages
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_pages" ON public.document_pages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_pages" ON public.document_pages
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 4. intake_jobs
CREATE TABLE public.intake_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid REFERENCES public.case_documents(id) ON DELETE CASCADE,
  job_type public.intake_job_type NOT NULL,
  status public.intake_job_status NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_intake_jobs" ON public.intake_jobs
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_intake_jobs" ON public.intake_jobs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_intake_jobs" ON public.intake_jobs
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE TRIGGER set_intake_jobs_updated_at
  BEFORE UPDATE ON public.intake_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. extracted_facts
CREATE TABLE public.extracted_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.document_pages(id) ON DELETE SET NULL,
  page_number integer,
  fact_type public.fact_type NOT NULL DEFAULT 'other',
  fact_text text NOT NULL DEFAULT '',
  structured_data jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric,
  source_snippet text NOT NULL DEFAULT '',
  source_anchor text,
  needs_review boolean NOT NULL DEFAULT false,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.extracted_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_facts" ON public.extracted_facts
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_facts" ON public.extracted_facts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_facts" ON public.extracted_facts
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE TRIGGER set_extracted_facts_updated_at
  BEFORE UPDATE ON public.extracted_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. fact_evidence_links
CREATE TABLE public.fact_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  fact_id uuid NOT NULL REFERENCES public.extracted_facts(id) ON DELETE CASCADE,
  linked_entity_type text NOT NULL,
  linked_entity_id uuid NOT NULL,
  relevance_type text NOT NULL DEFAULT 'direct',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fact_evidence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_evidence_links" ON public.fact_evidence_links
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_evidence_links" ON public.fact_evidence_links
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_evidence_links" ON public.fact_evidence_links
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 7. duplicate_document_flags
CREATE TABLE public.duplicate_document_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  duplicate_of_document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  similarity_score numeric NOT NULL DEFAULT 0,
  flag_status public.duplicate_flag_status NOT NULL DEFAULT 'flagged',
  flagged_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.duplicate_document_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_dup_flags" ON public.duplicate_document_flags
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_dup_flags" ON public.duplicate_document_flags
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_dup_flags" ON public.duplicate_document_flags
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- 8. Storage bucket for derived artifacts (page images, OCR output, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('derived-artifacts', 'derived-artifacts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS for derived-artifacts
CREATE POLICY "tenant_upload_derived" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'derived-artifacts'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
  );

CREATE POLICY "tenant_read_derived" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'derived-artifacts'
    AND (storage.foldername(name))[1] = get_user_tenant_id(auth.uid())::text
  );
