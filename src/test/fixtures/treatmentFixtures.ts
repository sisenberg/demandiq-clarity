/**
 * ReviewerIQ Treatment Pipeline — Test Fixtures
 *
 * Six representative scenarios for regression testing.
 * All data is synthetic/fictional per docs/compliance/data-classification.md §2.
 */

import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";

const T = "tenant-test-001";
const C = "case-test-001";

function base(overrides: Partial<ReviewerTreatmentRecord> & { id: string }): ReviewerTreatmentRecord {
  return {
    tenant_id: T,
    case_id: C,
    source_document_id: "doc-t-001",
    source_page_start: 1,
    source_page_end: 2,
    source_snippet: "Test snippet.",
    extraction_model: "google/gemini-3-flash-preview",
    extraction_version: "1.0.0",
    extracted_at: "2026-01-01T00:00:00Z",
    visit_type: "outpatient",
    visit_date: "2025-06-01",
    visit_date_text: "06/01/2025",
    service_date_start: "2025-06-01",
    service_date_end: "2025-06-01",
    is_date_ambiguous: false,
    provider_name_raw: "Test Provider",
    provider_name_normalized: "Test Provider",
    upstream_provider_id: null,
    facility_name: "Test Facility",
    provider_specialty: "General",
    provider_npi: null,
    subjective_summary: "",
    objective_findings: "",
    assessment_summary: "",
    plan_summary: "",
    diagnoses: [],
    procedures: [],
    medications: [],
    body_parts: [],
    restrictions: [],
    follow_up_recommendations: "",
    upstream_injury_ids: [],
    upstream_bill_ids: [],
    total_billed: null,
    total_paid: null,
    overall_confidence: 0.85,
    confidence_tier: "high",
    confidence_details: { overall: 0.85 },
    review_state: "draft",
    reviewed_by: null,
    reviewed_at: null,
    reviewer_notes: "",
    is_duplicate_suspect: false,
    duplicate_of_record_id: null,
    duplicate_similarity: null,
    duplicate_reason: "",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Scenario 1: Single-provider soft tissue course ─────

export const SOFT_TISSUE_COURSE: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-st-001",
    visit_date: "2025-06-01",
    visit_date_text: "06/01/2025",
    visit_type: "emergency",
    provider_name_raw: "Metro ER",
    provider_name_normalized: "Metro ER",
    facility_name: "Metro ER",
    diagnoses: [{ code: "S13.4XXA", description: "Cervical strain", is_primary: true }],
    body_parts: ["Cervical Spine"],
    total_billed: 3200,
    overall_confidence: 0.92,
    confidence_tier: "high",
  }),
  base({
    id: "fix-st-002",
    visit_date: "2025-06-08",
    visit_date_text: "06/08/2025",
    visit_type: "physical_therapy",
    provider_name_raw: "Metro ER",
    provider_name_normalized: "Metro ER",
    facility_name: "Metro Rehab",
    diagnoses: [{ code: "S13.4XXA", description: "Cervical strain" }],
    body_parts: ["Cervical Spine"],
    total_billed: 450,
    overall_confidence: 0.88,
    confidence_tier: "high",
  }),
  base({
    id: "fix-st-003",
    visit_date: "2025-07-20",
    visit_date_text: "07/20/2025",
    visit_type: "follow_up",
    provider_name_raw: "Metro ER",
    provider_name_normalized: "Metro ER",
    facility_name: "Metro ER",
    diagnoses: [{ code: "S13.4XXA", description: "Cervical strain, resolving" }],
    body_parts: ["Cervical Spine"],
    total_billed: 275,
    overall_confidence: 0.90,
    confidence_tier: "high",
  }),
];

// ─── Scenario 2: Multi-provider escalating care ─────────

export const ESCALATING_CARE: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-ec-001",
    visit_date: "2025-05-10",
    visit_type: "emergency",
    provider_name_raw: "Valley Hospital",
    provider_name_normalized: "Valley Hospital",
    facility_name: "Valley Hospital",
    body_parts: ["Lumbar Spine"],
    total_billed: 4800,
  }),
  base({
    id: "fix-ec-002",
    visit_date: "2025-05-17",
    visit_type: "outpatient",
    provider_name_raw: "Dr. Kim",
    provider_name_normalized: "Kim",
    facility_name: "Kim Orthopedics",
    body_parts: ["Lumbar Spine"],
    total_billed: 500,
  }),
  base({
    id: "fix-ec-003",
    visit_date: "2025-06-20",
    visit_type: "radiology",
    provider_name_raw: "Regional Imaging",
    provider_name_normalized: "Regional Imaging",
    facility_name: "Regional Imaging",
    body_parts: ["Lumbar Spine"],
    total_billed: 3100,
  }),
  base({
    id: "fix-ec-004",
    visit_date: "2025-08-01",
    visit_type: "pain_management",
    provider_name_raw: "Dr. Kim",
    provider_name_normalized: "Kim",
    facility_name: "Kim Pain Clinic",
    body_parts: ["Lumbar Spine"],
    total_billed: 5500,
  }),
];

