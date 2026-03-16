
-- Document chunks: type-aware text segmentation for extraction routing
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  page_start integer NOT NULL,
  page_end integer NOT NULL,
  chunk_type text NOT NULL DEFAULT 'generic',
  chunk_text text NOT NULL DEFAULT '',
  chunk_index integer NOT NULL DEFAULT 0,
  content_hash text DEFAULT NULL,
  extraction_pass text DEFAULT NULL,
  extraction_version integer DEFAULT NULL,
  extraction_timestamp timestamptz DEFAULT NULL,
  extraction_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for document_chunks"
  ON public.document_chunks FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE TRIGGER update_document_chunks_updated_at
  BEFORE UPDATE ON public.document_chunks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add extraction metadata to downstream fact tables
ALTER TABLE public.specials_records
  ADD COLUMN IF NOT EXISTS extraction_pass text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_version integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_timestamp timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.document_chunks(id) DEFAULT NULL;

ALTER TABLE public.treatment_events
  ADD COLUMN IF NOT EXISTS extraction_pass text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_version integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_timestamp timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.document_chunks(id) DEFAULT NULL;

ALTER TABLE public.injury_records
  ADD COLUMN IF NOT EXISTS extraction_pass text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_version integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_timestamp timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.document_chunks(id) DEFAULT NULL;

-- Unique constraint on content_hash per document to prevent duplicate chunks
CREATE UNIQUE INDEX IF NOT EXISTS idx_document_chunks_hash_unique
  ON public.document_chunks (document_id, content_hash)
  WHERE content_hash IS NOT NULL;
