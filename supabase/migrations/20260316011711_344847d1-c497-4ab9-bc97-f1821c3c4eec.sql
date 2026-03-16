
-- Intake review corrections table: tracks field-level edits with provenance
CREATE TABLE public.intake_review_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  section text NOT NULL,
  field_name text NOT NULL,
  extracted_value text NOT NULL DEFAULT '',
  corrected_value text DEFAULT NULL,
  evidence_document_id uuid REFERENCES public.case_documents(id),
  evidence_page integer DEFAULT NULL,
  evidence_snippet text NOT NULL DEFAULT '',
  corrected_by text DEFAULT NULL,
  corrected_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intake_review_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for intake_review_corrections"
  ON public.intake_review_corrections FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_intake_review_corrections_updated_at
  BEFORE UPDATE ON public.intake_review_corrections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE UNIQUE INDEX idx_intake_review_corrections_unique
  ON public.intake_review_corrections (case_id, section, field_name);

-- Add verification status columns to intake_evaluation_packages
ALTER TABLE public.intake_evaluation_packages
  ADD COLUMN IF NOT EXISTS demand_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS specials_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS treatment_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS injury_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS demand_verified_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS demand_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS specials_verified_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS specials_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS treatment_verified_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS treatment_verified_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS injury_verified_by text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS injury_verified_at timestamptz DEFAULT NULL;
