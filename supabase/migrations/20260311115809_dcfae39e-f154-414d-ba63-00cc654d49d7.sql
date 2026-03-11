
-- Document type suggestions from AI classification
CREATE TABLE public.document_type_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  suggested_type text NOT NULL,
  confidence numeric,
  reasoning text NOT NULL DEFAULT '',
  source_snippet text NOT NULL DEFAULT '',
  source_page integer,
  is_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_type_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_type_suggestions" ON public.document_type_suggestions
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_type_suggestions" ON public.document_type_suggestions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_type_suggestions" ON public.document_type_suggestions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_type_suggestions_document ON public.document_type_suggestions(document_id);

-- Extracted metadata candidates from AI parsing
CREATE TABLE public.document_metadata_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  field_type text NOT NULL,
  extracted_value text NOT NULL,
  confidence numeric,
  source_snippet text NOT NULL DEFAULT '',
  source_page integer,
  is_accepted boolean NOT NULL DEFAULT false,
  user_corrected_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_metadata_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read_metadata_extractions" ON public.document_metadata_extractions
  FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_insert_metadata_extractions" ON public.document_metadata_extractions
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "tenant_update_metadata_extractions" ON public.document_metadata_extractions
  FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE INDEX idx_metadata_extractions_document ON public.document_metadata_extractions(document_id);
CREATE INDEX idx_metadata_extractions_field ON public.document_metadata_extractions(field_type);
