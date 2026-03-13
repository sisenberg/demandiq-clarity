/**
 * EvaluateIQ — ReviewPackage v1 Intake Contract
 *
 * Typed contract for the ReviewerIQ package as consumed by EvaluateIQ.
 * This is the formal intake boundary — EvaluateIQ never reaches past this
 * contract into ReviewerIQ internals.
 *
 * Contract version: 1.0.0
 */

// ─── Evidence Citation ──────────────────────────────────

export interface ReviewPackageCitation {
  source_document_id: string | null;
  source_page: number | null;
  quoted_text: string;
  relevance_type: "direct" | "corroborating" | "contradicting" | "contextual";
}

// ─── Reviewer Confirmation State ────────────────────────

export type ReviewerConfirmationState =
  | "ai_suggested"
  | "reviewer_accepted"
  | "reviewer_corrected"
  | "reviewer_rejected"
  | "unreviewed";

export interface ReviewerConfirmation {
  state: ReviewerConfirmationState;
  reviewed_by: string | null;
  reviewed_at: string | null;
  correction_notes: string | null;
}

// ─── Extraction Confidence ──────────────────────────────

export interface ExtractionConfidence {
  score: number | null;
  label: "high" | "medium" | "low" | "unknown";
  model: string | null;
  model_version: string | null;
}

// ─── Package Metadata ───────────────────────────────────

export interface ReviewPackageMetadata {
  package_id: string;
  contract_version: string;
  case_id: string;
  claim_id: string;
  tenant_id: string;
  /** ReviewerIQ module version */
  module_version: string;
  /** Package publication version (1, 2, 3…) */
  package_version: number;
  published_at: string;
  published_by: string | null;
  /** Upstream source consumed by ReviewerIQ */
  upstream_source: {
    module_id: "demandiq";
    package_version: number;
    snapshot_id: string | null;
  };
}

// ─── Evaluation Context ─────────────────────────────────

export interface EvaluationContext {
  jurisdiction_state: string;
  venue_county: string | null;
  date_of_loss: string;
  mechanism_of_loss: string;
  claimant_name: string;
  claimant_dob: string | null;
  policy_type: string;
  policy_limits: number | null;
  comparative_negligence_pct: number | null;
}

// ─── Injury Records ─────────────────────────────────────

export interface ReviewPackageInjury {
  id: string;
  body_part: string;
  body_region: string;
  diagnosis_description: string;
  diagnosis_code: string;
  severity: string;
  is_pre_existing: boolean;
  date_of_onset: string | null;
  /** ReviewerIQ acceptance state */
  acceptance_status: "accepted" | "disputed" | "modified";
  dispute_reason: string | null;
  confirmation: ReviewerConfirmation;
  extraction_confidence: ExtractionConfidence;
  citations: ReviewPackageCitation[];
}

// ─── Treatment Timeline ─────────────────────────────────

export interface ReviewPackageTreatment {
  id: string;
  treatment_type: string;
  treatment_date: string | null;
  treatment_end_date: string | null;
  description: string;
  procedure_codes: string[];
  provider_name: string;
  facility_name: string;
  /** ReviewerIQ reasonableness/necessity finding */
  reasonableness_finding: "reasonable" | "questionable" | "unreasonable" | "insufficient_info" | "pending";
  necessity_finding: "necessary" | "questionable" | "unnecessary" | "insufficient_info" | "pending";
  reviewer_rationale: string;
  guideline_refs: string[];
  confirmation: ReviewerConfirmation;
  extraction_confidence: ExtractionConfidence;
  citations: ReviewPackageCitation[];
}

// ─── Provider List ──────────────────────────────────────

export interface ReviewPackageProvider {
  id: string;
  full_name: string;
  normalized_name: string | null;
  specialty: string;
  facility_name: string;
  npi: string | null;
  total_visits: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
  total_billed: number;
  total_reviewed: number;
  total_accepted: number;
  confirmation: ReviewerConfirmation;
}

// ─── Visit Chronology ───────────────────────────────────

export interface ReviewPackageVisit {
  id: string;
  visit_date: string;
  provider_name: string;
  facility_name: string;
  visit_type: string;
  procedure_codes: string[];
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  citations: ReviewPackageCitation[];
}

// ─── Diagnosis Summaries ────────────────────────────────

export interface ReviewPackageDiagnosisSummary {
  diagnosis_code: string;
  description: string;
  body_part: string;
  severity: string;
  first_documented: string | null;
  last_documented: string | null;
  supporting_visit_count: number;
  acceptance_status: "accepted" | "disputed" | "modified";
}

// ─── Procedure Summaries ────────────────────────────────

export interface ReviewPackageProcedureSummary {
  procedure_code: string;
  description: string;
  total_instances: number;
  total_billed: number;
  total_reviewed: number;
  reasonableness_consensus: "reasonable" | "mixed" | "questionable" | "unreasonable";
}

// ─── Objective Findings ─────────────────────────────────

export interface ObjectiveFindingsSummary {
  has_objective_findings: boolean;
  finding_categories: string[];
  summary: string;
  citations: ReviewPackageCitation[];
}

