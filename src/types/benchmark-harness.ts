/**
 * CasualtyIQ — OCR/Extraction/Chunking Golden Test Harness Types
 */

// ── Failure Classification ─────────────────────────────────

export type BenchmarkFailureClass =
  | "routing_failure"
  | "file_corruption"
  | "provider_error"
  | "parse_timeout"
  | "page_loss"
  | "chunking_failure"
  | "extraction_failure"
  | "evidence_link_failure"
  | "package_publication_failure"
  | "downstream_launch_failure";

export const FAILURE_CLASS_LABELS: Record<BenchmarkFailureClass, string> = {
  routing_failure: "Routing Failure",
  file_corruption: "File Corruption",
  provider_error: "Provider Error",
  parse_timeout: "Parse Timeout",
  page_loss: "Page Loss",
  chunking_failure: "Chunking Failure",
  extraction_failure: "Extraction Failure",
  evidence_link_failure: "Evidence-Link Failure",
  package_publication_failure: "Package Publication Failure",
  downstream_launch_failure: "Downstream Launch Failure",
};

// ── Stage Result ───────────────────────────────────────────

export type BenchmarkStage =
  | "file_validation"
  | "provider_routing"
  | "parse_success"
  | "page_count_integrity"
  | "canonical_parse"
  | "chunk_creation"
  | "label_assignment"
  | "evidence_link_readiness"
  | "extraction_routing"
  | "package_structure"
  | "evaluate_eligibility";

export const STAGE_LABELS: Record<BenchmarkStage, string> = {
  file_validation: "File Validation",
  provider_routing: "Provider Routing",
  parse_success: "Parse Success",
  page_count_integrity: "Page Count Integrity",
  canonical_parse: "Canonical Parse",
  chunk_creation: "Chunk Creation",
  label_assignment: "Label Assignment",
  evidence_link_readiness: "Evidence Link Readiness",
  extraction_routing: "Extraction Routing",
  package_structure: "Package Structure",
  evaluate_eligibility: "Evaluate Eligibility",
};

export interface BenchmarkStageResult {
  stage: BenchmarkStage;
  passed: boolean;
  duration_ms: number;
  failure_class?: BenchmarkFailureClass;
  error_message?: string;
  metrics?: Record<string, number | string>;
}

// ── Item Result ────────────────────────────────────────────

export interface BenchmarkItemResult {
  benchmark_id: string;
  benchmark_name: string;
  stages: BenchmarkStageResult[];
  overall_passed: boolean;
  failure_classes: BenchmarkFailureClass[];
  timestamp: string;
}

// ── Run Summary ────────────────────────────────────────────

export interface BenchmarkAggregateMetrics {
  parse_success_rate: number;
  page_preservation_rate: number;
  chunk_count_variance: number;
  label_coverage: number;
  failed_field_rate: number;
  rerun_consistency: number;
  avg_latency_ms: number;
}

export interface BenchmarkRunSummary {
  run_id: string;
  items: BenchmarkItemResult[];
  aggregate_metrics: BenchmarkAggregateMetrics;
  failure_class_counts: Partial<Record<BenchmarkFailureClass, number>>;
  started_at: string;
  completed_at: string;
}

// ── Corpus Item ────────────────────────────────────────────

export interface BenchmarkCorpusItem {
  id: string;
  name: string;
  description: string;
  documentType: string;
  fileType: string;
  fileSizeBytes: number;
  pageCount: number;
  pageTexts: string[];
  isOcrRequired: boolean;
  expectedLabels: string[];
  expectedChunkCountMin: number;
  expectedChunkCountMax: number;
  expectedExtractionPasses: string[];
  expectedFailurePoints: BenchmarkFailureClass[];
}
