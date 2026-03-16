
-- Demands table: canonical demand records per case
CREATE TABLE public.demands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  source_document_id uuid REFERENCES public.case_documents(id),
  is_active boolean NOT NULL DEFAULT false,
  demand_date text NOT NULL DEFAULT '',
  claimant_name text NOT NULL DEFAULT '',
  attorney_name text NOT NULL DEFAULT '',
  law_firm_name text NOT NULL DEFAULT '',
  represented_status text NOT NULL DEFAULT 'unknown',
  demand_amount numeric DEFAULT NULL,
  demand_deadline text DEFAULT NULL,
  loss_date text NOT NULL DEFAULT '',
  insured_name text NOT NULL DEFAULT '',
  claim_number text NOT NULL DEFAULT '',
  demand_summary_text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active demand per case
CREATE UNIQUE INDEX idx_demands_active_per_case ON public.demands (case_id) WHERE is_active = true;

ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for demands"
  ON public.demands FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Field-level extraction confidence and evidence
CREATE TABLE public.demand_field_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  extracted_value text NOT NULL DEFAULT '',
  confidence numeric DEFAULT NULL,
  source_page integer DEFAULT NULL,
  source_snippet text NOT NULL DEFAULT '',
  evidence_reference_id uuid REFERENCES public.evidence_references(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_field_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for demand_field_extractions"
  ON public.demand_field_extractions FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_demands_updated_at
  BEFORE UPDATE ON public.demands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
