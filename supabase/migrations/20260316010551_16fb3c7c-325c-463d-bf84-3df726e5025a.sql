
-- Injury records: structured injury/diagnosis facts linked to demands
CREATE TABLE public.injury_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  linked_demand_id uuid REFERENCES public.demands(id),
  source_document_id uuid REFERENCES public.case_documents(id),
  injury_description text NOT NULL DEFAULT '',
  body_part text NOT NULL DEFAULT '',
  icd_codes text[] NOT NULL DEFAULT '{}',
  diagnosis_description text NOT NULL DEFAULT '',
  imaging_references text NOT NULL DEFAULT '',
  surgery_mentions text NOT NULL DEFAULT '',
  injections_or_procedures text NOT NULL DEFAULT '',
  therapy_mentions text NOT NULL DEFAULT '',
  residual_symptom_language text NOT NULL DEFAULT '',
  work_restrictions text NOT NULL DEFAULT '',
  functional_limitations text NOT NULL DEFAULT '',
  objective_support_flag boolean NOT NULL DEFAULT false,
  invasive_treatment_flag boolean NOT NULL DEFAULT false,
  residual_symptom_flag boolean NOT NULL DEFAULT false,
  functional_impact_flag boolean NOT NULL DEFAULT false,
  source_page integer DEFAULT NULL,
  source_snippet text NOT NULL DEFAULT '',
  extraction_confidence numeric DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  verified_by text DEFAULT NULL,
  verified_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.injury_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for injury_records"
  ON public.injury_records FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_injury_records_updated_at
  BEFORE UPDATE ON public.injury_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
