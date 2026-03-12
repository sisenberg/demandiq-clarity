/**
 * EvaluateIQ — Calibration Corpus Types
 *
 * Typed contracts for historical closed-claim calibration data.
 * These are fully isolated from live valuation records.
 */

// ─── Historical Claim ─────────────────────────────────

export interface HistoricalClaim {
  id: string;
  tenant_id: string;
  import_id: string | null;

  // Outcome
  final_settlement_amount: number | null;
  outcome_notes: string;

  // Claim metadata
  loss_date: string | null;
  venue_state: string;
  venue_county: string;
  jurisdiction: string;
  claim_number: string;

  // Parties
  attorney_name: string;
  attorney_firm: string;
  provider_names: string[];

  // Injuries
  injury_categories: string[];
  primary_body_parts: string[];
  has_surgery: boolean;
  has_injections: boolean;
  has_imaging: boolean;
  has_hospitalization: boolean;
  has_permanency: boolean;

  // Specials
  billed_specials: number | null;
  reviewed_specials: number | null;
  wage_loss: number | null;

  // Treatment
  treatment_duration_days: number | null;
  treatment_provider_count: number | null;

  // Coverage
  policy_limits: number | null;
  policy_type: string;

  // Liability
  liability_posture: "" | "clear" | "disputed" | "comparative" | "denied";
  comparative_negligence_pct: number | null;

  // Quality
  completeness_score: number;
  confidence_flags: Record<string, boolean>;
  raw_source: Record<string, unknown>;
  corpus_type: "calibration" | "benchmark";

  created_at: string;
  updated_at: string;
}

export type HistoricalClaimInsert = Omit<HistoricalClaim, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

// ─── Import Batch ─────────────────────────────────────

export interface CalibrationImport {
  id: string;
  tenant_id: string;
  import_type: "csv" | "json" | "document_packet";
  file_name: string;
  record_count: number;
  success_count: number;
  error_count: number;
  status: "pending" | "processing" | "completed" | "failed";
  error_log: Array<{ row: number; message: string }>;
  imported_by: string;
  created_at: string;
  completed_at: string | null;
}

// ─── CSV Row Contract ─────────────────────────────────

/** Expected CSV column headers (case-insensitive, underscore or space separated) */
export const CSV_FIELD_MAP: Record<string, keyof HistoricalClaimInsert> = {
  settlement_amount: "final_settlement_amount",
  final_settlement: "final_settlement_amount",
  settlement: "final_settlement_amount",
  loss_date: "loss_date",
  date_of_loss: "loss_date",
  venue_state: "venue_state",
  state: "venue_state",
  venue_county: "venue_county",
  county: "venue_county",
  jurisdiction: "jurisdiction",
  claim_number: "claim_number",
  claim_no: "claim_number",
  attorney: "attorney_name",
  attorney_name: "attorney_name",
  attorney_firm: "attorney_firm",
  firm: "attorney_firm",
  injury_categories: "injury_categories",
  injuries: "injury_categories",
  body_parts: "primary_body_parts",
  surgery: "has_surgery",
  injections: "has_injections",
  imaging: "has_imaging",
  hospitalization: "has_hospitalization",
  permanency: "has_permanency",
  billed_specials: "billed_specials",
  billed: "billed_specials",
  specials: "billed_specials",
  reviewed_specials: "reviewed_specials",
  reviewed: "reviewed_specials",
  wage_loss: "wage_loss",
  wages: "wage_loss",
  treatment_duration_days: "treatment_duration_days",
  treatment_days: "treatment_duration_days",
  duration_days: "treatment_duration_days",
  provider_count: "treatment_provider_count",
  providers: "provider_names",
  provider_names: "provider_names",
  policy_limits: "policy_limits",
  policy_limit: "policy_limits",
  limits: "policy_limits",
  policy_type: "policy_type",
  liability: "liability_posture",
  liability_posture: "liability_posture",
  comparative_negligence: "comparative_negligence_pct",
  comp_neg: "comparative_negligence_pct",
  outcome_notes: "outcome_notes",
  notes: "outcome_notes",
};

// ─── Query Filters ────────────────────────────────────

export interface CalibrationQueryFilters {
  attorney_name?: string;
  venue_state?: string;
  injury_category?: string;
  settlement_min?: number;
  settlement_max?: number;
  specials_min?: number;
  specials_max?: number;
  has_surgery?: boolean;
  provider_name?: string;
}
