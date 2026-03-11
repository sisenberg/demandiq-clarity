/**
 * ReviewerIQ — Specialty Review Logic Pack v1
 * Domain entities, enums, and interfaces for specialty-specific clinical review.
 *
 * Architecture: 3-layer rules
 *   1. Base coding/payment (NCCI/PTP, MUE, therapy units, global surgery)
 *   2. Specialty clinical logic (utilization, documentation, progression)
 *   3. Jurisdiction/client overlay (state rules, fee schedules, carrier prefs)
 *
 * NEVER outputs "deny care" — uses support_level enum instead.
 */

// ─── Core Enums ────────────────────────────────────────

export type SpecialtyType =
  | "chiro"
  | "pt"
  | "ortho"
  | "pain_management"
  | "radiology"
  | "surgery";

export type SupportLevel =
  | "supported"
  | "partially_supported"
  | "weakly_supported"
  | "unsupported"
  | "escalate";

export type SpecialtyIssueType =
  | "documentation"
  | "coding"
  | "medical_necessity"
  | "duplication"
  | "progression"
  | "causation"
  | "utilization"
  | "bundling"
  | "timing";

export type EpisodePhase =
  | "acute"
  | "subacute"
  | "chronic"
  | "postop";

// ─── Labels ────────────────────────────────────────────

export const SPECIALTY_LABEL: Record<SpecialtyType, string> = {
  chiro: "Chiropractic",
  pt: "Physical Therapy",
  ortho: "Orthopedics",
  pain_management: "Pain Management",
  radiology: "Radiology",
  surgery: "Surgery",
};

export const SUPPORT_LEVEL_LABEL: Record<SupportLevel, string> = {
  supported: "Supported",
  partially_supported: "Partially Supported",
  weakly_supported: "Weakly Supported",
  unsupported: "Unsupported",
  escalate: "Escalate for Human Review",
};

export const SPECIALTY_ISSUE_TYPE_LABEL: Record<SpecialtyIssueType, string> = {
  documentation: "Documentation",
  coding: "Coding",
  medical_necessity: "Medical Necessity",
  duplication: "Duplication",
  progression: "Progression",
  causation: "Causation",
  utilization: "Utilization",
  bundling: "Bundling",
  timing: "Timing",
};

export const EPISODE_PHASE_LABEL: Record<EpisodePhase, string> = {
  acute: "Acute",
  subacute: "Subacute",
  chronic: "Chronic",
  postop: "Post-Operative",
};

// ─── Domain Entities ───────────────────────────────────

export interface EpisodeOfCare {
  id: string;
  case_id: string;
  provider_name: string;
  specialty: SpecialtyType;
  body_region: string;
  laterality: string | null;
  diagnosis_cluster: string[];
  phase: EpisodePhase;
  date_start: string;
  date_end: string;
  visit_count: number;
  treatment_ids: string[];
  bill_line_ids: string[];
}

export interface ClinicalFindings {
  rom_deficits: string[];
  strength_deficits: string[];
  neurological_deficits: string[];
  special_tests: string[];
  swelling_instability: string[];
  pain_scores: { date: string; score: number }[];
}

export interface FunctionalOutcome {
  metric: string;
  baseline_value: string;
  current_value: string;
  date_measured: string;
  improved: boolean | null;
}

export interface ImagingFinding {
  study_type: string;
  date: string;
  body_region: string;
  laterality: string | null;
  findings_summary: string;
  classification: "acute_traumatic" | "chronic_degenerative" | "incidental" | "mixed";
  supports_downstream_care: boolean;
  source_document_id: string | null;
  source_page: number | null;
}

export interface ProcedureJustification {
  procedure_code: string;
  procedure_description: string;
  indication: string;
  prior_conservative_care_completed: boolean;
  imaging_concordance: boolean;
  exam_concordance: boolean;
  objective_deficits_documented: boolean;
  urgent_exception: boolean;
  urgent_reason: string | null;
}

export interface ResponseToPriorTreatment {
  treatment_type: string;
  duration_weeks: number;
  response: "significant_improvement" | "moderate_improvement" | "minimal_improvement" | "no_improvement" | "worsened" | "unknown";
  documentation_quality: "well_documented" | "partially_documented" | "undocumented";
}

export interface ReimbursementAdjustmentReason {
  code: string;
  description: string;
  adjustment_type: "reduce" | "bundle" | "deny_line" | "flag_review";
  amount_impact: number | null;
  basis: string;
}

// ─── Review Recommendation (output per episode/line) ───

export interface SpecialtyReviewRecommendation {
  id: string;
  case_id: string;
  episode_id: string;
  specialty_type: SpecialtyType;
  provider: string;
  dates_of_service: { start: string; end: string };
  body_region: string;
  laterality: string | null;
  diagnosis_cluster: string[];
  episode_phase: EpisodePhase;
  /** Scores (0–100) */
  documentation_sufficiency_score: number;
  coding_integrity_score: number;
  necessity_support_score: number;
  /** Overall */
  support_level: SupportLevel;
  confidence: number;
  escalation_required: boolean;
  /** Details */
  issue_tags: SpecialtyIssueTag[];
  reimbursement_adjustments: ReimbursementAdjustmentReason[];
  narrative_explanation: string;
  evidence_links: SpecialtyEvidenceLink[];
  /** Reviewer override */
  reviewer_override: ReviewerOverride | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialtyIssueTag {
  type: SpecialtyIssueType;
  label: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
}

export interface SpecialtyEvidenceLink {
  source_document_id: string | null;
  source_page: number | null;
  quoted_text: string;
  relevance: string;
}

export interface ReviewerOverride {
  original_support_level: SupportLevel;
  override_support_level: SupportLevel;
  reason: string;
  overridden_by: string;
  overridden_at: string;
}

// ─── Specialty Rule Profile ────────────────────────────

export interface SpecialtyRuleProfile {
  specialty: SpecialtyType;
  rule_set_version: string;
  /** Visit type codes that map to this specialty */
  visit_type_codes: string[];
  /** CPT code prefixes/ranges for classification */
  cpt_code_patterns: string[];
  /** Thresholds */
  max_acute_phase_days: number;
  max_subacute_phase_days: number;
  passive_modality_codes: string[];
  active_treatment_codes: string[];
  escalation_procedure_codes: string[];
}

// ─── Safety Constants ──────────────────────────────────

/** Issue types that ALWAYS require human review before finalization */
export const MANDATORY_ESCALATION_TYPES: SpecialtyType[] = ["surgery"];

/** Procedure categories requiring mandatory human review */
export const HIGH_RISK_PROCEDURE_CODES = new Set([
  // Surgery
  "22551", "63030", "29881", "27447", "23472",
  // Opioid management indicators
  "99213", // when flagged as opioid escalation
  // Repeat invasive pain procedures
  "64483", "64484", "62323", "27096",
]);

export const SPECIALTY_REVIEW_ENGINE_VERSION = "1.0.0";
