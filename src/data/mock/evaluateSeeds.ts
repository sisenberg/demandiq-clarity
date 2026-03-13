/**
 * EvaluateIQ — Demo Seed Data
 *
 * COMPLIANCE: All names, identifiers, and case details are FICTIONAL.
 * See docs/compliance/data-classification.md §2.
 *
 * Seven enterprise-realistic seeded cases covering:
 *  1. Minor soft tissue, short-duration
 *  2. Extended soft tissue with PT and work restrictions
 *  3. Objective ortho, non-surgical
 *  4. Fracture case
 *  5. Surgery case
 *  6. Impairment / permanency case
 *  7. Provisional / insufficient-data case
 *
 * Each includes: snapshot, expected profile, corridor, doc sufficiency,
 * benchmark support tier, and one override example on case #5.
 */

import type {
  EvaluateIntakeSnapshot,
  FieldProvenance,
  ProvenancedField,
  EvalClinicalFlags,
  CompletenessWarning,
  EvalUpstreamConcern,
} from "@/types/evaluate-intake";
import type { ClaimProfileCode } from "@/lib/claimProfileClassifier";

// ─── Helpers ───────────────────────────────────────────

const T = "tenant-demo-001";
const NOW = "2026-03-13T00:00:00Z";

function prov(
  src: "revieweriq" | "demandiq" = "revieweriq",
  c: "complete" | "partial" | "missing" = "complete",
  conf: number = 0.92,
): FieldProvenance {
  return {
    source_module: src,
    source_package_version: 1,
    completeness: c,
    confidence: conf,
    evidence_ref_ids: [],
  };
}

function f<T>(value: T, c: "complete" | "partial" | "missing" = "complete"): ProvenancedField<T> {
  return { value, provenance: prov("revieweriq", c) };
}

