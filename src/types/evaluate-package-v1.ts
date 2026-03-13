/**
 * EvaluateIQ — EvaluatePackage v1 Output Contract
 *
 * Stable, versioned output contract for downstream consumption by
 * NegotiateIQ and the shared package registry.
 *
 * This contract encapsulates:
 *  - Claim profile and merits assessment
 *  - Settlement corridor (engine-computed and human-selected)
 *  - Valuation drivers, suppressors, and uncertainty factors
 *  - Benchmark and calibration summaries
 *  - Override / assumption metadata
 *  - Explanation ledger (full traceability)
 *  - Negotiation handoff object (anchors + strengths/weaknesses only)
 *
 * Contract version: 1.0.0
 */

import type { ExplanationLedger } from "./explanation-ledger";
import type {
  AssumptionCategory,
  DriverFamily,
  ValuationRunAssumptionSummary,
} from "./evaluate-persistence";

// ─── Package Publication State ──────────────────────────

export type EvaluatePackagePublicationState =
  | "draft"
  | "accepted"
  | "overridden"
  | "published";

export const VALID_PUBLICATION_TRANSITIONS: Record<
  EvaluatePackagePublicationState,
  EvaluatePackagePublicationState[]
> = {
  draft: ["accepted", "overridden"],
  accepted: ["published"],
  overridden: ["published"],
  published: [],
};

// ─── Confidence Level ───────────────────────────────────

export type EvalConfidenceLevel = "high" | "moderate" | "low" | "insufficient";

// ─── Claim Profile ──────────────────────────────────────

export interface EvalClaimProfile {
  claimant_name: string;
  claimant_dob: string | null;
  date_of_loss: string;
  mechanism_of_loss: string;
  jurisdiction_state: string;
  venue_county: string | null;
  policy_type: string;
  policy_limits: number | null;
  comparative_negligence_pct: number | null;
  /** Number of accepted injuries */
  injury_count: number;
  /** Number of distinct providers */
  provider_count: number;
  /** Total treatment duration in days */
  treatment_duration_days: number | null;
}

// ─── Merits Assessment ──────────────────────────────────

export interface EvalMeritsAssessment {
  /** Overall merits score: 0–100 */
  merits_score: number;
  /** Qualitative label */
  merits_label: "strong" | "above_average" | "average" | "below_average" | "weak";
  /** Merits corridor — the raw, pre-adjustment range */
  corridor_floor: number | null;
  corridor_likely: number | null;
  corridor_stretch: number | null;
  /** Key factors contributing to the merits score */
  contributing_factors: string[];
}

// ─── Adjusted Settlement Corridor ───────────────────────

export interface EvalSettlementCorridor {
  /** Engine-computed corridor */
  range_floor: number | null;
  range_likely: number | null;
  range_stretch: number | null;
  /** Confidence in the corridor */
  confidence: number | null;
  confidence_level: EvalConfidenceLevel;
  /** Human-selected working range (may differ from engine range) */
  selected_floor: number | null;
  selected_likely: number | null;
  selected_stretch: number | null;
  /** Authority recommendation */
  authority_recommendation: number | null;
  rationale_notes: string;
}

// ─── Documentation Sufficiency ──────────────────────────

export interface EvalDocumentationSufficiency {
  /** Overall documentation sufficiency score: 0–100 */
  score: number;
  /** Qualitative label */
  label: "sufficient" | "adequate" | "limited" | "insufficient";
  /** Specific gaps or strengths */
  findings: string[];
  /** Fields with incomplete data from upstream */
  incomplete_fields: string[];
}

// ─── Factor Summary ─────────────────────────────────────

export interface EvalFactorSummary {
  factor_key: string;
  label: string;
  family: DriverFamily;
  direction: "expander" | "reducer" | "neutral";
  /** Normalized score: 0–100 */
  score: number;
  /** Impact magnitude on the corridor */
  impact_description: string;
  /** Human-readable narrative */
  narrative: string;
  /** Evidence reference IDs */
  evidence_ref_ids: string[];
}

// ─── Benchmark Summary ──────────────────────────────────

export interface EvalBenchmarkSummary {
  /** Number of comparable claims found */
  comparable_claim_count: number;
  /** Median settlement of comparables */
  comparable_median: number | null;
  /** P25 / P75 range of comparables */
  comparable_p25: number | null;
  comparable_p75: number | null;
  /** Key matching criteria used */
  matching_criteria: string[];
  /** Confidence in benchmark match quality */
  match_quality: "strong" | "moderate" | "weak" | "no_match";
  /** Calibration config version used */
  calibration_config_version: number | null;
}

