
-- ===================================================
-- ReviewerIQ Module-Owned Persistence Schema
-- These tables store ReviewerIQ derived outputs only.
-- Upstream data is never mutated — only referenced by ID.
-- ===================================================

-- Enum types for ReviewerIQ
CREATE TYPE public.reviewer_case_status AS ENUM (
  'not_started', 'intake_review', 'treatment_review',
  'billing_review', 'provider_review', 'flagging', 'completed'
);

CREATE TYPE public.treatment_review_decision AS ENUM (
  'pending', 'reasonable', 'questionable', 'unreasonable', 'insufficient_info'
);

CREATE TYPE public.provider_normalization_status AS ENUM (
  'pending', 'matched', 'new_entity', 'needs_review', 'confirmed'
);

CREATE TYPE public.bill_linkage_status AS ENUM (
  'pending', 'linked', 'unlinked', 'disputed', 'confirmed'
);

CREATE TYPE public.medical_flag_category AS ENUM (
  'excessive_treatment', 'insufficient_documentation', 'coding_mismatch',
  'pre_existing_aggravation', 'causation_gap', 'guideline_deviation',
  'billing_anomaly', 'provider_concern', 'other'
);

CREATE TYPE public.medical_flag_severity AS ENUM (
  'info', 'warning', 'alert', 'critical'
);

CREATE TYPE public.medical_flag_status AS ENUM (
  'open', 'acknowledged', 'resolved', 'dismissed'
);

-- 1. ReviewerIQ case-level state
CREATE TABLE public.reviewer_case_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  review_status reviewer_case_status NOT NULL DEFAULT 'not_started',
  upstream_snapshot_version INTEGER,
  upstream_snapshot_id UUID REFERENCES public.module_completion_snapshots(id),
  total_treatments INTEGER NOT NULL DEFAULT 0,
  treatments_reviewed INTEGER NOT NULL DEFAULT 0,
  total_bills INTEGER NOT NULL DEFAULT 0,
  bills_reviewed INTEGER NOT NULL DEFAULT 0,
  total_providers INTEGER NOT NULL DEFAULT 0,
  providers_confirmed INTEGER NOT NULL DEFAULT 0,
  open_flags INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  started_by UUID,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, case_id)
);

-- 2. Treatment review records
CREATE TABLE public.reviewer_treatment_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  upstream_treatment_id UUID NOT NULL,
  upstream_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_decision treatment_review_decision NOT NULL DEFAULT 'pending',
  ai_reasoning TEXT NOT NULL DEFAULT '',
  ai_confidence NUMERIC,
  accepted_decision treatment_review_decision NOT NULL DEFAULT 'pending',
  accepted_reasoning TEXT NOT NULL DEFAULT '',
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  guideline_refs TEXT[] NOT NULL DEFAULT '{}',
  source_document_id UUID,
  source_page INTEGER,
  source_snippet TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, case_id, upstream_treatment_id)
);

-- 3. Provider review records
CREATE TABLE public.reviewer_provider_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  upstream_provider_id UUID NOT NULL,
  entity_cluster_id UUID REFERENCES public.entity_clusters(id),
  normalization_status provider_normalization_status NOT NULL DEFAULT 'pending',
  canonical_name TEXT,
  canonical_specialty TEXT,
  canonical_npi TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, case_id, upstream_provider_id)
);

-- 4. Bill-to-treatment linkage
CREATE TABLE public.reviewer_bill_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  upstream_bill_id UUID NOT NULL,
  upstream_treatment_id UUID,
  treatment_review_id UUID REFERENCES public.reviewer_treatment_reviews(id),
  linkage_status bill_linkage_status NOT NULL DEFAULT 'pending',
  ai_confidence NUMERIC,
  is_reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  billed_amount NUMERIC NOT NULL DEFAULT 0,
  assessed_reasonable_amount NUMERIC,
  reduction_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, case_id, upstream_bill_id)
);

-- 5. Medical review flags
CREATE TABLE public.reviewer_medical_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  category medical_flag_category NOT NULL DEFAULT 'other',
  severity medical_flag_severity NOT NULL DEFAULT 'info',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status medical_flag_status NOT NULL DEFAULT 'open',
  source_document_id UUID,
  source_page INTEGER,
  source_snippet TEXT NOT NULL DEFAULT '',
  related_entity_type TEXT,
  related_entity_id UUID,
  flagged_by TEXT NOT NULL DEFAULT 'ai',
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all ReviewerIQ tables
ALTER TABLE public.reviewer_case_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_treatment_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_provider_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_bill_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviewer_medical_flags ENABLE ROW LEVEL SECURITY;

-- RLS policies: tenant-scoped read + write for authenticated users
CREATE POLICY "read_tenant_reviewer_state" ON public.reviewer_case_state
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_reviewer_state" ON public.reviewer_case_state
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_reviewer_state" ON public.reviewer_case_state
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "read_tenant_treatment_reviews" ON public.reviewer_treatment_reviews
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_treatment_reviews" ON public.reviewer_treatment_reviews
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_treatment_reviews" ON public.reviewer_treatment_reviews
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "read_tenant_provider_reviews" ON public.reviewer_provider_reviews
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_provider_reviews" ON public.reviewer_provider_reviews
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_provider_reviews" ON public.reviewer_provider_reviews
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "read_tenant_bill_links" ON public.reviewer_bill_links
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_bill_links" ON public.reviewer_bill_links
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_bill_links" ON public.reviewer_bill_links
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "read_tenant_medical_flags" ON public.reviewer_medical_flags
  FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "insert_tenant_medical_flags" ON public.reviewer_medical_flags
  FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "update_tenant_medical_flags" ON public.reviewer_medical_flags
  FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- updated_at triggers
CREATE TRIGGER update_reviewer_case_state_updated_at
  BEFORE UPDATE ON public.reviewer_case_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviewer_treatment_reviews_updated_at
  BEFORE UPDATE ON public.reviewer_treatment_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviewer_provider_reviews_updated_at
  BEFORE UPDATE ON public.reviewer_provider_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviewer_bill_links_updated_at
  BEFORE UPDATE ON public.reviewer_bill_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_reviewer_medical_flags_updated_at
  BEFORE UPDATE ON public.reviewer_medical_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
