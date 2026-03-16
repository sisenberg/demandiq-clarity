/**
 * Evidence Anchoring types — platform-wide citation model.
 *
 * Every extracted fact, issue flag, timeline event, valuation driver,
 * or negotiation rationale can attach one or more evidence anchors that
 * point back to source material with full version awareness.
 */

// ── Anchor taxonomy ────────────────────────────────────────

export type AnchorEntityType =
  | "extracted_fact"
  | "issue_flag"
  | "chronology_event"
  | "valuation_driver"
  | "negotiation_rationale"
  | "litigation_support"
  | "general";

export type AnchorModule =
  | "demandiq"
  | "revieweriq"
  | "evaluateiq"
  | "negotiateiq"
  | "intake"
  | "platform";

export type EvidenceType =
  | "direct"
  | "corroborating"
  | "contradicting"
  | "contextual";

// ── Bounding box for spatial anchoring ─────────────────────

export interface BoundingBox {
  /** X offset as fraction of page width (0–1) */
  x: number;
  /** Y offset as fraction of page height (0–1) */
  y: number;
  /** Width as fraction of page width (0–1) */
  width: number;
  /** Height as fraction of page height (0–1) */
  height: number;
}

// ── Database row ───────────────────────────────────────────

export interface EvidenceAnchorRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  page_number: number;
  quoted_text: string;
  character_start: number | null;
  character_end: number | null;
  evidence_type: string;
  chunk_id: string | null;
  parse_version: number | null;
  processing_run_id: string | null;
  bounding_box: BoundingBox | null;
  anchor_entity_type: AnchorEntityType | null;
  anchor_entity_id: string | null;
  anchor_module: AnchorModule | null;
  created_by: string | null;
  created_at: string;
}

// ── Resolved citation (UI-ready) ───────────────────────────

export interface ResolvedCitation {
  anchor: EvidenceAnchorRow;
  /** File name from case_documents */
  fileName: string;
  /** Document type label */
  documentType: string;
  /** Full page text from parsed_document_pages (if available) */
  pageText: string | null;
  /** Parse version used */
  parseVersion: number | null;
  /** Chunk text (if chunk_id resolved) */
  chunkText: string | null;
  /** Provider that produced the parse */
  provider: string | null;
}

// ── Create params ──────────────────────────────────────────

export interface CreateEvidenceAnchorParams {
  caseId: string;
  documentId: string;
  pageNumber: number;
  quotedText: string;
  evidenceType: EvidenceType;
  characterStart?: number;
  characterEnd?: number;
  chunkId?: string;
  parseVersion?: number;
  processingRunId?: string;
  boundingBox?: BoundingBox;
  anchorEntityType?: AnchorEntityType;
  anchorEntityId?: string;
  anchorModule?: AnchorModule;
}