// ─── Post-Merit Adjustment Summary ──────────────────────

export interface EvalPostMeritAdjustment {
  adjustment_key: string;
  label: string;
  direction: "increase" | "decrease" | "constraint";
  /** Dollar or percentage impact */
  impact_value: number | null;
  impact_unit: "dollars" | "percentage" | "multiplier";
  reason: string;
}

// ─── Override Record ────────────────────────────────────

export interface EvalOverrideRecord {
  override_key: string;
  category: AssumptionCategory;
  original_value: string;
  override_value: string;
  reason: string;
  overridden_by: string;
  overridden_at: string;
}

// ─── Adopted Assumption ─────────────────────────────────

export interface EvalAdoptedAssumption {
  category: AssumptionCategory;
  key: string;
  value: string;
  reason: string;
  adopted_by: string | null;
  adopted_at: string | null;
}

// ─── Negotiation Handoff ────────────────────────────────
/**
 * The handoff object provides NegotiateIQ with anchoring data
 * and a summary of strengths/weaknesses. It does NOT contain
 * negotiation strategy, settlement automation, or attorney scoring.
 */

export interface EvalNegotiationHandoff {
  /** Recommended opening anchor for negotiation */
  recommended_opening_anchor: number | null;
  /** Suggested target settlement */
  suggested_target: number | null;
  /** Walk-away floor */
  walk_away_floor: number | null;
  /** Key strengths to leverage (evidence-linked) */
  key_strengths: EvalHandoffPoint[];
  /** Key weaknesses / vulnerabilities */
  key_weaknesses: EvalHandoffPoint[];
  /** Significant uncertainty factors */
  key_uncertainties: EvalHandoffPoint[];
  /** Total reviewed specials for reference */
  total_reviewed_specials: number;
  /** Policy limits constraint */
  policy_limits: number | null;
}

export interface EvalHandoffPoint {
  label: string;
  description: string;
  impact: "high" | "medium" | "low";
  evidence_ref_ids: string[];
}

// ─── Audit Metadata ─────────────────────────────────────

export interface EvalPackageAuditMetadata {
  /** Who accepted/published the package */
  accepted_by: string | null;
  accepted_at: string | null;
  /** Who overrode the engine range (if applicable) */
  overridden_by: string | null;
  overridden_at: string | null;
  /** Who published the final package */
  published_by: string | null;
  published_at: string | null;
  /** Change reason for overrides */
  override_reason: string | null;
}

// ─── Root Contract ──────────────────────────────────────

export interface EvaluatePackageV1 {
  /** Contract identifier */
  contract_version: string;

  // ── Identity ──
  case_id: string;
  claim_id: string;
  evaluation_id: string;
  tenant_id: string;

  // ── Package versioning ──
  package_version: number;
  evaluation_status: EvaluatePackagePublicationState;

  // ── Scoring / logic versions ──
  scoring_logic_version: string;
  benchmark_logic_version: string;
  engine_version: string;

  // ── Source lineage ──
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  snapshot_id: string | null;
  valuation_run_id: string | null;
  selection_id: string | null;

  // ── Claim profile ──
  claim_profile: EvalClaimProfile;

  // ── Merits ──
  merits: EvalMeritsAssessment;

  // ── Settlement corridor ──
  settlement_corridor: EvalSettlementCorridor;

  // ── Documentation ──
  documentation_sufficiency: EvalDocumentationSufficiency;

  // ── Factors ──
  factor_summaries: EvalFactorSummary[];
  top_drivers: EvalFactorSummary[];
  top_suppressors: EvalFactorSummary[];
  top_uncertainty_drivers: EvalFactorSummary[];

  // ── Benchmarks ──
  benchmark_summary: EvalBenchmarkSummary;

  // ── Post-merit adjustments ──
  post_merit_adjustments: EvalPostMeritAdjustment[];

  // ── Driver summaries (legacy compat) ──
  driver_summaries: ValuationRunAssumptionSummary[];

  // ── Explanation ──
  explanation_ledger: ExplanationLedger | null;

  // ── Assumptions and overrides ──
  assumptions: EvalAdoptedAssumption[];
  overrides: EvalOverrideRecord[];

  // ── Medical totals ──
  total_billed: number;
  total_reviewed: number;

  // ── Completeness ──
  completeness_score: number;

  // ── Negotiation handoff ──
  negotiation_handoff: EvalNegotiationHandoff;

  // ── Audit metadata ──
  audit: EvalPackageAuditMetadata;

  // ── Timestamps ──
  generated_at: string;
  created_at: string;
}

export const EVALUATE_PACKAGE_CONTRACT_VERSION = "1.0.0";
