/**
 * ReviewerIQ — Structured Bill Line-Item Models
 * 
 * Covers bill header, line items, reference pricing, and normalization.
 * These are module-owned types — ReviewerIQ creates and manages this data.
 */

// ─── Bill Header ────────────────────────────────────────

export interface ReviewerBillHeader {
  id: string;
  tenant_id: string;
  case_id: string;
  /** FK to upstream bill (read-only reference) */
  upstream_bill_id: string | null;
  /** Source document reference */
  source_document_id: string | null;
  source_page_start: number | null;
  source_page_end: number | null;
  /** Provider information */
  provider_name: string;
  provider_npi: string | null;
  facility_name: string;
  /** Aggregate amounts (computed from line items) */
  total_billed: number;
  total_reference: number;
  total_accepted: number;
  total_reduced: number;
  total_disputed: number;
  /** Review status */
  review_status: BillReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** Line item count */
  line_count: number;
  flagged_line_count: number;
  created_at: string;
  updated_at: string;
}

export type BillReviewStatus =
  | "pending"
  | "in_review"
  | "reviewed"
  | "accepted"
  | "disputed";

// ─── Bill Line Item ─────────────────────────────────────

export interface ReviewerBillLine {
  id: string;
  tenant_id: string;
  case_id: string;
  bill_header_id: string;
  /** Service details */
  service_date: string | null;
  service_date_end: string | null;
  /** Coding */
  cpt_code: string | null;
  hcpcs_code: string | null;
  icd_codes: string[];
  modifiers: string[];
  revenue_code: string | null;
  /** Quantities and amounts */
  units: number;
  billed_amount: number;
  /** Reference pricing */
  reference_amount: number | null;
  reference_basis: string;
  variance_amount: number | null;
  variance_pct: number | null;
  /** Description */
  description: string;
  /** Linkage */
  upstream_treatment_id: string | null;
  treatment_review_id: string | null;
  upstream_provider_id: string | null;
  /** Provider/facility for this line */
  provider_name: string;
  facility_name: string;
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
  | "provider_mismatch"
  | "date_mismatch"
  | "no_linked_treatment"
  | "high_variance"
  | "excessive_units";

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
