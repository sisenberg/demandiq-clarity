
-- Specials records: structured bill-level data linked to demands
CREATE TABLE public.specials_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  linked_demand_id uuid REFERENCES public.demands(id),
  source_document_id uuid REFERENCES public.case_documents(id),
  provider_name text NOT NULL DEFAULT '',
  provider_party_id uuid REFERENCES public.case_parties(id),
  date_of_service text NOT NULL DEFAULT '',
  cpt_or_hcpcs_code text DEFAULT NULL,
  description text NOT NULL DEFAULT '',
  billed_amount numeric NOT NULL DEFAULT 0,
  adjustments numeric DEFAULT NULL,
  balance_due numeric DEFAULT NULL,
  extraction_confidence numeric DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  verified_by text DEFAULT NULL,
  verified_at timestamptz DEFAULT NULL,
  source_page integer DEFAULT NULL,
  source_snippet text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.specials_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for specials_records"
  ON public.specials_records FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_specials_records_updated_at
  BEFORE UPDATE ON public.specials_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add aggregate columns to demands
ALTER TABLE public.demands
ADD COLUMN IF NOT EXISTS total_billed_specials numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_bills integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS number_of_providers integer DEFAULT 0;
