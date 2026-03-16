
-- chunk_labels: claim-aware labeling for document chunks
CREATE TABLE public.chunk_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  chunk_id uuid NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES public.case_documents(id),
  label text NOT NULL,
  confidence numeric DEFAULT 0,
  source text NOT NULL DEFAULT 'heuristic',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chunk_id, label)
);

CREATE INDEX idx_chunk_labels_case_label ON public.chunk_labels (case_id, label);
CREATE INDEX idx_chunk_labels_chunk ON public.chunk_labels (chunk_id);
CREATE INDEX idx_chunk_labels_document ON public.chunk_labels (document_id);

ALTER TABLE public.chunk_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read chunk labels"
  ON public.chunk_labels FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can insert chunk labels"
  ON public.chunk_labels FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can update chunk labels"
  ON public.chunk_labels FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can delete chunk labels"
  ON public.chunk_labels FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Allow service role full access for edge functions
CREATE POLICY "Service role full access to chunk_labels"
  ON public.chunk_labels FOR ALL TO service_role USING (true) WITH CHECK (true);

-- retrieval_events: audit log for chunk retrieval operations
CREATE TABLE public.retrieval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  query_text text NOT NULL DEFAULT '',
  retrieval_mode text NOT NULL DEFAULT 'lexical',
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_chunk_ids uuid[] NOT NULL DEFAULT '{}',
  result_count integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'system',
  module text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retrieval_events_case ON public.retrieval_events (case_id);
CREATE INDEX idx_retrieval_events_created ON public.retrieval_events (created_at DESC);

ALTER TABLE public.retrieval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant users can read retrieval events"
  ON public.retrieval_events FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant users can insert retrieval events"
  ON public.retrieval_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));

CREATE POLICY "Service role full access to retrieval_events"
  ON public.retrieval_events FOR ALL TO service_role USING (true) WITH CHECK (true);
