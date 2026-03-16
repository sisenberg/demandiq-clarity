
-- Evidence references: character-level citation records for traceability
CREATE TABLE public.evidence_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  page_number integer NOT NULL,
  quoted_text text NOT NULL DEFAULT '',
  character_start integer,
  character_end integer,
  evidence_type text NOT NULL DEFAULT 'direct',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.evidence_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence refs in their tenant"
  ON public.evidence_references FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can insert evidence refs in their tenant"
  ON public.evidence_references FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Users can delete their own evidence refs"
  ON public.evidence_references FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Indexes
CREATE INDEX idx_evidence_references_case ON public.evidence_references(case_id);
CREATE INDEX idx_evidence_references_document ON public.evidence_references(document_id);
