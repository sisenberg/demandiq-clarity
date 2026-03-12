/**
 * EvaluateIQ — Persistence Layer Types
 *
 * Typed contracts for all EvaluateIQ database entities.
 * These mirror the database schema and are used for CRUD operations.
 */

import type { EvaluateIntakeSnapshot, CompletenessWarning } from "./evaluate-intake";

// ─── Enums (match DB enums) ────────────────────────────

export type EvaluationCaseStatus =
  | "not_started"
  | "intake_ready"
  | "intake_in_progress"
  | "valuation_ready"
  | "valuation_in_review"
  | "valued"
  | "completed";

export type ValuationRunType = "initial" | "refresh" | "manual_override";

export type DriverFamily =
  | "injury_severity"
  | "treatment_intensity"
  | "liability"
  | "credibility"
  | "venue"
  | "policy_limits"
  | "wage_loss"
  | "future_treatment"
  | "permanency"
  | "surgery"
  | "imaging"
  | "pre_existing"
  | "other";

export type AssumptionCategory =
  | "liability"
  | "damages"
  | "comparative_fault"
  | "future_medical"
  | "wage_loss"
  | "policy_limits"
  | "venue"
  | "credibility"
  | "other";

// ─── 1. Evaluation Cases ───────────────────────────────

export interface EvaluationCase {
  id: string;
  case_id: string;
  tenant_id: string;
  module_status: EvaluationCaseStatus;
  active_snapshot_id: string | null;
  active_valuation_id: string | null;
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type EvaluationCaseInsert = Pick<EvaluationCase, "case_id" | "tenant_id"> &
  Partial<Omit<EvaluationCase, "id" | "case_id" | "tenant_id" | "created_at" | "updated_at">>;

export type EvaluationCaseUpdate = Partial<
  Pick<
    EvaluationCase,
    "module_status" | "active_snapshot_id" | "active_valuation_id" | "started_at" | "started_by" | "completed_at" | "completed_by"
  >
>;

// ─── 2. Evaluation Snapshots ───────────────────────────

export interface EvaluationSnapshot {
  id: string;
  case_id: string;
  tenant_id: string;
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  source_snapshot_id: string | null;
  /** The full normalized intake payload */
  snapshot_payload: EvaluateIntakeSnapshot;
  completeness_score: number | null;
  completeness_warnings: CompletenessWarning[];
  is_current: boolean;
  created_at: string;
  created_by: string | null;
}

export type EvaluationSnapshotInsert = Omit<EvaluationSnapshot, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

// ─── 3. Valuation Driver Records ───────────────────────

export interface ValuationDriverRecord {
  id: string;
  case_id: string;
  tenant_id: string;
  valuation_run_id: string | null;
  snapshot_id: string | null;
  driver_family: DriverFamily;
  driver_key: string;
  raw_input_value: string;
  normalized_value: number | null;
  score: number | null;
  weight: number | null;
  narrative: string;
  evidence_ref_ids: string[];
  created_at: string;
  updated_at: string;
}

export type ValuationDriverRecordInsert = Pick<
  ValuationDriverRecord,
  "case_id" | "tenant_id" | "driver_family" | "driver_key"
> &
  Partial<Omit<ValuationDriverRecord, "id" | "case_id" | "tenant_id" | "driver_family" | "driver_key" | "created_at" | "updated_at">>;

// ─── 4. Valuation Runs ────────────────────────────────

export interface ValuationRun {
  id: string;
  case_id: string;
  tenant_id: string;
  snapshot_id: string | null;
  run_type: ValuationRunType;
  engine_version: string;
  inputs_summary: Record<string, unknown>;
  range_floor: number | null;
  range_likely: number | null;
  range_stretch: number | null;
  confidence: number | null;
  top_assumptions: ValuationRunAssumptionSummary[];
  created_at: string;
  created_by: string | null;
}

/** Summary of an assumption included in a valuation run output */
export interface ValuationRunAssumptionSummary {
  key: string;
  label: string;
  impact: "expander" | "reducer" | "neutral";
  description: string;
}

export type ValuationRunInsert = Pick<ValuationRun, "case_id" | "tenant_id"> &
  Partial<Omit<ValuationRun, "id" | "case_id" | "tenant_id" | "created_at">>;

// ─── 5. Valuation Assumptions ──────────────────────────

export interface ValuationAssumption {
  id: string;
  case_id: string;
  tenant_id: string;
  valuation_run_id: string | null;
  category: AssumptionCategory;
  assumption_key: string;
  assumption_value: string;
  reason_notes: string;
  adopted_by: string | null;
  adopted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ValuationAssumptionInsert = Pick<
  ValuationAssumption,
  "case_id" | "tenant_id" | "category" | "assumption_key" | "assumption_value"
> &
  Partial<Omit<ValuationAssumption, "id" | "case_id" | "tenant_id" | "category" | "assumption_key" | "assumption_value" | "created_at" | "updated_at">>;

export type ValuationAssumptionUpdate = Partial<
  Pick<ValuationAssumption, "assumption_value" | "reason_notes" | "adopted_by" | "adopted_at">
>;

// ─── 6. Valuation Selections ──────────────────────────

export interface ValuationSelection {
  id: string;
  case_id: string;
  tenant_id: string;
  valuation_run_id: string | null;
  selected_floor: number | null;
  selected_likely: number | null;
  selected_stretch: number | null;
  authority_recommendation: number | null;
  rationale_notes: string;
  selected_by: string | null;
  selected_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ValuationSelectionInsert = Pick<ValuationSelection, "case_id" | "tenant_id"> &
  Partial<Omit<ValuationSelection, "id" | "case_id" | "tenant_id" | "created_at" | "updated_at">>;

export type ValuationSelectionUpdate = Partial<
  Pick<
    ValuationSelection,
    "selected_floor" | "selected_likely" | "selected_stretch" | "authority_recommendation" | "rationale_notes" | "selected_by" | "selected_at"
  >
>;

// ─── 7. Evaluation Packages ──────────────────────────

export interface EvaluationPackage {
  id: string;
  case_id: string;
  tenant_id: string;
  version: number;
  snapshot_id: string | null;
  valuation_run_id: string | null;
  selection_id: string | null;
  package_payload: EvaluatePackagePayload;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
}

/** The published EvaluatePackage payload for downstream consumption */
export interface EvaluatePackagePayload {
  /** Package metadata */
  package_version: number;
  engine_version: string;
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;

