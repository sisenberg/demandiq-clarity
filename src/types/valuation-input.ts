/**
 * EvaluateIQ — Valuation Input Snapshot
 *
 * Editable, versioned structure capturing all user-facing inputs
 * for a claim valuation. Hydrated from upstream demand/intake data,
 * then editable by the adjuster. Each save creates a new version.
 */

// ─── Section 1: Demand-Linked Case Overview ─────────────

export interface DemandOverviewInputs {
  demand_source: string;
  demand_received_date: string | null;
  representation_status: "represented" | "unrepresented" | "unknown";
  claimant_attorney_name: string;
  claimant_attorney_firm: string;
  demand_amount: number | null;
  policy_limits: number | null;
  liability_determination: string;
  claim_notes: string;
  claimant_name: string;
  date_of_loss: string;
  jurisdiction_state: string;
  venue_county: string;
  claim_status: string;
  adjuster_name: string;
  supervisor_name: string;
}

// ─── Section 2: Liability / Collectibility ──────────────

export interface LiabilityInputs {
  insured_fault_percentage: number | null;
  claimant_fault_percentage: number | null;
  negligence_notes: string;
  seatbelt_mitigation_notes: string;
  collectible_constraints: string;
  coverage_constraints: string;
  policy_limit_notes: string;
}

// ─── Section 3: Injury & Treatment Summary ──────────────

export interface InjuryInputEntry {
  id: string;
  body_part: string;
  injury_category: string;
  severity: string;
  is_pre_existing: boolean;
  diagnosis_code: string;
}

export interface InjuryTreatmentInputs {
  injuries: InjuryInputEntry[];
  treatment_types: string[];
  treatment_start_date: string | null;
  treatment_end_date: string | null;
  has_surgery: boolean;
  has_injections: boolean;
  has_imaging: boolean;
  has_hospitalization: boolean;
  residual_complaints: string;
  functional_limitations: string;
  permanency_claimed: boolean;
}

// ─── Section 4: Economic Damages ────────────────────────

export interface EconomicDamagesInputs {
  medical_specials_claimed: number | null;
  medical_specials_allowed: number | null;
  wage_loss_claimed: number | null;
  wage_loss_allowed: number | null;
  future_medical_claimed: number | null;
  future_medical_allowed: number | null;
  other_out_of_pocket: number | null;
}

// ─── Section 5: Evaluation Context ──────────────────────

export interface EvaluationContextInputs {
  pre_existing_conditions: string;
  gaps_in_treatment: string;
  causation_concerns: string;
  documentation_concerns: string;
  strengths: string;
  weaknesses: string;
  notes: string;
}

// ─── Root Snapshot ──────────────────────────────────────

export interface ValuationInputSnapshot {
  snapshot_id: string;
  case_id: string;
  tenant_id: string;
  version: number;
  created_at: string;
  created_by: string | null;

  /** Upstream linkage */
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  upstream_snapshot_id: string | null;

  /** Editable sections */
  demand_overview: DemandOverviewInputs;
  liability: LiabilityInputs;
  injury_treatment: InjuryTreatmentInputs;
  economic_damages: EconomicDamagesInputs;
  evaluation_context: EvaluationContextInputs;

  /** Dirty tracking */
  is_dirty: boolean;
  last_saved_at: string | null;
}

/** Factory for blank snapshot */
export function createBlankValuationInput(
  caseId: string,
  tenantId: string,
  userId: string | null,
  sourceModule: "demandiq" | "revieweriq",
  sourceVersion: number,
): ValuationInputSnapshot {
  return {
    snapshot_id: `vi-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    case_id: caseId,
    tenant_id: tenantId,
    version: 1,
    created_at: new Date().toISOString(),
    created_by: userId,
    source_module: sourceModule,
    source_package_version: sourceVersion,
    upstream_snapshot_id: null,
    demand_overview: {
      demand_source: "",
      demand_received_date: null,
      representation_status: "unknown",
      claimant_attorney_name: "",
      claimant_attorney_firm: "",
      demand_amount: null,
      policy_limits: null,
      liability_determination: "",
      claim_notes: "",
      claimant_name: "",
      date_of_loss: "",
      jurisdiction_state: "",
      venue_county: "",
      claim_status: "",
      adjuster_name: "",
      supervisor_name: "",
    },
    liability: {
      insured_fault_percentage: null,
      claimant_fault_percentage: null,
      negligence_notes: "",
      seatbelt_mitigation_notes: "",
      collectible_constraints: "",
      coverage_constraints: "",
      policy_limit_notes: "",
    },
    injury_treatment: {
      injuries: [],
      treatment_types: [],
      treatment_start_date: null,
      treatment_end_date: null,
      has_surgery: false,
      has_injections: false,
      has_imaging: false,
      has_hospitalization: false,
      residual_complaints: "",
      functional_limitations: "",
      permanency_claimed: false,
    },
    economic_damages: {
      medical_specials_claimed: null,
      medical_specials_allowed: null,
      wage_loss_claimed: null,
      wage_loss_allowed: null,
      future_medical_claimed: null,
      future_medical_allowed: null,
      other_out_of_pocket: null,
    },
    evaluation_context: {
      pre_existing_conditions: "",
      gaps_in_treatment: "",
      causation_concerns: "",
      documentation_concerns: "",
      strengths: "",
      weaknesses: "",
      notes: "",
    },
    is_dirty: false,
    last_saved_at: null,
  };
}
