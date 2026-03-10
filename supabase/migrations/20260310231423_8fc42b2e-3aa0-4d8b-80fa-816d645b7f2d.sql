
-- Enum for document type tags
CREATE TYPE public.document_type AS ENUM (
  'medical_record', 'police_report', 'legal_filing', 'correspondence',
  'billing_record', 'imaging_report', 'insurance_document', 'employment_record',
  'expert_report', 'photograph', 'other'
);

-- Enum for case priority
CREATE TYPE public.case_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- Enum for case status
CREATE TYPE public.case_status AS ENUM (
  'draft', 'intake_in_progress', 'intake_complete',
  'processing_in_progress', 'complete', 'exported', 'closed', 'failed'
);

-- Enum for document processing status
CREATE TYPE public.document_status AS ENUM (
  'uploaded', 'queued', 'ocr_in_progress', 'classified',
  'extracted', 'needs_attention', 'complete', 'failed'
);

-- Enum for processing pipeline stage
CREATE TYPE public.pipeline_stage AS ENUM (
  'upload_received', 'ocr_queued', 'ocr_complete',
  'document_classified', 'extraction_complete',
  'evidence_links_created', 'review_items_generated'
);

-- Enum for job status
CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'completed', 'failed');

-- Enum for job type
CREATE TYPE public.job_type AS ENUM (
  'document_extraction', 'chronology_generation', 'issue_flagging', 'package_export', 'ocr', 'classification'
);

-- Cases table
CREATE TABLE public.cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  case_number TEXT NOT NULL DEFAULT '',
  claim_number TEXT NOT NULL DEFAULT '',
  external_reference TEXT NOT NULL DEFAULT '',
  claimant TEXT NOT NULL DEFAULT '',
  insured TEXT NOT NULL DEFAULT '',
  defendant TEXT NOT NULL DEFAULT '',
  jurisdiction_state TEXT NOT NULL DEFAULT '',
  priority public.case_priority NOT NULL DEFAULT 'normal',
  case_status public.case_status NOT NULL DEFAULT 'draft',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  date_of_loss DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- Cases RLS: tenant-scoped read
CREATE POLICY "read_tenant_cases" ON public.cases
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Cases RLS: create if permitted (adjuster, manager, admin)
CREATE POLICY "insert_tenant_cases" ON public.cases
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND created_by = auth.uid()
  );

-- Cases RLS: update own tenant cases
CREATE POLICY "update_tenant_cases" ON public.cases
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Case documents table
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/pdf',
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT,
  page_count INT,
  document_status public.document_status NOT NULL DEFAULT 'uploaded',
  document_type public.document_type NOT NULL DEFAULT 'other',
  pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'upload_received',
  extracted_text TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_documents" ON public.case_documents
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_documents" ON public.case_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.get_user_tenant_id(auth.uid())
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "update_tenant_documents" ON public.case_documents
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Jobs table
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  job_type public.job_type NOT NULL,
  job_status public.job_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_jobs" ON public.jobs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_jobs" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_jobs" ON public.jobs
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Document storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('case-documents', 'case-documents', false);

-- Storage policies for case-documents bucket
CREATE POLICY "tenant_upload_documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents');

CREATE POLICY "tenant_read_documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents');

-- Auto-generate case number function
CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seq INT;
BEGIN
  SELECT COUNT(*) + 1 INTO _seq FROM public.cases WHERE tenant_id = NEW.tenant_id;
  NEW.case_number := 'CF-' || to_char(now(), 'YYYY') || '-' || lpad(_seq::text, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_case_number
  BEFORE INSERT ON public.cases
  FOR EACH ROW
  WHEN (NEW.case_number = '' OR NEW.case_number IS NULL)
  EXECUTE FUNCTION public.generate_case_number();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cases_updated_at BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON public.case_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
