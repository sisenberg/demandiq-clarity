
-- Intake provenance audit trail: field-level traceability from OCR to EvaluateIQ
CREATE TABLE public.intake_field_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  intake_package_id uuid REFERENCES public.intake_evaluation_packages(id),
  intake_package_version integer NOT NULL,
  section text NOT NULL,
  field_name text NOT NULL,
  extracted_value text NOT NULL DEFAULT '',
  corrected_value text DEFAULT NULL,
  final_value text NOT NULL DEFAULT '',
  source_document_id uuid REFERENCES public.case_documents(id),
  source_page integer DEFAULT NULL,
  source_snippet text NOT NULL DEFAULT '',
  reviewer_action text NOT NULL DEFAULT 'auto_accepted',
  reviewer_user_id text DEFAULT NULL,
  reviewer_timestamp timestamptz DEFAULT NULL,
  publish_event text NOT NULL DEFAULT 'assembled',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_field_provenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for intake_field_provenance"
  ON public.intake_field_provenance FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE INDEX idx_intake_provenance_case ON public.intake_field_provenance (case_id, intake_package_version);
CREATE INDEX idx_intake_provenance_doc ON public.intake_field_provenance (source_document_id);
