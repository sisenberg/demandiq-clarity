/**
 * ReviewerIQ — Policy Overlay & Calibration Types
 * Versioned, auditable overlay framework for specialty review logic.
 *
 * Overlay chain order: jurisdiction → client → program → claim_type → specialty
 * Later overlays may override earlier overlays.
 * Original base recommendation is always preserved for audit.
 */

// ─── Enums ─────────────────────────────────────────────

export type OverlayScope =
  | "jurisdiction"
  | "client"
  | "program"
  | "claim_type"
  | "specialty";

export type RuleActionType =
  | "threshold_adjustment"
  | "reimbursement_adjustment"
  | "escalation_override"
  | "issue_suppression"
  | "issue_activation"
  | "explanation_append";

export type CalibrationResultType =
  | "match"
  | "partial_match"
  | "false_positive"
  | "false_negative"
  | "needs_review";

export type SeverityMode =
  | "informational"
  | "warning"
  | "escalation";

// ─── Labels ────────────────────────────────────────────

export const OVERLAY_SCOPE_LABEL: Record<OverlayScope, string> = {
  jurisdiction: "Jurisdiction",
  client: "Client",
  program: "Program",
  claim_type: "Claim Type",
  specialty: "Specialty",
};

export const RULE_ACTION_TYPE_LABEL: Record<RuleActionType, string> = {
  threshold_adjustment: "Threshold Adjustment",
  reimbursement_adjustment: "Reimbursement Adjustment",
  escalation_override: "Escalation Override",
  issue_suppression: "Issue Suppression",
  issue_activation: "Issue Activation",
  explanation_append: "Explanation Append",
};

export const CALIBRATION_RESULT_LABEL: Record<CalibrationResultType, string> = {
  match: "Match",
  partial_match: "Partial Match",
  false_positive: "False Positive",
  false_negative: "False Negative",
  needs_review: "Needs Review",
};

// ─── Overlay Chain Order ───────────────────────────────

export const OVERLAY_CHAIN_ORDER: OverlayScope[] = [
  "jurisdiction",
  "client",
  "program",
  "claim_type",
  "specialty",
];

// ─── Policy Profile ───────────────────────────────────

export interface PolicyProfile {
  id: string;
  name: string;
  description: string;
  scope: OverlayScope;
  /** e.g. "FL", "client-acme", "WC", "auto" */
  scope_value: string;
  version: number;
  is_active: boolean;
  effective_date: string;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  change_reason: string;
}

export interface PolicyProfileVersion {
  id: string;
  profile_id: string;
  version: number;
  snapshot: PolicyProfile;
  rules_snapshot: OverlayRule[];
  created_by: string;
  created_at: string;
  change_reason: string;
}

// ─── Overlay Rules ─────────────────────────────────────

export interface OverlayRule {
  id: string;
  profile_id: string;
  name: string;
  description: string;
  is_active: boolean;
  /** The base rule ID or issue type this overlays */
  target_rule_id: string | null;
  target_issue_type: string | null;
  /** Conditions for when this overlay fires */
  conditions: OverlayRuleCondition[];
  /** Actions to take when conditions match */
  actions: OverlayRuleAction[];
  /** Priority within same scope (higher wins) */
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface OverlayRuleCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value: string | number | string[];
}

export interface OverlayRuleAction {
  type: RuleActionType;
  /** For threshold_adjustment: field name to modify */
  target_field: string | null;
  /** For threshold_adjustment: new value or delta */
  value: string | number | null;
  /** For explanation_append */
  text: string | null;
  /** For escalation_override */
  severity_mode: SeverityMode | null;
}

// ─── Applied Overlay Record ────────────────────────────

/** Tracks which overlays were applied to a recommendation for provenance */
export interface AppliedOverlay {
  profile_id: string;
  profile_name: string;
  profile_version: number;
  scope: OverlayScope;
  scope_value: string;
  rule_id: string;
  rule_name: string;
  action_type: RuleActionType;
  field_changed: string | null;
  original_value: string | number | null;
  adjusted_value: string | number | null;
  reason: string;
}

/** Extended recommendation with overlay provenance */
export interface OverlayAdjustedRecommendation {
  /** Original base recommendation (immutable) */
  base_support_level: import("@/types/specialty-review").SupportLevel;
  base_documentation_score: number;
  base_coding_score: number;
  base_necessity_score: number;
  base_escalation_required: boolean;
  base_issue_count: number;
  /** Overlay-adjusted values */
  adjusted_support_level: import("@/types/specialty-review").SupportLevel;
  adjusted_documentation_score: number;
  adjusted_coding_score: number;
  adjusted_necessity_score: number;
  adjusted_escalation_required: boolean;
  /** Provenance */
  applied_overlays: AppliedOverlay[];
  overlay_explanation_additions: string[];
  suppressed_issue_ids: string[];
  activated_issue_labels: string[];
}