// ─── Imaging Summary ────────────────────────────────────

export interface ImagingSummary {
  has_imaging: boolean;
  imaging_types: string[];
  key_findings: string[];
  abnormalities_documented: boolean;
  citations: ReviewPackageCitation[];
}

// ─── Hospitalization / Surgery / Impairment ─────────────

export interface HospitalizationIndicators {
  was_hospitalized: boolean;
  total_days: number | null;
  facilities: string[];
  citations: ReviewPackageCitation[];
}

export interface SurgeryIndicators {
  had_surgery: boolean;
  surgery_count: number;
  procedure_descriptions: string[];
  post_surgical_complications: string[];
  citations: ReviewPackageCitation[];
}

export interface ImpairmentEvidence {
  has_permanency_indicators: boolean;
  has_impairment_rating: boolean;
  impairment_rating_value: string | null;
  impairment_source: string | null;
  permanency_narrative: string;
  citations: ReviewPackageCitation[];
}

export interface FunctionalLimitationEvidence {
  has_functional_limitations: boolean;
  limitation_categories: string[];
  summary: string;
  citations: ReviewPackageCitation[];
}

export interface WorkRestrictionEvidence {
  has_work_restrictions: boolean;
  restriction_type: "none" | "light_duty" | "partial" | "full" | "unknown";
  duration_description: string | null;
  summary: string;
  citations: ReviewPackageCitation[];
}

// ─── Treatment Gaps ─────────────────────────────────────

export interface TreatmentGap {
  id: string;
  gap_start_date: string;
  gap_end_date: string;
  gap_days: number;
  preceding_provider: string | null;
  following_provider: string | null;
  explanation: string | null;
  is_explained: boolean;
  severity: "info" | "warning" | "critical";
}

// ─── Reasonableness & Necessity ─────────────────────────

export interface MedicalReasonablenessFindings {
  overall_assessment: "reasonable" | "mostly_reasonable" | "mixed" | "questionable" | "unreasonable";
  total_treatments_reviewed: number;
  reasonable_count: number;
  questionable_count: number;
  unreasonable_count: number;
  insufficient_info_count: number;
  key_findings: string[];
  guideline_references: string[];
}

// ─── Reviewed Specials Summary ──────────────────────────

export interface ReviewedSpecialsSummary {
  total_billed: number;
  total_reviewed: number;
  total_accepted: number;
  total_reduced: number;
  total_disputed: number;
  reduction_percentage: number;
  by_provider: {
    provider_name: string;
    billed: number;
    accepted: number;
    reduced: number;
    disputed: number;
  }[];
  by_category: {
    category: string;
    billed: number;
    accepted: number;
  }[];
}

// ─── Unresolved Medical Issues ──────────────────────────

export interface UnresolvedMedicalIssue {
  id: string;
  issue_type: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  affected_provider: string | null;
  questioned_amount: number;
  citations: ReviewPackageCitation[];
}

// ─── Root Contract ──────────────────────────────────────

export interface ReviewPackageV1 {
  metadata: ReviewPackageMetadata;
  evaluation_context: EvaluationContext;

  /** Accepted injuries (reviewer-confirmed) */
  accepted_injuries: ReviewPackageInjury[];
  /** Disputed injuries (reviewer-flagged) */
  disputed_injuries: ReviewPackageInjury[];

  /** Accepted treatment timeline */
  accepted_treatments: ReviewPackageTreatment[];

  /** Provider list with normalization */
  providers: ReviewPackageProvider[];

  /** Visit chronology (SOAP-structured) */
  visit_chronology: ReviewPackageVisit[];

  /** Diagnosis summaries */
  diagnosis_summaries: ReviewPackageDiagnosisSummary[];

  /** Procedure summaries */
  procedure_summaries: ReviewPackageProcedureSummary[];

  /** Objective findings */
  objective_findings: ObjectiveFindingsSummary;

  /** Imaging summary */
  imaging_summary: ImagingSummary;

  /** Hospitalization indicators */
  hospitalization_indicators: HospitalizationIndicators;

  /** Surgery indicators */
  surgery_indicators: SurgeryIndicators;

  /** Impairment / permanency evidence */
  impairment_evidence: ImpairmentEvidence;

  /** Functional limitation evidence */
  functional_limitations: FunctionalLimitationEvidence;

  /** Work restriction evidence */
  work_restrictions: WorkRestrictionEvidence;

  /** Treatment gaps with explanations */
  treatment_gaps: TreatmentGap[];

  /** Medical reasonableness / necessity findings */
  reasonableness_findings: MedicalReasonablenessFindings;

  /** Reviewed specials summary */
  reviewed_specials: ReviewedSpecialsSummary;

  /** Unresolved medical issues */
  unresolved_issues: UnresolvedMedicalIssue[];

  /** All evidence citations */
  evidence_citations: ReviewPackageCitation[];
}

export const REVIEW_PACKAGE_CONTRACT_VERSION = "1.0.0";
