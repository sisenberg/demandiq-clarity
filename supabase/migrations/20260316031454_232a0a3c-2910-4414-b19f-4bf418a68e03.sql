
-- Canonical parsed document pages table
CREATE TABLE public.parsed_document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  parse_version integer NOT NULL DEFAULT 1,
  page_number integer NOT NULL,
  page_text text NOT NULL DEFAULT '',
  content_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  headings jsonb NOT NULL DEFAULT '[]'::jsonb,
  table_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  list_regions jsonb NOT NULL DEFAULT '[]'::jsonb,
  image_artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'unknown',
  provider_model text,
  provider_run_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric,
  is_current boolean NOT NULL DEFAULT true,
  processing_run_id uuid REFERENCES public.document_processing_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, parse_version, page_number)
);

-- Indexes
CREATE INDEX idx_parsed_doc_pages_document_current ON public.parsed_document_pages (document_id, is_current) WHERE is_current = true;
CREATE INDEX idx_parsed_doc_pages_document_version ON public.parsed_document_pages (document_id, parse_version);
CREATE INDEX idx_parsed_doc_pages_tenant ON public.parsed_document_pages (tenant_id);

-- RLS
ALTER TABLE public.parsed_document_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for parsed_document_pages"
  ON public.parsed_document_pages
  FOR ALL
  TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Service role full access on parsed_document_pages"
  ON public.parsed_document_pages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
