
-- Intake evaluation packages: structured OCR-to-EvaluateIQ contract
CREATE TABLE public.intake_evaluation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  active_demand_id uuid REFERENCES public.demands(id),
  version integer NOT NULL DEFAULT 1,
  package_status text NOT NULL DEFAULT 'draft',
  claimant_name text NOT NULL DEFAULT '',
  represented_status text NOT NULL DEFAULT '',
  attorney_name text NOT NULL DEFAULT '',
  law_firm text NOT NULL DEFAULT '',
  demand_amount numeric DEFAULT NULL,
  demand_deadline text DEFAULT NULL,
  specials_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_list jsonb NOT NULL DEFAULT '[]'::jsonb,
  treatment_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  injury_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  objective_support_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  invasive_treatment_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  residual_symptom_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  functional_impact_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  missing_data_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  package_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  assembled_at timestamptz DEFAULT NULL,
  assembled_by text DEFAULT NULL,
  published_at timestamptz DEFAULT NULL,
  published_by text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version)
);

ALTER TABLE public.intake_evaluation_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for intake_evaluation_packages"
  ON public.intake_evaluation_packages FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_intake_evaluation_packages_updated_at
  BEFORE UPDATE ON public.intake_evaluation_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
