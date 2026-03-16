
-- Extend evidence_references with version-aware anchoring columns
ALTER TABLE public.evidence_references
  ADD COLUMN IF NOT EXISTS chunk_id uuid REFERENCES public.document_chunks(id),
  ADD COLUMN IF NOT EXISTS parse_version integer,
  ADD COLUMN IF NOT EXISTS processing_run_id uuid REFERENCES public.document_processing_runs(id),
  ADD COLUMN IF NOT EXISTS bounding_box jsonb,
  ADD COLUMN IF NOT EXISTS anchor_entity_type text,
  ADD COLUMN IF NOT EXISTS anchor_entity_id uuid,
  ADD COLUMN IF NOT EXISTS anchor_module text;

-- Indexes for anchor lookups
CREATE INDEX IF NOT EXISTS idx_evidence_refs_anchor
  ON public.evidence_references (anchor_entity_type, anchor_entity_id);

CREATE INDEX IF NOT EXISTS idx_evidence_refs_chunk
  ON public.evidence_references (chunk_id)
  WHERE chunk_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_refs_parse_version
  ON public.evidence_references (document_id, parse_version)
  WHERE parse_version IS NOT NULL;
