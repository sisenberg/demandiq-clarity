/**
 * EvaluateIQ — Intake Snapshot Types
 *
 * The normalized, read-only snapshot that EvaluateIQ ingests from upstream
 * modules (ReviewerIQ or DemandIQ). This is the source-of-truth import layer;
 * human valuation assumptions are stored separately.
 */

// ─── Field Provenance ───────────────────────────────────

export interface FieldProvenance {
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  /** Evidence reference IDs backing this field */
  evidence_ref_ids: string[];
  confidence: number | null;
  /** Whether the field has meaningful data */
  completeness: "complete" | "partial" | "missing";
}

/** Wraps a value with provenance metadata */
export interface ProvenancedField<T> {
  value: T;
  provenance: FieldProvenance;
}

// ─── Snapshot Sections ──────────────────────────────────

export interface EvalClaimantIdentity {
  claimant_name: ProvenancedField<string>;
  date_of_birth: ProvenancedField<string | null>;
  occupation: ProvenancedField<string | null>;
  employer: ProvenancedField<string | null>;
}

export interface EvalAccidentFacts {
  date_of_loss: ProvenancedField<string>;
  mechanism_of_loss: ProvenancedField<string>;
  description: ProvenancedField<string>;
}

export interface EvalLiabilityFact {
  id: string;
  fact_text: string;
  supports_liability: boolean;
  confidence: number | null;
  provenance: FieldProvenance;
}

export interface EvalComparativeNegligence {
  claimant_negligence_percentage: ProvenancedField<number | null>;
  notes: ProvenancedField<string>;
}

export interface EvalVenueJurisdiction {
  jurisdiction_state: ProvenancedField<string>;
  venue_county: ProvenancedField<string | null>;
}

export interface EvalPolicyCoverage {
  carrier_name: string;
  policy_type: string;
  coverage_limit: number | null;
  deductible: number | null;
  provenance: FieldProvenance;
}

export interface EvalInjury {
  id: string;
  body_part: string;
  body_region: string;
  diagnosis_description: string;
  diagnosis_code: string;
  severity: string;
  is_pre_existing: boolean;
  date_of_onset: string | null;
  provenance: FieldProvenance;
}

export interface EvalTreatmentEntry {
  id: string;
  treatment_type: string;
  treatment_date: string | null;
  treatment_end_date: string | null;
  description: string;
  procedure_codes: string[];
  provider_name: string;
  facility_name: string;
  provenance: FieldProvenance;
}

export interface EvalProvider {
  id: string;
  full_name: string;
  specialty: string;
  facility_name: string;
  role_description: string;
  total_visits: number;
  first_visit_date: string | null;
  last_visit_date: string | null;
  total_billed: number;
  total_paid: number;
  provenance: FieldProvenance;
}

export interface EvalMedicalBilling {
  id: string;
  description: string;
  service_date: string | null;
  cpt_codes: string[];
  billed_amount: number;
  paid_amount: number | null;
  /** From ReviewerIQ — recommended/adjusted amount */
  reviewer_recommended_amount: number | null;
  provider_name: string;
  provenance: FieldProvenance;
}

export interface EvalWageLoss {
  total_lost_wages: ProvenancedField<number>;
  duration_description: ProvenancedField<string | null>;
}

export interface EvalFutureTreatment {
  future_medical_estimate: ProvenancedField<number>;
  indicators: ProvenancedField<string[]>;
}

// ─── Clinical Flags ─────────────────────────────────────

export interface EvalClinicalFlags {
  has_surgery: boolean;
  has_injections: boolean;
  has_advanced_imaging: boolean;
  has_permanency_indicators: boolean;
  has_impairment_rating: boolean;
  has_scarring_disfigurement: boolean;
  provenance: FieldProvenance;
}

// ─── Upstream Issues / Concerns ─────────────────────────

export interface EvalUpstreamConcern {
  id: string;
  category: "gap" | "credibility" | "compliance" | "causation" | "documentation" | "coding" | "other";
  description: string;
  severity: "info" | "warning" | "critical";
  provenance: FieldProvenance;
}

// ─── Completeness Assessment ────────────────────────────

export type FieldCompleteness = "complete" | "partial" | "missing";

export interface CompletenessWarning {
  field: string;
  label: string;
  status: FieldCompleteness;
  message: string;
}

// ─── Root Snapshot ──────────────────────────────────────

export interface EvaluateIntakeSnapshot {
  /** Snapshot metadata */
  snapshot_id: string;
  case_id: string;
  tenant_id: string;
  created_at: string;
  created_by: string | null;

  /** Source metadata */
  source_module: "demandiq" | "revieweriq";
  source_package_version: number;
  source_snapshot_id: string | null;

  /** Sections */
  claimant: EvalClaimantIdentity;
  accident: EvalAccidentFacts;
  liability_facts: EvalLiabilityFact[];
  comparative_negligence: EvalComparativeNegligence;
  venue_jurisdiction: EvalVenueJurisdiction;
  policy_coverage: EvalPolicyCoverage[];
  injuries: EvalInjury[];
  treatment_timeline: EvalTreatmentEntry[];
  providers: EvalProvider[];
  medical_billing: EvalMedicalBilling[];
  wage_loss: EvalWageLoss;
  future_treatment: EvalFutureTreatment;
  clinical_flags: EvalClinicalFlags;
  upstream_concerns: EvalUpstreamConcern[];

  /** Completeness summary */
  completeness_warnings: CompletenessWarning[];
  overall_completeness_score: number; // 0–100
}
