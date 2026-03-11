
-- ===================================================
-- ReviewerIQ Treatment Records — extracted medical visit data
-- Module-owned by ReviewerIQ; upstream data referenced by ID only.
-- ===================================================

-- Visit type enum
CREATE TYPE public.reviewer_visit_type AS ENUM (
  'emergency', 'ems', 'inpatient', 'outpatient', 'surgery',
  'physical_therapy', 'chiropractic', 'pain_management',
  'radiology', 'primary_care', 'specialist', 'mental_health',
  'operative', 'follow_up', 'ime', 'other'
);

-- Extraction review state
CREATE TYPE public.extraction_review_state AS ENUM (
  'draft', 'needs_review', 'accepted', 'corrected', 'rejected'
);

-- Confidence tier for quick filtering
CREATE TYPE public.extraction_confidence_tier AS ENUM (
  'high', 'medium', 'low', 'unknown'
);

-- Treatment records extracted from medical documents
CREATE TABLE public.reviewer_treatment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,

  -- Source provenance
  source_document_id UUID REFERENCES public.case_documents(id),
  source_page_start INTEGER,
  source_page_end INTEGER,
  source_snippet TEXT NOT NULL DEFAULT '',
  extraction_model TEXT NOT NULL DEFAULT '',
  extraction_version TEXT NOT NULL DEFAULT '1.0.0',
  extracted_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Visit identification
  visit_type reviewer_visit_type NOT NULL DEFAULT 'other',
  visit_date DATE,
  visit_date_text TEXT NOT NULL DEFAULT '',
  service_date_start DATE,
  service_date_end DATE,
  is_date_ambiguous BOOLEAN NOT NULL DEFAULT false,

  -- Provider / facility
  provider_name_raw TEXT NOT NULL DEFAULT '',
  provider_name_normalized TEXT,
  upstream_provider_id UUID,
  facility_name TEXT NOT NULL DEFAULT '',
  provider_specialty TEXT NOT NULL DEFAULT '',
  provider_npi TEXT,

  -- Clinical content (SOAP-style)
  subjective_summary TEXT NOT NULL DEFAULT '',
  objective_findings TEXT NOT NULL DEFAULT '',
  assessment_summary TEXT NOT NULL DEFAULT '',
  plan_summary TEXT NOT NULL DEFAULT '',

  -- Structured clinical data
  diagnoses JSONB NOT NULL DEFAULT '[]'::jsonb,
  procedures JSONB NOT NULL DEFAULT '[]'::jsonb,
  medications JSONB NOT NULL DEFAULT '[]'::jsonb,
  body_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  follow_up_recommendations TEXT NOT NULL DEFAULT '',

  -- Injury linkage
  upstream_injury_ids UUID[] NOT NULL DEFAULT '{}',

  -- Bill linkage
  upstream_bill_ids UUID[] NOT NULL DEFAULT '{}',
  total_billed NUMERIC,
  total_paid NUMERIC,

  -- Extraction confidence
  overall_confidence NUMERIC,
  confidence_tier extraction_confidence_tier NOT NULL DEFAULT 'unknown',
  confidence_details JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Review state
  review_state extraction_review_state NOT NULL DEFAULT 'draft',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT NOT NULL DEFAULT '',

  -- Duplicate detection
  is_duplicate_suspect BOOLEAN NOT NULL DEFAULT false,
  duplicate_of_record_id UUID REFERENCES public.reviewer_treatment_records(id),
  duplicate_similarity NUMERIC,
  duplicate_reason TEXT NOT NULL DEFAULT '',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extraction job tracking for treatment extraction pipeline
CREATE TABLE public.reviewer_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.case_documents(id),
  status TEXT NOT NULL DEFAULT 'queued',
  extraction_model TEXT NOT NULL DEFAULT '',
  records_extracted INTEGER NOT NULL DEFAULT 0,
  duplicates_flagged INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_reviewer_treatment_records_case ON public.reviewer_treatment_records(case_id);
CREATE INDEX idx_reviewer_treatment_records_document ON public.reviewer_treatment_records(source_document_id);
CREATE INDEX idx_reviewer_treatment_records_review ON public.reviewer_treatment_records(review_state);
CREATE INDEX idx_reviewer_treatment_records_duplicate ON public.reviewer_treatment_records(is_duplicate_suspect) WHERE is_duplicate_suspect = true;
CREATE INDEX idx_reviewer_extraction_jobs_case ON public.reviewer_extraction_jobs(case_id);

-- RLS
ALTER TABLE public.reviewer_treatment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_treatment_records" ON public.reviewer_treatment_records
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_treatment_records" ON public.reviewer_treatment_records
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_treatment_records" ON public.reviewer_treatment_records
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "read_tenant_extraction_jobs" ON public.reviewer_extraction_jobs
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_extraction_jobs" ON public.reviewer_extraction_jobs
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_extraction_jobs" ON public.reviewer_extraction_jobs
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER update_reviewer_treatment_records_updated_at
  BEFORE UPDATE ON public.reviewer_treatment_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviewer_extraction_jobs_updated_at
  BEFORE UPDATE ON public.reviewer_extraction_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
