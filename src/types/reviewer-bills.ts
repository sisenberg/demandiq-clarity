/**
 * ReviewerIQ — Structured Bill Header & Line-Item Models
 *
 * Covers bill headers, line items, reference pricing, normalization flags,
 * and extraction metadata. Raw and normalized values are preserved side-by-side
 * for auditability and human review.
 */

// ─── Bill Format ────────────────────────────────────────

export type BillFormat =
  | "ub04"        // Institutional / UB-04
  | "cms1500"     // Professional / CMS-1500 / HCFA
  | "provider_ledger"  // Office ledger / statement
  | "pharmacy"    // Rx / pharmacy charge
  | "other"
  | "unknown";

// ─── Extraction Review State ────────────────────────────

export type BillExtractionReviewState =
  | "draft"
  | "needs_review"
  | "accepted"
  | "corrected"
  | "rejected";

export type BillExtractionConfidence = "high" | "medium" | "low" | "unknown";

// ─── Bill Header ────────────────────────────────────────

export interface ReviewerBillHeader {
  id: string;
  tenant_id: string;
  case_id: string;
  /** FK to upstream bill (read-only reference from IntakeIQ) */
  upstream_bill_id: string | null;
  /** Detected bill format */
  bill_format: BillFormat;
  /** Source document reference */
  source_document_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_snippet: string;
  /** Provider — raw and normalized */
  provider_name_raw: string;
  provider_name_normalized: string | null;
  upstream_provider_id: string | null;
  provider_npi: string | null;
  facility_name: string;
  /** Dates */
  statement_date: string | null;
  bill_date: string | null;
  /** Aggregate amounts (computed from line items) */
  total_billed: number;
  total_reference: number;
  total_accepted: number;
  total_reduced: number;
  total_disputed: number;
  /** Statement total as printed (for mismatch detection) */
  statement_total_printed: number | null;
  /** Extraction metadata */
  extraction_confidence: BillExtractionConfidence;
  extraction_confidence_score: number | null;
  extraction_model: string;
  extraction_version: string;
  extracted_at: string | null;
  /** Review status */
  review_state: BillExtractionReviewState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string;
  /** Line item counts */
  line_count: number;
  flagged_line_count: number;
  /** Flags on the header level */
  flags: BillHeaderFlag[];
  created_at: string;
  updated_at: string;
}

export type BillReviewStatus =
  | "pending"
  | "in_review"
  | "reviewed"
  | "accepted"
  | "disputed";

export interface BillHeaderFlag {
  type: BillHeaderFlagType;
  severity: "error" | "warning" | "info";
  message: string;
}

export type BillHeaderFlagType =
  | "total_mismatch"
  | "missing_statement_date"
  | "provider_name_ambiguous"
  | "duplicate_bill"
  | "no_line_items";

// ─── Bill Line Item ─────────────────────────────────────

export interface ReviewerBillLine {
  id: string;
  tenant_id: string;
  case_id: string;
  bill_header_id: string;
  /** Service dates — raw and normalized */
  service_date: string | null;
  service_date_end: string | null;
  service_date_raw: string;
  /** Coding — raw and normalized */
  cpt_code: string | null;
  cpt_code_raw: string;
  hcpcs_code: string | null;
  icd_codes: string[];
  modifiers: string[];
  revenue_code: string | null;
  /** Quantities and amounts */
  units: number;
  billed_amount: number;
  billed_amount_raw: string;
  /** Reference pricing */
  reference_amount: number | null;
  reference_basis: string;
  variance_amount: number | null;
  variance_pct: number | null;
  /** Description — raw and normalized */
  description: string;
  description_raw: string;
  /** Linkage */
  upstream_treatment_id: string | null;
  treatment_review_id: string | null;
  upstream_provider_id: string | null;
  /** Provider/facility for this line */
  provider_name: string;
  facility_name: string;
  /** Source evidence */
  source_page: number | null;
  source_snippet: string;
  /** Extraction metadata */
  extraction_confidence: BillExtractionConfidence;
  extraction_confidence_score: number | null;
  /** Reviewer disposition */
  disposition: BillLineDisposition;
  accepted_amount: number | null;
  reduction_reason: string;
  reviewer_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** Flags */
  flags: BillLineFlag[];
  created_at: string;
  updated_at: string;
}

export type BillLineDisposition =
  | "pending"
  | "accepted"
  | "reduced"
  | "denied"
  | "disputed"
  | "uncertain";

export interface BillLineFlag {
  type: BillLineFlagType;
  severity: "error" | "warning" | "info";
  message: string;
}

export type BillLineFlagType =
  | "duplicate_line"
  | "missing_dos"
  | "missing_code"
  | "invalid_code_format"
  | "missing_billed_amount"
  | "provider_mismatch"
  | "date_mismatch"
  | "no_linked_treatment"
  | "high_variance"
  | "excessive_units"
  | "total_mismatch";

// ─── Reference Pricing ─────────────────────────────────

export interface ReferencePriceEntry {
  cpt_code: string;
  description: string;
  /** Medicare national average */
  medicare_national: number;
  /** Geographic adjustment factor (GPCI) */
  geographic_factor: number;
  /** Adjusted reference amount */
  adjusted_amount: number;
  /** Basis description for audit trail */
  basis: string;
  /** Year/version of fee schedule */
  fee_schedule_year: number;
  /** Locality */
  locality: string;
}

export interface ReferencePricingConfig {
  /** Fee schedule year */
  fee_schedule_year: number;
  /** Default locality for GPCI */
  default_locality: string;
  /** Multiplier above Medicare to consider "reasonable" (e.g., 2.0 = 200% of Medicare) */
  reasonable_multiplier: number;
  /** Variance threshold % to flag (e.g., 200 = flag if billed > 200% of reference) */
  high_variance_threshold_pct: number;
}

export const DEFAULT_PRICING_CONFIG: ReferencePricingConfig = {
  fee_schedule_year: 2024,
  default_locality: "CA - Sacramento",
  reasonable_multiplier: 2.0,
  high_variance_threshold_pct: 200,
};

// ─── Raw Bill Input (pre-normalization) ─────────────────

export interface RawBillInput {
  /** Where it came from */
  source_document_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  source_snippet: string;
  /** Bill-level raw fields */
  provider_name_raw: string;
  facility_name_raw: string;
  statement_date_raw: string;
  bill_date_raw: string;
  statement_total_raw: string;
  bill_format_hint: BillFormat;
  /** Line items */
  lines: RawBillLineInput[];
  /** Extraction metadata */
  extraction_model: string;
  extraction_version: string;
  extraction_confidence_score: number | null;
}

export interface RawBillLineInput {
  service_date_raw: string;
  service_date_end_raw: string;
  cpt_code_raw: string;
  hcpcs_code_raw: string;
  icd_codes_raw: string[];
  modifiers_raw: string[];
  revenue_code_raw: string;
  units_raw: string;
  billed_amount_raw: string;
  description_raw: string;
  source_page: number | null;
  source_snippet: string;
  /** Optional pre-linkage */
  upstream_treatment_id: string | null;
  extraction_confidence_score: number | null;
}