  /** Range outputs */
  range_floor: number | null;
  range_likely: number | null;
  range_stretch: number | null;
  confidence: number | null;

  /** Selected working range */
  selected_floor: number | null;
  selected_likely: number | null;
  selected_stretch: number | null;
  authority_recommendation: number | null;
  rationale_notes: string;

  /** Key driver summaries */
  driver_summaries: ValuationRunAssumptionSummary[];

  /** Assumptions adopted */
  assumptions: Array<{
    category: AssumptionCategory;
    key: string;
    value: string;
    reason: string;
  }>;

  /** Medical totals */
  total_billed: number;
  total_reviewed: number | null;

  /** Snapshot completeness at time of publication */
  completeness_score: number;
}

export type EvaluationPackageInsert = Pick<EvaluationPackage, "case_id" | "tenant_id" | "package_payload"> &
  Partial<Omit<EvaluationPackage, "id" | "case_id" | "tenant_id" | "package_payload" | "created_at">>;

// ─── Audit Action Types ────────────────────────────────

export type EvaluateValuationAuditAction =
  | "evaluate_snapshot_created"
  | "evaluate_snapshot_refreshed"
  | "evaluate_valuation_run_created"
  | "evaluate_assumption_adopted"
  | "evaluate_assumption_updated"
  | "evaluate_selection_saved"
  | "evaluate_selection_updated"
  | "evaluate_package_published"
  | "evaluate_status_transition";