// ─── Reviewer Feedback ─────────────────────────────────

export type ReviewerOverrideReason =
  | "documentation_stronger_than_detected"
  | "documentation_weaker_than_detected"
  | "jurisdiction_client_preference"
  | "treatment_progression_acceptable"
  | "causation_concern"
  | "coding_issue_not_applicable"
  | "duplicate_flag_incorrect"
  | "other";

export const OVERRIDE_REASON_LABEL: Record<ReviewerOverrideReason, string> = {
  documentation_stronger_than_detected: "Documentation stronger than system detected",
  documentation_weaker_than_detected: "Documentation weaker than system detected",
  jurisdiction_client_preference: "Jurisdiction/client preference",
  treatment_progression_acceptable: "Treatment progression acceptable",
  causation_concern: "Causation concern",
  coding_issue_not_applicable: "Coding issue not applicable",
  duplicate_flag_incorrect: "Duplicate flag incorrect",
  other: "Other",
};

export interface ReviewerFeedbackEvent {
  id: string;
  recommendation_id: string;
  case_id: string;
  user_id: string;
  timestamp: string;
  override_reason: ReviewerOverrideReason;
  free_text_reason: string;
  original_support_level: import("@/types/specialty-review").SupportLevel;
  final_support_level: import("@/types/specialty-review").SupportLevel;
  rule_ids_involved: string[];
  original_scores: {
    documentation: number;
    coding: number;
    necessity: number;
  };
}

// ─── Calibration ───────────────────────────────────────

export interface CalibrationCase {
  id: string;
  name: string;
  specialty: import("@/types/specialty-review").SpecialtyType;
  description: string;
  /** Structured test data */
  treatments: import("@/hooks/useReviewerTreatments").ReviewerTreatmentRecord[];
  bill_lines: import("@/types/reviewer-bills").ReviewerBillLine[];
  /** Expected outcomes */
  expected: CalibrationExpectedOutcome;
  created_at: string;
  updated_at: string;
}

export interface CalibrationExpectedOutcome {
  support_level: import("@/types/specialty-review").SupportLevel;
  escalation_required: boolean;
  min_issue_count: number;
  max_issue_count: number;
  required_issue_types: import("@/types/specialty-review").SpecialtyIssueType[];
  forbidden_issue_types: import("@/types/specialty-review").SpecialtyIssueType[];
  min_documentation_score: number;
  max_documentation_score: number;
  min_necessity_score: number;
  max_necessity_score: number;
  expected_adjustment_categories: string[];
}

export interface CalibrationRun {
  id: string;
  engine_version: string;
  profile_version: string | null;
  profile_id: string | null;
  run_at: string;
  run_by: string;
  total_cases: number;
  match_count: number;
  partial_match_count: number;
  false_positive_count: number;
  false_negative_count: number;
  needs_review_count: number;
  results: CalibrationRunResult[];
}

export interface CalibrationRunResult {
  calibration_case_id: string;
  calibration_case_name: string;
  specialty: import("@/types/specialty-review").SpecialtyType;
  result_type: CalibrationResultType;
  expected_support_level: import("@/types/specialty-review").SupportLevel;
  actual_support_level: import("@/types/specialty-review").SupportLevel;
  expected_escalation: boolean;
  actual_escalation: boolean;
  expected_issue_types: string[];
  actual_issue_types: string[];
  false_positive_issues: string[];
  false_negative_issues: string[];
  score_deltas: {
    documentation: number;
    coding: number;
    necessity: number;
  };
  mismatches: string[];
}

// ─── Rule Performance ──────────────────────────────────

export interface RulePerformanceMetric {
  rule_id: string;
  rule_name: string;
  specialty: import("@/types/specialty-review").SpecialtyType | "all";
  total_firings: number;
  override_count: number;
  override_rate: number;
  top_override_reasons: { reason: ReviewerOverrideReason; count: number }[];
  false_positive_rate: number;
  false_negative_rate: number;
  avg_confidence_when_fired: number;
}

// ─── Safety Constants ──────────────────────────────────

/** Issue types that cannot be suppressed without admin permission */
export const PROTECTED_ESCALATION_CATEGORIES = new Set([
  "surgery",
  "opioid_escalation",
  "repeat_invasive_pain",
  "major_imaging_treatment_mismatch",
]);

export const OVERLAY_ENGINE_VERSION = "1.0.0";
