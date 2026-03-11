/**
 * Intake pipeline types for document OCR + extraction foundation.
 * These map directly to the Supabase schema created in the intake migration.
 */

// ── Enums ──────────────────────────────────────────────────────

export type IntakeStatus =
  | "uploaded"
  | "queued_for_text_extraction"
  | "extracting_text"
  | "text_extracted"
  | "queued_for_parsing"
  | "parsing"
  | "parsed"
  | "needs_review"
  | "failed";

export type IntakeJobType =
  | "text_extraction"
  | "document_parsing"
  | "fact_extraction"
  | "duplicate_detection";

export type IntakeJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type FactType =
  | "medical_diagnosis"
  | "treatment"
  | "medication"
  | "date_of_event"
  | "injury_description"
  | "provider_info"
  | "billing_amount"
  | "liability_statement"
  | "witness_statement"
  | "policy_detail"
  | "employment_info"
  | "other";

export type DuplicateFlagStatus = "flagged" | "dismissed" | "confirmed";

// ── Row types ──────────────────────────────────────────────────

export interface DocumentPageRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  page_number: number;
  extracted_text: string | null;
  confidence_score: number | null;
  image_storage_path: string | null;
  width_px: number | null;
  height_px: number | null;
  created_at: string;
}

export interface IntakeJobRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string | null;
  job_type: IntakeJobType;
  status: IntakeJobStatus;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ExtractedFactRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  page_id: string | null;
  page_number: number | null;
  fact_type: FactType;
  fact_text: string;
  structured_data: Record<string, unknown>;
  confidence_score: number | null;
  source_snippet: string;
  source_anchor: string | null;
  needs_review: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FactEvidenceLinkRow {
  id: string;
  tenant_id: string;
  case_id: string;
  fact_id: string;
  linked_entity_type: string;
  linked_entity_id: string;
  relevance_type: string;
  notes: string;
  created_at: string;
}

export interface DuplicateDocumentFlagRow {
  id: string;
  tenant_id: string;
  case_id: string;
  document_id: string;
  duplicate_of_document_id: string;
  similarity_score: number;
  flag_status: DuplicateFlagStatus;
  flagged_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

// ── Display helpers ────────────────────────────────────────────

export const INTAKE_STATUS_LABEL: Record<IntakeStatus, string> = {
  uploaded: "Uploaded",
  queued_for_text_extraction: "Queued for OCR",
  extracting_text: "Extracting Text",
  text_extracted: "Text Extracted",
  queued_for_parsing: "Queued for Parsing",
  parsing: "Parsing",
  parsed: "Parsed",
  needs_review: "Needs Review",
  failed: "Failed",
};

export const INTAKE_JOB_TYPE_LABEL: Record<IntakeJobType, string> = {
  text_extraction: "Text Extraction (OCR)",
  document_parsing: "Document Parsing",
  fact_extraction: "Fact Extraction",
  duplicate_detection: "Duplicate Detection",
};

export const FACT_TYPE_LABEL: Record<FactType, string> = {
  medical_diagnosis: "Medical Diagnosis",
  treatment: "Treatment",
  medication: "Medication",
  date_of_event: "Date of Event",
  injury_description: "Injury Description",
  provider_info: "Provider Info",
  billing_amount: "Billing Amount",
  liability_statement: "Liability Statement",
  witness_statement: "Witness Statement",
  policy_detail: "Policy Detail",
  employment_info: "Employment Info",
  other: "Other",
};
