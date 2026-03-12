/**
 * EvaluateIQ — Test Fixtures
 *
 * Seven synthetic scenarios for smoke-testing the EvaluateIQ pipeline.
 * All data is fictional per docs/compliance/data-classification.md §2.
 *
 * SCENARIOS:
 *  1. Low-impact soft tissue, short conservative care
 *  2. High billed medicals with major ReviewerIQ reductions
 *  3. Surgery case with strong liability
 *  4. Surgery case with policy limit pressure
 *  5. Long chiro/PT case with treatment gap issues
 *  6. Comparative negligence case
 *  7. Venue-severity (plaintiff-friendly) case
 */

import type { EvaluateIntakeSnapshot, FieldProvenance, ProvenancedField, EvalClinicalFlags } from "@/types/evaluate-intake";

const T = "tenant-eval-fixture";
const NOW = "2026-03-01T00:00:00Z";

function prov(c: "complete" | "partial" | "missing" = "complete"): FieldProvenance {
  return { source_module: "demandiq", source_package_version: 1, completeness: c, confidence: 0.9, evidence_ref_ids: [] };
}

function f<T>(value: T, c: "complete" | "partial" | "missing" = "complete"): ProvenancedField<T> {
  return { value, provenance: prov(c) };
}

function baseFlags(overrides: Partial<EvalClinicalFlags> = {}): EvalClinicalFlags {
  return {
    has_surgery: false,
    has_injections: false,
    has_advanced_imaging: false,
    has_permanency_indicators: false,
    has_impairment_rating: false,
    has_scarring_disfigurement: false,
    provenance: prov(),
    ...overrides,
  };
}

