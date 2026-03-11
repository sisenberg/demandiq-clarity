
-- ===================================================
-- CasualtyIQ Platform Schema Expansion
-- Adds core platform-wide tables for medical, billing,
-- liability, and module output data needed by future modules.
-- ===================================================

-- ─── Enums ──────────────────────────────────────────

CREATE TYPE public.party_role AS ENUM (
  'claimant', 'insured', 'defendant', 'witness',
  'employer', 'provider', 'expert', 'attorney', 'adjuster'
);

CREATE TYPE public.injury_severity AS ENUM (
  'minor', 'moderate', 'severe', 'catastrophic', 'fatal'
);

CREATE TYPE public.treatment_type AS ENUM (
  'emergency', 'inpatient', 'outpatient', 'surgery',
  'physical_therapy', 'chiropractic', 'diagnostic_imaging',
  'prescription', 'dme', 'mental_health', 'other'
);

CREATE TYPE public.bill_status AS ENUM (
  'submitted', 'under_review', 'approved', 'reduced',
  'denied', 'paid', 'appealed'
);

CREATE TYPE public.artifact_type AS ENUM (
  'demand_package', 'chronology_report', 'medical_summary',
  'valuation_report', 'settlement_memo', 'negotiation_letter',
  'litigation_brief'
);

-- ─── Parties (platform-wide) ───────────────────────

CREATE TABLE public.case_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  party_role party_role NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  organization TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_parties" ON public.case_parties
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_parties" ON public.case_parties
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_parties" ON public.case_parties
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Injuries ───────────────────────────────────────

CREATE TABLE public.injuries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  party_id UUID REFERENCES public.case_parties(id) ON DELETE SET NULL,
  body_part TEXT NOT NULL DEFAULT '',
  diagnosis_code TEXT NOT NULL DEFAULT '',
  diagnosis_description TEXT NOT NULL DEFAULT '',
  severity injury_severity NOT NULL DEFAULT 'moderate',
  date_of_onset DATE,
  is_pre_existing BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.injuries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_injuries" ON public.injuries
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_injuries" ON public.injuries
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_injuries" ON public.injuries
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Treatment Records ─────────────────────────────

CREATE TABLE public.treatment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  injury_id UUID REFERENCES public.injuries(id) ON DELETE SET NULL,
  provider_party_id UUID REFERENCES public.case_parties(id) ON DELETE SET NULL,
  treatment_type treatment_type NOT NULL DEFAULT 'other',
  treatment_date DATE,
  treatment_end_date DATE,
  facility_name TEXT NOT NULL DEFAULT '',
  provider_name TEXT NOT NULL DEFAULT '',
  procedure_codes TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  source_page INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_treatments" ON public.treatment_records
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_treatments" ON public.treatment_records
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_treatments" ON public.treatment_records
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Bills ──────────────────────────────────────────

CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatment_records(id) ON DELETE SET NULL,
  provider_party_id UUID REFERENCES public.case_parties(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  bill_date DATE,
  billed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  adjusted_amount NUMERIC(12, 2),
  paid_amount NUMERIC(12, 2),
  bill_status bill_status NOT NULL DEFAULT 'submitted',
  cpt_codes TEXT[] NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_bills" ON public.bills
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_bills" ON public.bills
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_bills" ON public.bills
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Policies (insurance policies) ─────────────────

CREATE TABLE public.insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  policy_number TEXT NOT NULL DEFAULT '',
  carrier_name TEXT NOT NULL DEFAULT '',
  policy_type TEXT NOT NULL DEFAULT '',
  coverage_limit NUMERIC(12, 2),
  deductible NUMERIC(12, 2),
  effective_date DATE,
  expiration_date DATE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_policies" ON public.insurance_policies
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_policies" ON public.insurance_policies
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_policies" ON public.insurance_policies
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Liability Facts ────────────────────────────────

CREATE TABLE public.liability_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  fact_text TEXT NOT NULL DEFAULT '',
  supports_liability BOOLEAN NOT NULL DEFAULT true,
  source_document_id UUID REFERENCES public.case_documents(id) ON DELETE SET NULL,
  source_page INT,
  confidence_score NUMERIC(3, 2),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.liability_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_liability_facts" ON public.liability_facts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_liability_facts" ON public.liability_facts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_liability_facts" ON public.liability_facts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Generated Artifacts (module outputs) ───────────

CREATE TABLE public.generated_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL DEFAULT 'demandiq',
  artifact_type artifact_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  version INT NOT NULL DEFAULT 1,
  content_json JSONB NOT NULL DEFAULT '{}',
  storage_path TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_artifacts" ON public.generated_artifacts
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_artifacts" ON public.generated_artifacts
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "update_tenant_artifacts" ON public.generated_artifacts
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

-- ─── Updated_at triggers ────────────────────────────

CREATE TRIGGER trg_case_parties_updated_at BEFORE UPDATE ON public.case_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_injuries_updated_at BEFORE UPDATE ON public.injuries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_treatment_records_updated_at BEFORE UPDATE ON public.treatment_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_bills_updated_at BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_insurance_policies_updated_at BEFORE UPDATE ON public.insurance_policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_liability_facts_updated_at BEFORE UPDATE ON public.liability_facts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_generated_artifacts_updated_at BEFORE UPDATE ON public.generated_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