// ─── Scenario 3: Duplicate record ───────────────────────

export const DUPLICATE_RECORDS: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-dup-001",
    visit_date: "2025-07-01",
    visit_type: "outpatient",
    provider_name_raw: "Dr. Lopez",
    provider_name_normalized: "Lopez",
    total_billed: 350,
  }),
  base({
    id: "fix-dup-002",
    visit_date: "2025-07-01",
    visit_type: "outpatient",
    provider_name_raw: "Dr. Lopez",
    provider_name_normalized: "Lopez",
    total_billed: 350,
    is_duplicate_suspect: true,
    duplicate_of_record_id: "fix-dup-001",
    duplicate_similarity: 0.95,
    duplicate_reason: "Same date, provider, and visit type",
  }),
];

// ─── Scenario 4: Bill without treatment note ────────────

export const BILL_NO_TREATMENT: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-bnt-001",
    visit_date: "2025-08-15",
    visit_type: "outpatient",
    provider_name_raw: "Acme Clinic",
    provider_name_normalized: "Acme Clinic",
    total_billed: 1200,
    subjective_summary: "",
    objective_findings: "",
    assessment_summary: "",
    plan_summary: "",
    overall_confidence: 0.35,
    confidence_tier: "low",
  }),
];

// ─── Scenario 5: Treatment note without bill ────────────

export const TREATMENT_NO_BILL: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-tnb-001",
    visit_date: "2025-09-01",
    visit_type: "physical_therapy",
    provider_name_raw: "PT Solutions",
    provider_name_normalized: "PT Solutions",
    total_billed: null,
    total_paid: null,
    subjective_summary: "Patient reports improving cervical ROM.",
    objective_findings: "ROM improved to 70% in all planes.",
  }),
];

// ─── Scenario 6: Ambiguous provider naming ──────────────

export const AMBIGUOUS_PROVIDERS: ReviewerTreatmentRecord[] = [
  base({
    id: "fix-ap-001",
    visit_date: "2025-06-01",
    provider_name_raw: "Dr. Sarah Chen",
    provider_name_normalized: "Sarah Chen",
    total_billed: 400,
  }),
  base({
    id: "fix-ap-002",
    visit_date: "2025-06-15",
    provider_name_raw: "S. Chen, MD",
    provider_name_normalized: "Chen",
    total_billed: 350,
  }),
  base({
    id: "fix-ap-003",
    visit_date: "2025-07-01",
    provider_name_raw: "Chen Orthopedic Associates",
    provider_name_normalized: "Chen Orthopedic Associates",
    total_billed: 500,
  }),
];

// ─── Edge cases ─────────────────────────────────────────

export const MISSING_DATE_RECORD = base({
  id: "fix-md-001",
  visit_date: null,
  visit_date_text: "",
  provider_name_raw: "Unknown Clinic",
});

export const MISSING_PROVIDER_RECORD = base({
  id: "fix-mp-001",
  provider_name_raw: "",
  provider_name_normalized: null,
});

export const AMBIGUOUS_DATE_RECORD = base({
  id: "fix-ad-001",
  visit_date: "2025-03-04",
  visit_date_text: "03/04/25",
  is_date_ambiguous: true,
});

export const BAD_CODE_RECORD = base({
  id: "fix-bc-001",
  diagnoses: [{ code: "INVALID", description: "Some diagnosis" }],
  procedures: [{ code: "ABC", description: "Some procedure" }],
});

/** All fixtures combined for bulk tests */
export const ALL_FIXTURE_RECORDS: ReviewerTreatmentRecord[] = [
  ...SOFT_TISSUE_COURSE,
  ...ESCALATING_CARE,
  ...DUPLICATE_RECORDS,
  ...BILL_NO_TREATMENT,
  ...TREATMENT_NO_BILL,
  ...AMBIGUOUS_PROVIDERS,
  MISSING_DATE_RECORD,
  MISSING_PROVIDER_RECORD,
  AMBIGUOUS_DATE_RECORD,
  BAD_CODE_RECORD,
];
