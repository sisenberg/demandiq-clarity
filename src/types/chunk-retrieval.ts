/**
 * Chunk retrieval types and claim-aware label taxonomy.
 */

// ── Claim-Aware Labels ─────────────────────────────────────

export type ChunkLabel =
  | "liability"
  | "treatment_chronology"
  | "specials_billing"
  | "wage_loss"
  | "future_damages"
  | "policy_coverage"
  | "attorney_demand"
  | "settlement_posture"
  | "visual_evidence"
  | "prior_injuries";

export const CHUNK_LABELS: { value: ChunkLabel; display: string }[] = [
  { value: "liability", display: "Liability" },
  { value: "treatment_chronology", display: "Treatment Chronology" },
  { value: "specials_billing", display: "Specials / Billing" },
  { value: "wage_loss", display: "Wage Loss" },
  { value: "future_damages", display: "Future Damages" },
  { value: "policy_coverage", display: "Policy / Coverage" },
  { value: "attorney_demand", display: "Attorney Demand Language" },
  { value: "settlement_posture", display: "Settlement Posture" },
  { value: "visual_evidence", display: "Photos / Visual Evidence" },
  { value: "prior_injuries", display: "Prior Injuries / Pre-Existing" },
];

export const CHUNK_LABEL_VALUES: ChunkLabel[] = CHUNK_LABELS.map((l) => l.value);

// ── DB Row Types ───────────────────────────────────────────

export interface ChunkLabelRow {
  id: string;
  tenant_id: string;
  case_id: string;
  chunk_id: string;
  document_id: string;
  label: ChunkLabel;
  confidence: number;
  source: "heuristic" | "ai" | "manual";
  created_at: string;
}

export interface RetrievalEventRow {
  id: string;
  tenant_id: string;
  case_id: string;
  query_text: string;
  retrieval_mode: RetrievalMode;
  filters: Record<string, unknown>;
  result_chunk_ids: string[];
  result_count: number;
  triggered_by: "user" | "system";
  module: string | null;
  latency_ms: number | null;
  created_at: string;
}

// ── Retrieval Query/Result Types ───────────────────────────

export type RetrievalMode = "lexical" | "semantic" | "metadata";

export interface RetrievalQuery {
  query?: string;
  mode: RetrievalMode;
  labels?: ChunkLabel[];
  documentIds?: string[];
  pageRange?: { start: number; end: number };
  chunkTypes?: string[];
  limit?: number;
  module?: string;
  triggeredBy?: "user" | "system";
}

export interface RetrievalResult {
  chunk_id: string;
  document_id: string;
  chunk_text: string;
  chunk_type: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  score: number;
  labels: ChunkLabel[];
}

// ── Label Assignment Result ────────────────────────────────

export interface LabelAssignment {
  label: ChunkLabel;
  confidence: number;
}
