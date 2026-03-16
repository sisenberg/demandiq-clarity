
-- Composite index for entity-level citation lookups (used by useEntityEvidenceAnchors, useBulkEvidenceAnchors)
CREATE INDEX IF NOT EXISTS idx_evidence_references_entity
  ON public.evidence_references (anchor_entity_type, anchor_entity_id)
  WHERE anchor_entity_type IS NOT NULL;

-- Index for case-level citation lookups
CREATE INDEX IF NOT EXISTS idx_evidence_references_case_created
  ON public.evidence_references (case_id, created_at DESC);

-- Index for document + page lookups (used by resolveAnchor)
CREATE INDEX IF NOT EXISTS idx_evidence_references_doc_page
  ON public.evidence_references (document_id, page_number);

-- Add confidence column for extraction-produced anchors
ALTER TABLE public.evidence_references
  ADD COLUMN IF NOT EXISTS confidence numeric(4,3) DEFAULT NULL;
