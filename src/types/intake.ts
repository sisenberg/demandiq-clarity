/**
 * Intake pipeline types for document OCR + extraction foundation.
 * These map directly to the Supabase schema created in the intake migration.
 *
 * NOTE: Status enums & display labels are centralized in @/lib/statuses.ts.
 *       This file contains row type definitions only.
 */

// Re-export status types/labels from centralized module for backward compatibility
export type { IntakeStatus, IntakeJobStatus, IntakeJobType } from "@/lib/statuses";
export { INTAKE_STATUS_LABEL, JOB_TYPE_LABEL as INTAKE_JOB_TYPE_LABEL } from "@/lib/statuses";

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
  job_type: string;
  status: string;
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

// ── Display helpers (kept for backward compat, prefer @/lib/statuses) ──

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
