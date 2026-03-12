
CREATE TABLE public.negotiation_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  session_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  outcome_type text NOT NULL DEFAULT '',
  final_settlement_amount numeric NULL,
  package_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_by uuid NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.negotiation_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_tenant_neg_packages" ON public.negotiation_packages
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "insert_tenant_neg_packages" ON public.negotiation_packages
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_neg_packages_case ON public.negotiation_packages(case_id);
CREATE INDEX idx_neg_packages_version ON public.negotiation_packages(case_id, version DESC);
