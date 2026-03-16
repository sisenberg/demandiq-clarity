
-- Treatment events: structured timeline records linked to demands
CREATE TABLE public.treatment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  linked_demand_id uuid REFERENCES public.demands(id),
  source_document_id uuid REFERENCES public.case_documents(id),
  provider_name text NOT NULL DEFAULT '',
  provider_party_id uuid REFERENCES public.case_parties(id),
  visit_date text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT 'office_visit',
  specialty text DEFAULT NULL,
  body_part_reference text DEFAULT NULL,
  symptoms_or_complaints text NOT NULL DEFAULT '',
  treatment_plan_notes text NOT NULL DEFAULT '',
  event_summary text NOT NULL DEFAULT '',
  source_page integer DEFAULT NULL,
  source_snippet text NOT NULL DEFAULT '',
  extraction_confidence numeric DEFAULT NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  verified_by text DEFAULT NULL,
  verified_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.treatment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for treatment_events"
  ON public.treatment_events FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_treatment_events_updated_at
  BEFORE UPDATE ON public.treatment_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add timeline aggregate columns to demands
ALTER TABLE public.demands
ADD COLUMN IF NOT EXISTS first_treatment_date text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_treatment_date text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS treatment_duration_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_treatment_events integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS treatment_provider_count integer DEFAULT 0;