function flags(overrides: Partial<EvalClinicalFlags> = {}): EvalClinicalFlags {
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

// ─── Corridor & scoring pre-computed shapes ────────────

export interface DemoCorridorOutput {
  floor: number;
  mid: number;
  high: number;
}

export interface DemoDocSufficiency {
  overall_score: number;
  gaps: string[];
  tier: "strong" | "moderate" | "weak";
}

export interface DemoBenchmarkSupport {
  match_count: number;
  best_similarity: number;
  tier: "strong" | "moderate" | "weak" | "none";
}

export interface DemoOverride {
  reason_code: string;
  reason_label: string;
  system_corridor: DemoCorridorOutput;
  override_corridor: DemoCorridorOutput;
  rationale: string;
  requires_supervisor_review: boolean;
}

export interface DemoValuationRun {
  run_id: string;
  run_version: number;
  computed_at: string;
  floor: number;
  likely: number;
  stretch: number;
  confidence: number;
  confidence_label: "high" | "moderate" | "low" | "very_low";
  factor_count: number;
  override_count: number;
}

export interface DemoStaleState {
  is_stale: boolean;
  stale_reason: string;
  upstream_module: string;
  upstream_version: number;
}

export interface EvaluateDemoSeed {
  id: string;
  label: string;
  archetype: string;
  case_number: string;
  claimant: string;
  insured: string;
  jurisdiction: string;
  date_of_loss: string;
  expected_profile: ClaimProfileCode;
  expected_profile_label: string;
  snapshot: EvaluateIntakeSnapshot;
  corridor: DemoCorridorOutput;
  doc_sufficiency: DemoDocSufficiency;
  benchmark_support: DemoBenchmarkSupport;
  override?: DemoOverride;
  module_status: "not_started" | "in_progress" | "valued" | "completed" | "published";
  /** Whether claimant is represented by attorney */
  is_represented: boolean;
  attorney_name?: string;
  firm_name?: string;
  /** Pre-computed valuation run for validation */
  valuation_run: DemoValuationRun;
  /** Stale-data state for UI testing */
  stale_state?: DemoStaleState;
  /** Whether this seed uses ReviewerIQ as upstream (false = DemandIQ only) */
  has_revieweriq_data: boolean;
}

// ─── Base snapshot factory ─────────────────────────────

function base(id: string, overrides: Partial<EvaluateIntakeSnapshot>): EvaluateIntakeSnapshot {
  return {
    snapshot_id: `snap-demo-${id}`,
    case_id: `case-demo-${id}`,
    tenant_id: T,
    created_at: NOW,
    created_by: "demo-adjuster",
    source_module: "revieweriq",
    source_package_version: 1,
    source_snapshot_id: null,
    claimant: {
      claimant_name: f("Demo Claimant"),
      date_of_birth: f("1982-07-14"),
      occupation: f("Administrative Assistant"),
      employer: f("Regional Services Inc."),
    },
    accident: {
      date_of_loss: f("2025-08-12"),
      mechanism_of_loss: f("Motor vehicle collision"),
      description: f("Claimant's vehicle struck from behind at controlled intersection."),
    },
    liability_facts: [
      { id: `lf-${id}-1`, fact_text: "Defendant cited for following too closely", supports_liability: true, confidence: 0.92, provenance: prov() },
      { id: `lf-${id}-2`, fact_text: "Police report assigns primary fault to defendant", supports_liability: true, confidence: 0.88, provenance: prov() },
    ],
    comparative_negligence: {
      claimant_negligence_percentage: f(null),
      notes: f(""),
    },
    venue_jurisdiction: {
      jurisdiction_state: f("FL"),
      venue_county: f("Hillsborough"),
    },
    policy_coverage: [
      { carrier_name: "National Indemnity", policy_type: "BI", coverage_limit: 100000, deductible: null, provenance: prov() },
    ],
    injuries: [],
    treatment_timeline: [],
    providers: [],
    medical_billing: [],
    wage_loss: { total_lost_wages: f(0), duration_description: f(null) },
    future_treatment: { future_medical_estimate: f(0), indicators: f([]) },
    clinical_flags: flags(),
    upstream_concerns: [],
    completeness_warnings: [],
    overall_completeness_score: 70,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// SEED 1: Minor Soft Tissue, Short Duration
// ═══════════════════════════════════════════════════════

const SEED_1_SNAPSHOT = base("st-minor", {
  claimant: {
    claimant_name: f("Maria Delgado"),
    date_of_birth: f("1991-04-22"),
    occupation: f("Retail Sales Associate"),
    employer: f("Hillsborough Home Goods"),
  },
  accident: {
    date_of_loss: f("2025-09-03"),
    mechanism_of_loss: f("Low-speed rear-end collision in parking lot"),
    description: f("Claimant's vehicle was struck from behind at approximately 8 mph while stopped in a retail parking lot. Minor vehicle damage. No airbag deployment."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("FL"),
    venue_county: f("Hillsborough"),
  },
  injuries: [
    { id: "inj-1a", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical muscle strain", diagnosis_code: "S13.4XXA", severity: "mild", is_pre_existing: false, date_of_onset: "2025-09-03", provenance: prov() },
    { id: "inj-1b", body_part: "Lumbar Spine", body_region: "Lower Back", diagnosis_description: "Lumbar strain", diagnosis_code: "S39.012A", severity: "mild", is_pre_existing: false, date_of_onset: "2025-09-03", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-1a", treatment_type: "urgent_care", treatment_date: "2025-09-03", treatment_end_date: null, description: "Urgent care evaluation. X-rays negative.", procedure_codes: ["99213", "72040"], provider_name: "CareFirst Urgent Care", facility_name: "CareFirst Urgent Care", provenance: prov() },
    { id: "tx-1b", treatment_type: "chiropractic", treatment_date: "2025-09-10", treatment_end_date: "2025-10-22", description: "Chiropractic adjustments, 10 visits over 6 weeks", procedure_codes: ["98940", "97140"], provider_name: "Dr. Alan Briggs, DC", facility_name: "Briggs Chiropractic", provenance: prov() },
  ],
  providers: [
    { id: "pv-1a", full_name: "CareFirst Urgent Care", specialty: "Urgent Care", facility_name: "CareFirst", role_description: "Initial evaluation", total_visits: 1, first_visit_date: "2025-09-03", last_visit_date: "2025-09-03", total_billed: 850, total_paid: 0, provenance: prov() },
    { id: "pv-1b", full_name: "Dr. Alan Briggs, DC", specialty: "Chiropractic", facility_name: "Briggs Chiropractic", role_description: "Treating chiropractor", total_visits: 10, first_visit_date: "2025-09-10", last_visit_date: "2025-10-22", total_billed: 3200, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-1a", description: "Urgent care visit + cervical X-ray", service_date: "2025-09-03", cpt_codes: ["99213", "72040"], billed_amount: 850, paid_amount: null, reviewer_recommended_amount: 720, provider_name: "CareFirst Urgent Care", provenance: prov() },
    { id: "bl-1b", description: "Chiropractic (10 visits)", service_date: "2025-09-10", cpt_codes: ["98940", "97140"], billed_amount: 3200, paid_amount: null, reviewer_recommended_amount: 2800, provider_name: "Dr. Alan Briggs, DC", provenance: prov() },
  ],
  overall_completeness_score: 78,
});

// ═══════════════════════════════════════════════════════
// SEED 2: Extended Soft Tissue with PT + Work Restrictions
// ═══════════════════════════════════════════════════════

const SEED_2_SNAPSHOT = base("st-extended", {
  claimant: {
    claimant_name: f("James Whitfield"),
    date_of_birth: f("1978-11-05"),
    occupation: f("Warehouse Supervisor"),
    employer: f("Central Distribution LLC"),
  },
  accident: {
    date_of_loss: f("2025-06-18"),
    mechanism_of_loss: f("T-bone collision at uncontrolled intersection"),
    description: f("Defendant failed to yield right-of-way at uncontrolled intersection, striking claimant's driver side at approximately 30 mph. Moderate vehicle damage. Side curtain airbags deployed."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("GA"),
    venue_county: f("Fulton"),
  },
  injuries: [
    { id: "inj-2a", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical sprain with radiculopathy symptoms", diagnosis_code: "S13.4XXA", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-06-18", provenance: prov() },
    { id: "inj-2b", body_part: "Left Shoulder", body_region: "Shoulder", diagnosis_description: "Left shoulder contusion and strain", diagnosis_code: "S40.012A", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-06-18", provenance: prov() },
    { id: "inj-2c", body_part: "Thoracic Spine", body_region: "Upper Back", diagnosis_description: "Thoracic strain", diagnosis_code: "S23.3XXA", severity: "mild", is_pre_existing: false, date_of_onset: "2025-06-18", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-2a", treatment_type: "emergency", treatment_date: "2025-06-18", treatment_end_date: null, description: "ER evaluation. CT of C-spine negative for fracture.", procedure_codes: ["99284", "70551"], provider_name: "Grady Memorial ER", facility_name: "Grady Memorial Hospital", provenance: prov() },
    { id: "tx-2b", treatment_type: "physical_therapy", treatment_date: "2025-06-28", treatment_end_date: "2025-10-15", description: "PT 3x/week for 16 weeks. Progress from passive modalities to active strengthening.", procedure_codes: ["97110", "97140", "97530"], provider_name: "Peachtree Physical Therapy", facility_name: "Peachtree PT", provenance: prov() },
    { id: "tx-2c", treatment_type: "primary_care", treatment_date: "2025-07-10", treatment_end_date: "2025-10-20", description: "PCP follow-up visits. Work restrictions issued: no lifting >15 lbs for 3 months.", procedure_codes: ["99214"], provider_name: "Dr. Sandra Okafor, MD", facility_name: "Fulton Family Medicine", provenance: prov() },
  ],
  providers: [
    { id: "pv-2a", full_name: "Grady Memorial ER", specialty: "Emergency Medicine", facility_name: "Grady Memorial Hospital", role_description: "Initial ER evaluation", total_visits: 1, first_visit_date: "2025-06-18", last_visit_date: "2025-06-18", total_billed: 6200, total_paid: 0, provenance: prov() },
    { id: "pv-2b", full_name: "Peachtree Physical Therapy", specialty: "Physical Therapy", facility_name: "Peachtree PT", role_description: "Treating PT clinic", total_visits: 42, first_visit_date: "2025-06-28", last_visit_date: "2025-10-15", total_billed: 16800, total_paid: 0, provenance: prov() },
    { id: "pv-2c", full_name: "Dr. Sandra Okafor, MD", specialty: "Family Medicine", facility_name: "Fulton Family Medicine", role_description: "PCP with work restriction oversight", total_visits: 5, first_visit_date: "2025-07-10", last_visit_date: "2025-10-20", total_billed: 1750, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-2a", description: "ER visit + CT cervical spine", service_date: "2025-06-18", cpt_codes: ["99284", "70551"], billed_amount: 6200, paid_amount: null, reviewer_recommended_amount: 4800, provider_name: "Grady Memorial ER", provenance: prov() },
    { id: "bl-2b", description: "Physical therapy (42 visits)", service_date: "2025-06-28", cpt_codes: ["97110", "97140", "97530"], billed_amount: 16800, paid_amount: null, reviewer_recommended_amount: 13200, provider_name: "Peachtree PT", provenance: prov() },
    { id: "bl-2c", description: "PCP visits (5)", service_date: "2025-07-10", cpt_codes: ["99214"], billed_amount: 1750, paid_amount: null, reviewer_recommended_amount: 1500, provider_name: "Dr. Sandra Okafor", provenance: prov() },
  ],
  wage_loss: { total_lost_wages: f(8400), duration_description: f("12 weeks partial restriction — light duty reduced overtime eligibility") },
  clinical_flags: flags({ has_advanced_imaging: true }),
  overall_completeness_score: 84,
});

// ═══════════════════════════════════════════════════════
// SEED 3: Objective Ortho, Non-Surgical
// ═══════════════════════════════════════════════════════

const SEED_3_SNAPSHOT = base("ortho-nonsurg", {
  claimant: {
    claimant_name: f("Catherine Novak"),
    date_of_birth: f("1969-02-28"),
    occupation: f("High School Teacher"),
    employer: f("Pinellas County Schools"),
  },
  accident: {
    date_of_loss: f("2025-05-10"),
    mechanism_of_loss: f("Rear-end collision on highway on-ramp"),
    description: f("Claimant was rear-ended while decelerating on I-275 on-ramp due to merging traffic. Significant vehicle damage. Claimant transported by EMS."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("FL"),
    venue_county: f("Pinellas"),
  },
  injuries: [
    { id: "inj-3a", body_part: "Right Shoulder", body_region: "Shoulder", diagnosis_description: "Partial thickness rotator cuff tear", diagnosis_code: "M75.111", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-05-10", provenance: prov() },
    { id: "inj-3b", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical disc bulge at C5-C6 without myelopathy", diagnosis_code: "M50.22", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-05-10", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-3a", treatment_type: "emergency", treatment_date: "2025-05-10", treatment_end_date: null, description: "ER via EMS. X-rays of shoulder and c-spine.", procedure_codes: ["99284"], provider_name: "St. Petersburg General", facility_name: "St. Petersburg General Hospital", provenance: prov() },
    { id: "tx-3b", treatment_type: "specialist", treatment_date: "2025-05-22", treatment_end_date: "2025-10-01", description: "Orthopedic consult — MRI shoulder, MRI cervical. Conservative management recommended.", procedure_codes: ["99244", "73221", "72141"], provider_name: "Dr. Richard Vasquez, MD", facility_name: "Bay Area Orthopedics", provenance: prov() },
    { id: "tx-3c", treatment_type: "physical_therapy", treatment_date: "2025-06-05", treatment_end_date: "2025-09-30", description: "PT for shoulder rehabilitation — 30 sessions", procedure_codes: ["97110", "97530", "97140"], provider_name: "Gulf Coast Rehab", facility_name: "Gulf Coast Rehabilitation", provenance: prov() },
  ],
  providers: [
    { id: "pv-3a", full_name: "St. Petersburg General", specialty: "Emergency", facility_name: "St. Petersburg General Hospital", role_description: "ER via EMS", total_visits: 1, first_visit_date: "2025-05-10", last_visit_date: "2025-05-10", total_billed: 5400, total_paid: 0, provenance: prov() },
    { id: "pv-3b", full_name: "Dr. Richard Vasquez, MD", specialty: "Orthopedic Surgery", facility_name: "Bay Area Orthopedics", role_description: "Treating orthopedist", total_visits: 4, first_visit_date: "2025-05-22", last_visit_date: "2025-10-01", total_billed: 4600, total_paid: 0, provenance: prov() },
    { id: "pv-3c", full_name: "Gulf Coast Rehab", specialty: "Physical Therapy", facility_name: "Gulf Coast Rehabilitation", role_description: "PT provider", total_visits: 30, first_visit_date: "2025-06-05", last_visit_date: "2025-09-30", total_billed: 12000, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-3a", description: "ER visit + imaging", service_date: "2025-05-10", cpt_codes: ["99284", "73030", "72040"], billed_amount: 5400, paid_amount: null, reviewer_recommended_amount: 4200, provider_name: "St. Petersburg General", provenance: prov() },
    { id: "bl-3b", description: "Orthopedic consult + MRI shoulder + MRI cervical", service_date: "2025-05-22", cpt_codes: ["99244", "73221", "72141"], billed_amount: 4600, paid_amount: null, reviewer_recommended_amount: 3800, provider_name: "Dr. Vasquez", provenance: prov() },
    { id: "bl-3c", description: "Physical therapy (30 sessions)", service_date: "2025-06-05", cpt_codes: ["97110", "97530", "97140"], billed_amount: 12000, paid_amount: null, reviewer_recommended_amount: 10500, provider_name: "Gulf Coast Rehab", provenance: prov() },
  ],
  wage_loss: { total_lost_wages: f(4200), duration_description: f("3 weeks full absence — teacher summer break covered remainder") },
  clinical_flags: flags({ has_advanced_imaging: true }),
  overall_completeness_score: 86,
});

// ═══════════════════════════════════════════════════════
// SEED 4: Fracture Case
// ═══════════════════════════════════════════════════════

const SEED_4_SNAPSHOT = base("fracture", {
  claimant: {
    claimant_name: f("Anthony Reeves"),
    date_of_birth: f("1974-09-17"),
    occupation: f("HVAC Technician"),
    employer: f("Comfort Air Systems"),
  },
  accident: {
    date_of_loss: f("2025-04-02"),
    mechanism_of_loss: f("Broadside collision at signalized intersection"),
    description: f("Defendant ran red light and struck claimant's vehicle on driver side at approximately 40 mph. Major vehicle damage. Claimant extricated by fire rescue."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("TX"),
    venue_county: f("Harris"),
  },
  injuries: [
    { id: "inj-4a", body_part: "Left Wrist", body_region: "Upper Extremity", diagnosis_description: "Distal radius fracture, closed", diagnosis_code: "S52.502A", severity: "severe", is_pre_existing: false, date_of_onset: "2025-04-02", provenance: prov() },
    { id: "inj-4b", body_part: "Left Ribs", body_region: "Thorax", diagnosis_description: "Fractures of ribs 5–7, left side", diagnosis_code: "S22.42XA", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-04-02", provenance: prov() },
    { id: "inj-4c", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical strain", diagnosis_code: "S13.4XXA", severity: "mild", is_pre_existing: false, date_of_onset: "2025-04-02", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-4a", treatment_type: "emergency", treatment_date: "2025-04-02", treatment_end_date: null, description: "ER via EMS. CT chest, X-rays left wrist. Closed reduction of distal radius fracture with splint.", procedure_codes: ["99285", "71260", "73100", "25605"], provider_name: "Memorial Hermann ER", facility_name: "Memorial Hermann Hospital", provenance: prov() },
    { id: "tx-4b", treatment_type: "specialist", treatment_date: "2025-04-10", treatment_end_date: "2025-08-20", description: "Orthopedic follow-up. Cast application, serial X-rays, fracture healing monitoring.", procedure_codes: ["99244", "73100", "29075"], provider_name: "Dr. Lisa Chang, MD", facility_name: "Texas Orthopedic Associates", provenance: prov() },
    { id: "tx-4c", treatment_type: "physical_therapy", treatment_date: "2025-06-15", treatment_end_date: "2025-09-15", description: "PT for wrist ROM and grip strength — 24 visits", procedure_codes: ["97110", "97530"], provider_name: "Houston Rehab Partners", facility_name: "Houston Rehab", provenance: prov() },
  ],
  providers: [
    { id: "pv-4a", full_name: "Memorial Hermann ER", specialty: "Emergency/Trauma", facility_name: "Memorial Hermann Hospital", role_description: "ER via EMS", total_visits: 1, first_visit_date: "2025-04-02", last_visit_date: "2025-04-02", total_billed: 14200, total_paid: 0, provenance: prov() },
    { id: "pv-4b", full_name: "Dr. Lisa Chang, MD", specialty: "Orthopedic Surgery", facility_name: "Texas Orthopedic Associates", role_description: "Fracture management", total_visits: 6, first_visit_date: "2025-04-10", last_visit_date: "2025-08-20", total_billed: 5800, total_paid: 0, provenance: prov() },
    { id: "pv-4c", full_name: "Houston Rehab Partners", specialty: "Physical Therapy", facility_name: "Houston Rehab", role_description: "Post-fracture PT", total_visits: 24, first_visit_date: "2025-06-15", last_visit_date: "2025-09-15", total_billed: 9600, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-4a", description: "ER + CT chest + wrist X-ray + closed reduction", service_date: "2025-04-02", cpt_codes: ["99285", "71260", "73100", "25605"], billed_amount: 14200, paid_amount: null, reviewer_recommended_amount: 11800, provider_name: "Memorial Hermann ER", provenance: prov() },
    { id: "bl-4b", description: "Ortho follow-up (6 visits) + cast + serial X-rays", service_date: "2025-04-10", cpt_codes: ["99244", "73100", "29075"], billed_amount: 5800, paid_amount: null, reviewer_recommended_amount: 5200, provider_name: "Dr. Chang", provenance: prov() },
    { id: "bl-4c", description: "PT wrist rehabilitation (24 visits)", service_date: "2025-06-15", cpt_codes: ["97110", "97530"], billed_amount: 9600, paid_amount: null, reviewer_recommended_amount: 8400, provider_name: "Houston Rehab", provenance: prov() },
  ],
  wage_loss: { total_lost_wages: f(18200), duration_description: f("10 weeks full disability — unable to perform manual HVAC work with fractured wrist") },
  clinical_flags: flags({ has_advanced_imaging: true }),
  policy_coverage: [
    { carrier_name: "Hartford Insurance", policy_type: "BI", coverage_limit: 250000, deductible: null, provenance: prov() },
  ],
  overall_completeness_score: 89,
});

// ═══════════════════════════════════════════════════════
// SEED 5: Surgery Case (with override example)
// ═══════════════════════════════════════════════════════

const SEED_5_SNAPSHOT = base("surgery", {
  claimant: {
    claimant_name: f("Patricia Morales"),
    date_of_birth: f("1965-12-03"),
    occupation: f("Registered Nurse"),
    employer: f("Tampa General Hospital"),
  },
  accident: {
    date_of_loss: f("2025-03-14"),
    mechanism_of_loss: f("Head-on collision on two-lane highway"),
    description: f("Defendant crossed center line and struck claimant's vehicle head-on at combined speed of approximately 55 mph. Airbags deployed. Claimant transported to trauma center by helicopter."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("FL"),
    venue_county: f("Hillsborough"),
  },
  injuries: [
    { id: "inj-5a", body_part: "Lumbar Spine", body_region: "Lower Back", diagnosis_description: "L4-L5 disc herniation with radiculopathy", diagnosis_code: "M51.16", severity: "severe", is_pre_existing: false, date_of_onset: "2025-03-14", provenance: prov() },
    { id: "inj-5b", body_part: "Right Knee", body_region: "Knee", diagnosis_description: "Torn ACL, right knee", diagnosis_code: "S83.511A", severity: "severe", is_pre_existing: false, date_of_onset: "2025-03-14", provenance: prov() },
    { id: "inj-5c", body_part: "Right Ankle", body_region: "Ankle", diagnosis_description: "Right ankle sprain grade II", diagnosis_code: "S93.401A", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-03-14", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-5a", treatment_type: "emergency", treatment_date: "2025-03-14", treatment_end_date: null, description: "Trauma center admission. MRI lumbar, MRI right knee. 2-day inpatient observation.", procedure_codes: ["99285", "72148", "73721"], provider_name: "Tampa General Trauma", facility_name: "Tampa General Hospital", provenance: prov() },
    { id: "tx-5b", treatment_type: "surgery", treatment_date: "2025-05-20", treatment_end_date: null, description: "L4-L5 microdiscectomy", procedure_codes: ["63030"], provider_name: "Dr. Michael Torres, MD", facility_name: "Florida Spine Institute", provenance: prov() },
    { id: "tx-5c", treatment_type: "surgery", treatment_date: "2025-07-15", treatment_end_date: null, description: "Right ACL reconstruction with patellar tendon autograft", procedure_codes: ["27427"], provider_name: "Dr. Karen Wells, MD", facility_name: "Tampa Orthopedic Center", provenance: prov() },
    { id: "tx-5d", treatment_type: "physical_therapy", treatment_date: "2025-06-10", treatment_end_date: "2026-01-15", description: "Post-surgical PT — 48 visits total across both surgeries", procedure_codes: ["97110", "97530", "97542"], provider_name: "Advanced Recovery PT", facility_name: "Advanced Recovery", provenance: prov() },
  ],
  providers: [
    { id: "pv-5a", full_name: "Tampa General Trauma", specialty: "Trauma Surgery", facility_name: "Tampa General Hospital", role_description: "Initial trauma care", total_visits: 1, first_visit_date: "2025-03-14", last_visit_date: "2025-03-16", total_billed: 28500, total_paid: 0, provenance: prov() },
    { id: "pv-5b", full_name: "Dr. Michael Torres, MD", specialty: "Neurosurgery", facility_name: "Florida Spine Institute", role_description: "Spinal surgeon", total_visits: 6, first_visit_date: "2025-04-02", last_visit_date: "2025-10-15", total_billed: 72000, total_paid: 0, provenance: prov() },
    { id: "pv-5c", full_name: "Dr. Karen Wells, MD", specialty: "Orthopedic Surgery", facility_name: "Tampa Orthopedic Center", role_description: "Knee surgeon", total_visits: 5, first_visit_date: "2025-06-01", last_visit_date: "2025-11-20", total_billed: 34000, total_paid: 0, provenance: prov() },
    { id: "pv-5d", full_name: "Advanced Recovery PT", specialty: "Physical Therapy", facility_name: "Advanced Recovery", role_description: "Post-surgical rehabilitation", total_visits: 48, first_visit_date: "2025-06-10", last_visit_date: "2026-01-15", total_billed: 19200, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-5a", description: "Trauma center admission + imaging (2-day)", service_date: "2025-03-14", cpt_codes: ["99285", "72148", "73721"], billed_amount: 28500, paid_amount: null, reviewer_recommended_amount: 24200, provider_name: "Tampa General", provenance: prov() },
    { id: "bl-5b", description: "L4-L5 microdiscectomy", service_date: "2025-05-20", cpt_codes: ["63030"], billed_amount: 72000, paid_amount: null, reviewer_recommended_amount: 58000, provider_name: "Dr. Torres", provenance: prov() },
    { id: "bl-5c", description: "ACL reconstruction", service_date: "2025-07-15", cpt_codes: ["27427"], billed_amount: 34000, paid_amount: null, reviewer_recommended_amount: 28500, provider_name: "Dr. Wells", provenance: prov() },
    { id: "bl-5d", description: "Post-surgical PT (48 visits)", service_date: "2025-06-10", cpt_codes: ["97110", "97530", "97542"], billed_amount: 19200, paid_amount: null, reviewer_recommended_amount: 17600, provider_name: "Advanced Recovery PT", provenance: prov() },
  ],
  wage_loss: { total_lost_wages: f(62000), duration_description: f("8 months total disability — unable to perform nursing duties requiring standing, lifting, patient transfers") },
  future_treatment: { future_medical_estimate: f(25000), indicators: f(["Post-surgical lumbar monitoring", "Possible knee hardware removal", "Annual orthopedic follow-up"]) },
  clinical_flags: flags({ has_surgery: true, has_advanced_imaging: true, has_permanency_indicators: true }),
  policy_coverage: [
    { carrier_name: "USAA", policy_type: "BI", coverage_limit: 500000, deductible: null, provenance: prov() },
  ],
  overall_completeness_score: 93,
});

// ═══════════════════════════════════════════════════════
// SEED 6: Impairment / Permanency Case
// ═══════════════════════════════════════════════════════

const SEED_6_SNAPSHOT = base("permanency", {
  claimant: {
    claimant_name: f("Robert Tran"),
    date_of_birth: f("1958-06-20"),
    occupation: f("Construction Foreman"),
    employer: f("Gulf Coast Builders Inc."),
  },
  accident: {
    date_of_loss: f("2025-01-08"),
    mechanism_of_loss: f("Multi-vehicle pile-up on interstate"),
    description: f("Chain-reaction collision on I-10 during fog event. Claimant's vehicle struck by commercial vehicle from behind, pushed into vehicle ahead. Extensive vehicle damage. Multiple occupants transported."),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("TX"),
    venue_county: f("Jefferson"),
  },
  injuries: [
    { id: "inj-6a", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "C5-C6 disc herniation with anterior cervical discectomy and fusion", diagnosis_code: "M50.12", severity: "severe", is_pre_existing: false, date_of_onset: "2025-01-08", provenance: prov() },
    { id: "inj-6b", body_part: "Lumbar Spine", body_region: "Lower Back", diagnosis_description: "L5-S1 disc herniation requiring laminectomy", diagnosis_code: "M51.17", severity: "severe", is_pre_existing: false, date_of_onset: "2025-01-08", provenance: prov() },
    { id: "inj-6c", body_part: "Right Shoulder", body_region: "Shoulder", diagnosis_description: "Full-thickness rotator cuff tear with surgical repair", diagnosis_code: "M75.121", severity: "severe", is_pre_existing: false, date_of_onset: "2025-01-08", provenance: prov() },
  ],
  treatment_timeline: [
    { id: "tx-6a", treatment_type: "emergency", treatment_date: "2025-01-08", treatment_end_date: null, description: "Level I trauma activation. 4-day ICU stay.", procedure_codes: ["99291", "99292"], provider_name: "Christus St. Elizabeth", facility_name: "Christus St. Elizabeth Hospital", provenance: prov() },
    { id: "tx-6b", treatment_type: "surgery", treatment_date: "2025-03-05", treatment_end_date: null, description: "ACDF C5-C6", procedure_codes: ["22551", "22845"], provider_name: "Dr. William Kang, MD", facility_name: "Texas Spine Center", provenance: prov() },
    { id: "tx-6c", treatment_type: "surgery", treatment_date: "2025-05-12", treatment_end_date: null, description: "L5-S1 laminectomy", procedure_codes: ["63047"], provider_name: "Dr. William Kang, MD", facility_name: "Texas Spine Center", provenance: prov() },
    { id: "tx-6d", treatment_type: "surgery", treatment_date: "2025-08-20", treatment_end_date: null, description: "Right shoulder rotator cuff repair", procedure_codes: ["23412"], provider_name: "Dr. Eduardo Reyes, MD", facility_name: "Southeast Texas Orthopedics", provenance: prov() },
    { id: "tx-6e", treatment_type: "physical_therapy", treatment_date: "2025-04-01", treatment_end_date: "2026-02-01", description: "Ongoing PT — 72 visits total across 3 surgical recoveries", procedure_codes: ["97110", "97530", "97542"], provider_name: "Total Recovery PT", facility_name: "Total Recovery", provenance: prov() },
    { id: "tx-6f", treatment_type: "specialist", treatment_date: "2025-12-10", treatment_end_date: null, description: "IME — 12% whole person impairment rating assigned", procedure_codes: ["99456"], provider_name: "Dr. Natalie Dubois, MD", facility_name: "Independent Medical", provenance: prov() },
  ],
  providers: [
    { id: "pv-6a", full_name: "Christus St. Elizabeth", specialty: "Trauma/ICU", facility_name: "Christus St. Elizabeth Hospital", role_description: "Trauma center with ICU stay", total_visits: 1, first_visit_date: "2025-01-08", last_visit_date: "2025-01-12", total_billed: 68000, total_paid: 0, provenance: prov() },
    { id: "pv-6b", full_name: "Dr. William Kang, MD", specialty: "Neurosurgery", facility_name: "Texas Spine Center", role_description: "Spinal surgeon — 2 procedures", total_visits: 10, first_visit_date: "2025-02-01", last_visit_date: "2025-11-15", total_billed: 142000, total_paid: 0, provenance: prov() },
    { id: "pv-6c", full_name: "Dr. Eduardo Reyes, MD", specialty: "Orthopedic Surgery", facility_name: "Southeast Texas Orthopedics", role_description: "Shoulder surgeon", total_visits: 5, first_visit_date: "2025-07-01", last_visit_date: "2025-12-01", total_billed: 38000, total_paid: 0, provenance: prov() },
    { id: "pv-6d", full_name: "Total Recovery PT", specialty: "Physical Therapy", facility_name: "Total Recovery", role_description: "Post-surgical PT", total_visits: 72, first_visit_date: "2025-04-01", last_visit_date: "2026-02-01", total_billed: 28800, total_paid: 0, provenance: prov() },
    { id: "pv-6e", full_name: "Dr. Natalie Dubois, MD", specialty: "Physical Medicine & Rehabilitation", facility_name: "Independent Medical", role_description: "IME — impairment rating", total_visits: 1, first_visit_date: "2025-12-10", last_visit_date: "2025-12-10", total_billed: 3500, total_paid: 0, provenance: prov() },
  ],
  medical_billing: [
    { id: "bl-6a", description: "Trauma center + ICU (4 days)", service_date: "2025-01-08", cpt_codes: ["99291", "99292"], billed_amount: 68000, paid_amount: null, reviewer_recommended_amount: 58000, provider_name: "Christus St. Elizabeth", provenance: prov() },
    { id: "bl-6b", description: "ACDF C5-C6", service_date: "2025-03-05", cpt_codes: ["22551", "22845"], billed_amount: 85000, paid_amount: null, reviewer_recommended_amount: 72000, provider_name: "Dr. Kang", provenance: prov() },
    { id: "bl-6c", description: "L5-S1 laminectomy", service_date: "2025-05-12", cpt_codes: ["63047"], billed_amount: 57000, paid_amount: null, reviewer_recommended_amount: 48000, provider_name: "Dr. Kang", provenance: prov() },
    { id: "bl-6d", description: "Rotator cuff repair", service_date: "2025-08-20", cpt_codes: ["23412"], billed_amount: 38000, paid_amount: null, reviewer_recommended_amount: 32000, provider_name: "Dr. Reyes", provenance: prov() },
    { id: "bl-6e", description: "PT (72 visits)", service_date: "2025-04-01", cpt_codes: ["97110", "97530", "97542"], billed_amount: 28800, paid_amount: null, reviewer_recommended_amount: 25200, provider_name: "Total Recovery PT", provenance: prov() },
    { id: "bl-6f", description: "IME — impairment rating", service_date: "2025-12-10", cpt_codes: ["99456"], billed_amount: 3500, paid_amount: null, reviewer_recommended_amount: 3500, provider_name: "Dr. Dubois", provenance: prov() },
  ],
  wage_loss: { total_lost_wages: f(94000), duration_description: f("12+ months — unable to return to construction foreman duties. Vocational assessment pending.") },
  future_treatment: { future_medical_estimate: f(45000), indicators: f(["Lifetime pain management", "Possible cervical hardware revision", "Annual spine monitoring", "Functional capacity evaluation"]) },
  clinical_flags: flags({ has_surgery: true, has_advanced_imaging: true, has_permanency_indicators: true, has_impairment_rating: true }),
  policy_coverage: [
    { carrier_name: "Liberty Mutual", policy_type: "Commercial Auto BI", coverage_limit: 1000000, deductible: null, provenance: prov() },
  ],
  overall_completeness_score: 95,
});

// ═══════════════════════════════════════════════════════
// SEED 7: Provisional / Insufficient Data
// ═══════════════════════════════════════════════════════

const SEED_7_SNAPSHOT = base("provisional", {
  claimant: {
    claimant_name: f("Linda Hawkins"),
    date_of_birth: f("1987-03-30", "partial"),
    occupation: f(null, "missing"),
    employer: f(null, "missing"),
  },
  accident: {
    date_of_loss: f("2025-11-22"),
    mechanism_of_loss: f("Multi-vehicle collision", "partial"),
    description: f("Limited facts available. Claimant reports being involved in a multi-vehicle collision. No police report obtained. Liability disputed.", "partial"),
  },
  venue_jurisdiction: {
    jurisdiction_state: f("IL"),
    venue_county: f(null, "missing"),
  },
  liability_facts: [
    { id: "lf-7a", fact_text: "Claimant reports being rear-ended but no police report available", supports_liability: true, confidence: 0.45, provenance: prov("demandiq", "partial", 0.45) },
  ],
  comparative_negligence: {
    claimant_negligence_percentage: f(null, "missing"),
    notes: f("Liability disputed — no independent verification available", "partial"),
  },
  injuries: [
    { id: "inj-7a", body_part: "Cervical Spine", body_region: "Neck", diagnosis_description: "Cervical strain — diagnosis from demand letter only", diagnosis_code: "S13.4XXA", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-11-22", provenance: prov("demandiq", "partial", 0.55) },
    { id: "inj-7b", body_part: "Lumbar Spine", body_region: "Lower Back", diagnosis_description: "Lumbar disc bulge — noted in demand, no imaging confirmed", diagnosis_code: "M51.26", severity: "moderate", is_pre_existing: false, date_of_onset: "2025-11-22", provenance: prov("demandiq", "partial", 0.40) },
  ],
  treatment_timeline: [
    { id: "tx-7a", treatment_type: "emergency", treatment_date: "2025-11-22", treatment_end_date: null, description: "ER visit documented in demand. Records not yet obtained.", procedure_codes: ["99284"], provider_name: "Unknown ER", facility_name: "Unknown", provenance: prov("demandiq", "partial", 0.40) },
    { id: "tx-7b", treatment_type: "chiropractic", treatment_date: "2025-12-01", treatment_end_date: null, description: "Chiropractic treatment noted in demand. Duration and frequency unknown.", procedure_codes: ["98940"], provider_name: "Unknown Chiropractor", facility_name: "Unknown", provenance: prov("demandiq", "partial", 0.35) },
  ],
  providers: [],
  medical_billing: [
    { id: "bl-7a", description: "ER visit (from demand — records pending)", service_date: "2025-11-22", cpt_codes: ["99284"], billed_amount: 4500, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Unknown", provenance: prov("demandiq", "partial", 0.40) },
    { id: "bl-7b", description: "Chiropractic (from demand — records pending)", service_date: "2025-12-01", cpt_codes: ["98940"], billed_amount: 8200, paid_amount: null, reviewer_recommended_amount: null, provider_name: "Unknown", provenance: prov("demandiq", "partial", 0.35) },
  ],
  upstream_concerns: [
    { id: "uc-7a", category: "documentation", description: "Medical records not yet obtained — relying on demand letter summaries only", severity: "critical", provenance: prov("demandiq", "partial") },
    { id: "uc-7b", category: "causation", description: "No police report available — liability unverified", severity: "critical", provenance: prov("demandiq", "partial") },
    { id: "uc-7c", category: "gap", description: "Treatment records incomplete — provider details and visit counts unknown", severity: "warning", provenance: prov("demandiq", "partial") },
    { id: "uc-7d", category: "documentation", description: "No imaging reports available to verify disc bulge diagnosis", severity: "critical", provenance: prov("demandiq", "partial") },
  ],
  completeness_warnings: [
    { field: "medical_records", label: "Medical Records", status: "missing" as const, message: "No verified medical records obtained" },
    { field: "police_report", label: "Police Report", status: "missing" as const, message: "Police report not available" },
    { field: "provider_details", label: "Provider Details", status: "missing" as const, message: "Provider identities and visit counts unknown" },
    { field: "imaging", label: "Diagnostic Imaging", status: "missing" as const, message: "No imaging reports to verify disc pathology" },
    { field: "wage_loss", label: "Wage Loss Documentation", status: "missing" as const, message: "No wage loss documentation provided" },
    { field: "venue", label: "Venue County", status: "missing" as const, message: "Specific venue county not identified" },
  ],
  clinical_flags: flags(),
  policy_coverage: [
    { carrier_name: "Progressive", policy_type: "BI", coverage_limit: 50000, deductible: null, provenance: prov() },
  ],
  overall_completeness_score: 32,
  source_module: "demandiq",
});

// ═══════════════════════════════════════════════════════
// Assembled Demo Seeds
// ═══════════════════════════════════════════════════════

export const EVALUATE_DEMO_SEEDS: EvaluateDemoSeed[] = [
  {
    id: "st-minor",
    label: "Minor Soft Tissue — Short Duration",
    archetype: "Profile A: Conservative care, rapid resolution",
    case_number: "CF-2026-00301",
    claimant: "Maria Delgado",
    insured: "Hillsborough Home Goods",
    jurisdiction: "FL — Hillsborough",
    date_of_loss: "2025-09-03",
    expected_profile: "A",
    expected_profile_label: "Minor Soft Tissue",
    snapshot: SEED_1_SNAPSHOT,
    corridor: { floor: 4200, mid: 6800, high: 9500 },
    doc_sufficiency: { overall_score: 78, gaps: ["No wage loss documentation"], tier: "moderate" },
    benchmark_support: { match_count: 8, best_similarity: 82, tier: "strong" },
    module_status: "completed",
  },
  {
    id: "st-extended",
    label: "Extended Soft Tissue — PT & Work Restrictions",
    archetype: "Profile B: Prolonged treatment, functional impact, wage loss",
    case_number: "CF-2026-00302",
    claimant: "James Whitfield",
    insured: "Central Distribution LLC",
    jurisdiction: "GA — Fulton",
    date_of_loss: "2025-06-18",
    expected_profile: "B",
    expected_profile_label: "Extended Soft Tissue",
    snapshot: SEED_2_SNAPSHOT,
    corridor: { floor: 18500, mid: 27000, high: 36000 },
    doc_sufficiency: { overall_score: 84, gaps: ["IME not performed"], tier: "moderate" },
    benchmark_support: { match_count: 5, best_similarity: 74, tier: "moderate" },
    module_status: "published",
  },
  {
    id: "ortho-nonsurg",
    label: "Objective Ortho — Non-Surgical",
    archetype: "Profile C: Objective findings, conservative orthopedic management",
    case_number: "CF-2026-00303",
    claimant: "Catherine Novak",
    insured: "Unnamed Driver (personal auto)",
    jurisdiction: "FL — Pinellas",
    date_of_loss: "2025-05-10",
    expected_profile: "C",
    expected_profile_label: "Objective Ortho Non-Surgical",
    snapshot: SEED_3_SNAPSHOT,
    corridor: { floor: 22000, mid: 32000, high: 42000 },
    doc_sufficiency: { overall_score: 86, gaps: ["Future treatment plan not formalized"], tier: "strong" },
    benchmark_support: { match_count: 4, best_similarity: 71, tier: "moderate" },
    module_status: "valued",
  },
  {
    id: "fracture",
    label: "Fracture Case — Distal Radius + Ribs",
    archetype: "Profile D: Objective fracture with significant disability period",
    case_number: "CF-2026-00304",
    claimant: "Anthony Reeves",
    insured: "Hartford Insurance",
    jurisdiction: "TX — Harris",
    date_of_loss: "2025-04-02",
    expected_profile: "D",
    expected_profile_label: "Fracture / Significant Objective Injury",
    snapshot: SEED_4_SNAPSHOT,
    corridor: { floor: 42000, mid: 58000, high: 78000 },
    doc_sufficiency: { overall_score: 89, gaps: ["No functional capacity evaluation"], tier: "strong" },
    benchmark_support: { match_count: 3, best_similarity: 68, tier: "moderate" },
    module_status: "completed",
  },
  {
    id: "surgery",
    label: "Surgery Case — Spine + Knee (Override)",
    archetype: "Profile F: Multi-surgical, high specials, significant wage loss",
    case_number: "CF-2026-00305",
    claimant: "Patricia Morales",
    insured: "USAA",
    jurisdiction: "FL — Hillsborough",
    date_of_loss: "2025-03-14",
    expected_profile: "F",
    expected_profile_label: "Surgery",
    snapshot: SEED_5_SNAPSHOT,
    corridor: { floor: 165000, mid: 225000, high: 310000 },
    doc_sufficiency: { overall_score: 93, gaps: [], tier: "strong" },
    benchmark_support: { match_count: 4, best_similarity: 76, tier: "moderate" },
    override: {
      reason_code: "medical_evidence_update",
      reason_label: "Medical Evidence Update",
      system_corridor: { floor: 165000, mid: 225000, high: 310000 },
      override_corridor: { floor: 185000, mid: 250000, high: 340000 },
      rationale: "Updated functional capacity evaluation received after initial scoring indicates greater long-term functional impact than reflected in original treatment records. Claimant unlikely to return to bedside nursing duties requiring prolonged standing and patient lifting.",
      requires_supervisor_review: false,
    },
    module_status: "published",
  },
  {
    id: "permanency",
    label: "Impairment / Permanency — Multi-System",
    archetype: "Profile G: 12% WPI, 3 surgeries, career-ending potential",
    case_number: "CF-2026-00306",
    claimant: "Robert Tran",
    insured: "Liberty Mutual",
    jurisdiction: "TX — Jefferson",
    date_of_loss: "2025-01-08",
    expected_profile: "G",
    expected_profile_label: "Permanent Residual / Impairment",
    snapshot: SEED_6_SNAPSHOT,
    corridor: { floor: 425000, mid: 580000, high: 750000 },
    doc_sufficiency: { overall_score: 95, gaps: [], tier: "strong" },
    benchmark_support: { match_count: 2, best_similarity: 62, tier: "weak" },
    module_status: "in_progress",
  },
  {
    id: "provisional",
    label: "Provisional — Insufficient Data",
    archetype: "Profile Z: Critical documentation gaps, liability disputed",
    case_number: "CF-2026-00307",
    claimant: "Linda Hawkins",
    insured: "Progressive Insurance",
    jurisdiction: "IL — Unknown County",
    date_of_loss: "2025-11-22",
    expected_profile: "Z",
    expected_profile_label: "Insufficient Data / Provisional",
    snapshot: SEED_7_SNAPSHOT,
    corridor: { floor: 0, mid: 0, high: 0 },
    doc_sufficiency: { overall_score: 32, gaps: ["No medical records", "No police report", "No imaging", "No wage docs", "No provider details"], tier: "weak" },
    benchmark_support: { match_count: 0, best_similarity: 0, tier: "none" },
    module_status: "in_progress",
  },
];

export default EVALUATE_DEMO_SEEDS;