function baseSnapshot(id: string, overrides: Partial<EvaluateIntakeSnapshot>): EvaluateIntakeSnapshot {
  return {
    snapshot_id: id,
    case_id: `case-eval-${id}`,
    tenant_id: T,
    created_at: NOW,
    created_by: "fixture-user",
    source_module: "demandiq",
    source_package_version: 1,
    source_snapshot_id: null,
    claimant: {
      claimant_name: f("Jane Doe"),
      date_of_birth: f("1985-03-15"),
      occupation: f("Office Manager"),
      employer: f("Acme Corp"),
    },
    accident: {
      date_of_loss: f("2025-06-01"),
      mechanism_of_loss: f("Rear-end collision"),
      description: f("Plaintiff's vehicle was struck from behind at a stoplight."),
    },
    liability_facts: [
      { id: "lf-1", fact_text: "Defendant rear-ended plaintiff at stoplight", supports_liability: true, confidence: 0.95, provenance: prov() },
      { id: "lf-2", fact_text: "Police report assigns fault to defendant", supports_liability: true, confidence: 0.9, provenance: prov() },
    ],
    comparative_negligence: {
      claimant_negligence_percentage: f(null),
      notes: f(""),
    },
    venue_jurisdiction: {
      jurisdiction_state: f("FL"),
      venue_county: f("Broward"),
    },
    policy_coverage: [
      { carrier_name: "State Farm", policy_type: "BI", coverage_limit: 100000, deductible: null, provenance: prov() },
    ],
    injuries: [
      {
        id: "inj-1", body_part: "Cervical Spine", body_region: "Neck",
        diagnosis_description: "Cervical strain", diagnosis_code: "S13.4XXA",
        severity: "moderate", is_pre_existing: false, date_of_onset: "2025-06-01", provenance: prov(),
      },
    ],
    treatment_timeline: [
      { id: "tx-1", treatment_type: "emergency", treatment_date: "2025-06-01", treatment_end_date: null, description: "ER visit", procedure_codes: ["99283"], provider_name: "Metro ER", facility_name: "Metro Hospital", provenance: prov() },
      { id: "tx-2", treatment_type: "physical_therapy", treatment_date: "2025-06-08", treatment_end_date: "2025-08-01", description: "PT evaluation and treatment", procedure_codes: ["97110"], provider_name: "PT Solutions", facility_name: "PT Solutions", provenance: prov() },
    ],
    providers: [
      { id: "pv-1", full_name: "Metro ER", specialty: "Emergency", facility_name: "Metro Hospital", role_description: "ER", total_visits: 1, first_visit_date: "2025-06-01", last_visit_date: "2025-06-01", total_billed: 3200, total_paid: 0, provenance: prov() },
    ],
    medical_billing: [
      { id: "bl-1", description: "ER visit", service_date: "2025-06-01", cpt_codes: ["99283"], billed_amount: 3200, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Metro ER", provenance: prov() },
      { id: "bl-2", description: "PT sessions (12)", service_date: "2025-06-08", cpt_codes: ["97110"], billed_amount: 4800, paid_amount: null, reviewer_recommended_amount: null, provider_name: "PT Solutions", provenance: prov() },
    ],
    wage_loss: { total_lost_wages: f(0), duration_description: f(null) },
    future_treatment: { future_medical_estimate: f(0), indicators: f([]) },
    clinical_flags: baseFlags(),
    upstream_concerns: [],
    completeness_warnings: [],
    overall_completeness_score: 72,
    ...overrides,
  };
}

// ─── Scenario 1: Low-impact soft tissue ─────────────────

export const SOFT_TISSUE_LOW_IMPACT = baseSnapshot("soft-tissue-low", {});

// ─── Scenario 2: High billed with major reviewer reductions ─

export const HIGH_BILLED_MAJOR_REDUCTIONS = baseSnapshot("high-billed-reduced", {
  medical_billing: [
    { id: "bl-hb-1", description: "ER visit", service_date: "2025-06-01", cpt_codes: ["99285"], billed_amount: 12000, paid_amount: null, reviewer_recommended_amount: 6500, provider_name: "General Hospital", provenance: prov() },
    { id: "bl-hb-2", description: "Chiropractic (48 sessions)", service_date: "2025-06-10", cpt_codes: ["98940"], billed_amount: 28800, paid_amount: null, reviewer_recommended_amount: 14400, provider_name: "Spine Chiro", provenance: prov() },
    { id: "bl-hb-3", description: "MRI cervical", service_date: "2025-07-01", cpt_codes: ["72141"], billed_amount: 4200, paid_amount: null, reviewer_recommended_amount: 2800, provider_name: "Imaging Center", provenance: prov() },
    { id: "bl-hb-4", description: "Pain mgmt consult", service_date: "2025-08-01", cpt_codes: ["99244"], billed_amount: 1500, paid_amount: null, reviewer_recommended_amount: 1200, provider_name: "Pain Clinic", provenance: prov() },
  ],
  clinical_flags: baseFlags({ has_advanced_imaging: true }),
  overall_completeness_score: 82,
});

// ─── Scenario 3: Surgery case, strong liability ─────────

export const SURGERY_STRONG_LIABILITY = baseSnapshot("surgery-strong-liab", {
  injuries: [
    { id: "inj-s1", body_part: "Lumbar Spine", body_region: "Lower Back", diagnosis_description: "L4-L5 disc herniation", diagnosis_code: "M51.16", severity: "severe", is_pre_existing: false, date_of_onset: "2025-06-01", provenance: prov() },
    { id: "inj-s2", body_part: "Left Knee", body_region: "Knee", diagnosis_description: "Medial meniscus tear", diagnosis_code: "S83.211A", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-06-01", provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-s1", description: "ER visit", service_date: "2025-06-01", cpt_codes: ["99285"], billed_amount: 8500, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Trauma Center", provenance: prov() },
    { id: "bl-s2", description: "Lumbar microdiscectomy", service_date: "2025-09-15", cpt_codes: ["63030"], billed_amount: 65000, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Dr. Chen", provenance: prov() },
    { id: "bl-s3", description: "Knee arthroscopy", service_date: "2025-10-20", cpt_codes: ["29881"], billed_amount: 22000, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Dr. Park", provenance: prov() },
    { id: "bl-s4", description: "PT post-op (24 sessions)", service_date: "2025-11-01", cpt_codes: ["97110"], billed_amount: 9600, paid_amount: null, reviewer_recommended_amount: null, provider_name: "PT Plus", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-s1", treatment_type: "emergency", treatment_date: "2025-06-01", treatment_end_date: null, description: "ER trauma eval", procedure_codes: ["99285"], provider_name: "Trauma Center", facility_name: "Trauma Center", provenance: prov() },
    { id: "tx-s2", treatment_type: "surgery", treatment_date: "2025-09-15", treatment_end_date: null, description: "L4-L5 microdiscectomy", procedure_codes: ["63030"], provider_name: "Dr. Chen", facility_name: "Surgical Center", provenance: prov() },
    { id: "tx-s3", treatment_type: "surgery", treatment_date: "2025-10-20", treatment_end_date: null, description: "Left knee arthroscopy", procedure_codes: ["29881"], provider_name: "Dr. Park", facility_name: "Surgical Center", provenance: prov() },
  ],
  clinical_flags: baseFlags({ has_surgery: true, has_advanced_imaging: true, has_permanency_indicators: true }),
  wage_loss: { total_lost_wages: f(35000), duration_description: f("5 months lost work due to surgical recovery") },
  future_treatment: { future_medical_estimate: f(15000), indicators: f(["Post-surgical monitoring", "Potential hardware removal"]) },
  overall_completeness_score: 91,
});

// ─── Scenario 4: Surgery with policy limit pressure ─────

export const SURGERY_POLICY_PRESSURE = baseSnapshot("surgery-policy-cap", {
  ...SURGERY_STRONG_LIABILITY,
  snapshot_id: "surgery-policy-cap",
  case_id: "case-eval-surgery-policy-cap",
  policy_coverage: [
    { carrier_name: "GEICO", policy_type: "BI", coverage_limit: 25000, deductible: null, provenance: prov() },
  ],
  overall_completeness_score: 88,
});

// ─── Scenario 5: Long chiro/PT with treatment gap ───────

export const LONG_CHIRO_TREATMENT_GAP = baseSnapshot("long-chiro-gap", {
  treatment_timeline: [
    { id: "tx-g1", treatment_type: "emergency", treatment_date: "2025-03-01", treatment_end_date: null, description: "ER visit", procedure_codes: ["99283"], provider_name: "ER", facility_name: "City Hospital", provenance: prov() },
    { id: "tx-g2", treatment_type: "chiropractic", treatment_date: "2025-03-10", treatment_end_date: "2025-05-15", description: "Chiropractic care phase 1", procedure_codes: ["98940"], provider_name: "Dr. Smith Chiro", facility_name: "Smith Chiro", provenance: prov() },
    // 45-day gap
    { id: "tx-g3", treatment_type: "chiropractic", treatment_date: "2025-07-01", treatment_end_date: "2025-10-01", description: "Chiropractic care phase 2", procedure_codes: ["98940"], provider_name: "Dr. Smith Chiro", facility_name: "Smith Chiro", provenance: prov() },
    { id: "tx-g4", treatment_type: "physical_therapy", treatment_date: "2025-08-01", treatment_end_date: "2025-11-01", description: "PT concurrent with chiro", procedure_codes: ["97110"], provider_name: "PT Center", facility_name: "PT Center", provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-g1", description: "ER visit", service_date: "2025-03-01", cpt_codes: ["99283"], billed_amount: 2800, paid_amount: null, reviewer_recommended_amount: null, provider_name: "City Hospital", provenance: prov() },
    { id: "bl-g2", description: "Chiro phase 1 (20 visits)", service_date: "2025-03-10", cpt_codes: ["98940"], billed_amount: 8000, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Dr. Smith Chiro", provenance: prov() },
    { id: "bl-g3", description: "Chiro phase 2 (36 visits)", service_date: "2025-07-01", cpt_codes: ["98940"], billed_amount: 14400, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Dr. Smith Chiro", provenance: prov() },
    { id: "bl-g4", description: "PT (24 sessions)", service_date: "2025-08-01", cpt_codes: ["97110"], billed_amount: 9600, paid_amount: null, reviewer_recommended_amount: null, provider_name: "PT Center", provenance: prov() },
  ],
  upstream_concerns: [
    { id: "uc-g1", category: "gap", description: "45-day treatment gap between chiropractic phases", severity: "warning", provenance: prov() },
  ],
  overall_completeness_score: 75,
});

// ─── Scenario 6: Comparative negligence ─────────────────

export const COMPARATIVE_NEGLIGENCE_CASE = baseSnapshot("comp-neg", {
  liability_facts: [
    { id: "lf-cn1", fact_text: "Defendant ran red light", supports_liability: true, confidence: 0.9, provenance: prov() },
    { id: "lf-cn2", fact_text: "Plaintiff was distracted by phone", supports_liability: false, confidence: 0.75, provenance: prov() },
    { id: "lf-cn3", fact_text: "Dashcam shows plaintiff entered intersection late", supports_liability: false, confidence: 0.8, provenance: prov() },
  ],
  comparative_negligence: {
    claimant_negligence_percentage: f(25),
    notes: f("Plaintiff bears partial responsibility per accident reconstruction report"),
  },
  medical_billing: [
    { id: "bl-cn1", description: "ER visit", service_date: "2025-06-01", cpt_codes: ["99284"], billed_amount: 5500, paid_amount: null, reviewer_recommended_amount: null, provider_name: "General ER", provenance: prov() },
    { id: "bl-cn2", description: "Ortho consult + MRI", service_date: "2025-06-15", cpt_codes: ["99244", "72141"], billed_amount: 6200, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Ortho Group", provenance: prov() },
    { id: "bl-cn3", description: "PT (16 sessions)", service_date: "2025-07-01", cpt_codes: ["97110"], billed_amount: 6400, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Rehab Center", provenance: prov() },
  ],
  clinical_flags: baseFlags({ has_advanced_imaging: true }),
  overall_completeness_score: 85,
});

// ─── Scenario 7: Venue-severity (plaintiff-friendly) ────

export const VENUE_SEVERITY_CASE = baseSnapshot("venue-severity", {
  venue_jurisdiction: {
    jurisdiction_state: f("FL"),
    venue_county: f("Miami-Dade"),
  },
  injuries: [
    { id: "inj-v1", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical disc herniation at C5-C6", diagnosis_code: "M50.12", severity: "severe", is_pre_existing: false, date_of_onset: "2025-06-01", provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-v1", description: "ER visit", service_date: "2025-06-01", cpt_codes: ["99285"], billed_amount: 9000, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Jackson Memorial", provenance: prov() },
    { id: "bl-v2", description: "Pain management (injections)", service_date: "2025-07-15", cpt_codes: ["64483"], billed_amount: 12000, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Pain Specialists", provenance: prov() },
    { id: "bl-v3", description: "MRI cervical", service_date: "2025-06-20", cpt_codes: ["72141"], billed_amount: 3800, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Miami Imaging", provenance: prov() },
  ],
  clinical_flags: baseFlags({ has_injections: true, has_advanced_imaging: true, has_permanency_indicators: true }),
  overall_completeness_score: 80,
});

// ─── Edge case: Empty snapshot ──────────────────────────

export const EMPTY_SNAPSHOT = baseSnapshot("empty", {
  injuries: [],
  treatment_timeline: [],
  providers: [],
  medical_billing: [],
  liability_facts: [],
  policy_coverage: [],
  upstream_concerns: [],
  clinical_flags: baseFlags(),
  wage_loss: { total_lost_wages: f(0), duration_description: f(null) },
  future_treatment: { future_medical_estimate: f(0), indicators: f([]) },
  overall_completeness_score: 15,
});

// ─── Edge case: Missing liability data ──────────────────

export const MISSING_LIABILITY = baseSnapshot("missing-liability", {
  liability_facts: [],
  comparative_negligence: {
    claimant_negligence_percentage: f(null, "missing"),
    notes: f("", "missing"),
  },
  overall_completeness_score: 55,
});

// ─── All fixtures ───────────────────────────────────────

export const ALL_EVALUATE_FIXTURES: { label: string; snapshot: EvaluateIntakeSnapshot }[] = [
  { label: "Soft tissue low impact", snapshot: SOFT_TISSUE_LOW_IMPACT },
  { label: "High billed with reviewer reductions", snapshot: HIGH_BILLED_MAJOR_REDUCTIONS },
  { label: "Surgery strong liability", snapshot: SURGERY_STRONG_LIABILITY },
  { label: "Surgery policy limit pressure", snapshot: SURGERY_POLICY_PRESSURE },
  { label: "Long chiro/PT with treatment gap", snapshot: LONG_CHIRO_TREATMENT_GAP },
  { label: "Comparative negligence", snapshot: COMPARATIVE_NEGLIGENCE_CASE },
  { label: "Venue-severity plaintiff-friendly", snapshot: VENUE_SEVERITY_CASE },
  { label: "Empty snapshot", snapshot: EMPTY_SNAPSHOT },
  { label: "Missing liability data", snapshot: MISSING_LIABILITY },
];
