/**
 * ReviewerIQ — Bill Review Test Fixtures
 *
 * Eight representative billing scenarios for regression testing.
 * All data is synthetic/fictional per docs/compliance/data-classification.md §2.
 */

import type { RawBillInput, ReviewerBillLine } from "@/types/reviewer-bills";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";

const T = "tenant-test-001";
const C = "case-test-001";

// ─── Helper: base treatment record ──────────────────────

function baseTx(overrides: Partial<ReviewerTreatmentRecord> & { id: string }): ReviewerTreatmentRecord {
  return {
    tenant_id: T, case_id: C,
    source_document_id: "doc-fix-001", source_page_start: 1, source_page_end: 2,
    source_snippet: "Test snippet.", extraction_model: "google/gemini-3-flash-preview",
    extraction_version: "1.0.0", extracted_at: "2026-01-01T00:00:00Z",
    visit_type: "outpatient", visit_date: "2025-06-01", visit_date_text: "06/01/2025",
    service_date_start: "2025-06-01", service_date_end: "2025-06-01",
    is_date_ambiguous: false, provider_name_raw: "Test Provider",
    provider_name_normalized: "Test Provider", upstream_provider_id: null,
    facility_name: "Test Facility", provider_specialty: "General", provider_npi: null,
    subjective_summary: "", objective_findings: "", assessment_summary: "",
    plan_summary: "", diagnoses: [], procedures: [], medications: [],
    body_parts: [], restrictions: [], follow_up_recommendations: "",
    upstream_injury_ids: [], upstream_bill_ids: [],
    total_billed: null, total_paid: null,
    overall_confidence: 0.85, confidence_tier: "high", confidence_details: { overall: 0.85 },
    review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "",
    is_duplicate_suspect: false, duplicate_of_record_id: null,
    duplicate_similarity: null, duplicate_reason: "",
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Scenario 1: Straightforward soft-tissue with matching bills ──

export const MATCHING_BILLS_TREATMENTS: ReviewerTreatmentRecord[] = [
  baseTx({
    id: "mbf-tx-001", visit_date: "2025-06-01", visit_type: "physical_therapy",
    provider_name_raw: "Metro PT", provider_name_normalized: "Metro PT",
    procedures: [{ code: "97110", description: "Therapeutic exercise" }],
    total_billed: 380,
  }),
  baseTx({
    id: "mbf-tx-002", visit_date: "2025-06-08", visit_type: "physical_therapy",
    provider_name_raw: "Metro PT", provider_name_normalized: "Metro PT",
    procedures: [{ code: "97140", description: "Manual therapy" }],
    total_billed: 360,
  }),
];

export const MATCHING_BILLS_RAW: RawBillInput = {
  source_document_id: "doc-fix-001", source_page_start: 5, source_page_end: 6,
  source_snippet: "Metro PT statement",
  provider_name_raw: "Metro Physical Therapy", facility_name_raw: "Metro PT Center",
  statement_date_raw: "07/01/2025", bill_date_raw: "07/01/2025",
  statement_total_raw: "$740.00", bill_format_hint: "cms1500",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.92,
  lines: [
    {
      service_date_raw: "06/01/2025", service_date_end_raw: "",
      cpt_code_raw: "97110", hcpcs_code_raw: "", icd_codes_raw: ["M54.5"],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "4",
      billed_amount_raw: "$380.00", description_raw: "Therapeutic exercise, 15 min x4",
      source_page: 5, source_snippet: "97110 x4 $380",
      upstream_treatment_id: "mbf-tx-001", extraction_confidence_score: 0.95,
    },
    {
      service_date_raw: "06/08/2025", service_date_end_raw: "",
      cpt_code_raw: "97140", hcpcs_code_raw: "", icd_codes_raw: ["M54.5"],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "4",
      billed_amount_raw: "$360.00", description_raw: "Manual therapy, 15 min x4",
      source_page: 5, source_snippet: "97140 x4 $360",
      upstream_treatment_id: "mbf-tx-002", extraction_confidence_score: 0.93,
    },
  ],
};

// ─── Scenario 2: Prolonged chiro/PT with passive care ───

export const PROLONGED_PASSIVE_TREATMENTS: ReviewerTreatmentRecord[] = Array.from({ length: 12 }, (_, i) => baseTx({
  id: `ppc-tx-${i}`,
  visit_date: `2025-${String(Math.floor(i / 4) + 3).padStart(2, "0")}-${String((i % 4) * 7 + 1).padStart(2, "0")}`,
  visit_type: "chiropractic",
  provider_name_raw: "Spine & Wellness Center",
  provider_name_normalized: "Spine Wellness Center",
  procedures: [
    { code: "97010", description: "Hot/cold packs" },
    { code: "97032", description: "Electrical stimulation" },
  ],
  total_billed: 250,
}));

// ─── Scenario 3: Duplicate bill lines ───────────────────

export const DUPLICATE_BILL_RAW: RawBillInput = {
  source_document_id: "doc-fix-002", source_page_start: 1, source_page_end: 2,
  source_snippet: "Valley Hospital bill",
  provider_name_raw: "Valley Hospital", facility_name_raw: "Valley Hospital",
  statement_date_raw: "08/15/2025", bill_date_raw: "08/15/2025",
  statement_total_raw: "$2,400", bill_format_hint: "ub04",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.88,
  lines: [
    {
      service_date_raw: "07/10/2025", service_date_end_raw: "",
      cpt_code_raw: "99283", hcpcs_code_raw: "", icd_codes_raw: [],
      modifiers_raw: [], revenue_code_raw: "0450", units_raw: "1",
      billed_amount_raw: "$1,200", description_raw: "ED visit moderate",
      source_page: 1, source_snippet: "99283 $1200",
      upstream_treatment_id: null, extraction_confidence_score: 0.90,
    },
    {
      service_date_raw: "07/10/2025", service_date_end_raw: "",
      cpt_code_raw: "99283", hcpcs_code_raw: "", icd_codes_raw: [],
      modifiers_raw: [], revenue_code_raw: "0450", units_raw: "1",
      billed_amount_raw: "$1,200", description_raw: "ED visit moderate",
      source_page: 1, source_snippet: "99283 $1200 (duplicate)",
      upstream_treatment_id: null, extraction_confidence_score: 0.88,
    },
  ],
};

// ─── Scenario 4: Bill with no treatment note ────────────

export const ORPHAN_BILL_RAW: RawBillInput = {
  source_document_id: "doc-fix-003", source_page_start: 3, source_page_end: 3,
  source_snippet: "Standalone bill",
  provider_name_raw: "Dr. Unknown", facility_name_raw: "Unknown Clinic",
  statement_date_raw: "09/01/2025", bill_date_raw: "09/01/2025",
  statement_total_raw: "$850", bill_format_hint: "cms1500",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.75,
  lines: [
    {
      service_date_raw: "08/20/2025", service_date_end_raw: "",
      cpt_code_raw: "99214", hcpcs_code_raw: "", icd_codes_raw: ["M54.5"],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
      billed_amount_raw: "$850", description_raw: "Office visit moderate",
      source_page: 3, source_snippet: "99214 $850",
      upstream_treatment_id: null, extraction_confidence_score: 0.78,
    },
  ],
};

// ─── Scenario 5: Treatment note with no bill ────────────

export const UNBILLED_TREATMENT: ReviewerTreatmentRecord = baseTx({
  id: "ubt-tx-001", visit_date: "2025-09-15", visit_type: "physical_therapy",
  provider_name_raw: "PT Solutions", provider_name_normalized: "PT Solutions",
  subjective_summary: "Patient reports cervical stiffness improving.",
  objective_findings: "ROM 75% all planes. Strength 4+/5 bilaterally.",
  assessment_summary: "Progressing well. Continue current plan.",
  total_billed: null, total_paid: null,
});

// ─── Scenario 6: Provider mismatch ──────────────────────

export const MISMATCH_TREATMENT: ReviewerTreatmentRecord = baseTx({
  id: "pm-tx-001", visit_date: "2025-07-10", visit_type: "outpatient",
  provider_name_raw: "Dr. Smith Orthopedics", provider_name_normalized: "Smith",
  total_billed: 500,
});

export const MISMATCH_BILL_RAW: RawBillInput = {
  source_document_id: "doc-fix-004", source_page_start: 1, source_page_end: 1,
  source_snippet: "Jones clinic bill",
  provider_name_raw: "Dr. Jones Chiropractic", facility_name_raw: "Jones Clinic",
  statement_date_raw: "08/01/2025", bill_date_raw: "08/01/2025",
  statement_total_raw: "$500", bill_format_hint: "provider_ledger",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.85,
  lines: [
    {
      service_date_raw: "07/10/2025", service_date_end_raw: "",
      cpt_code_raw: "99214", hcpcs_code_raw: "", icd_codes_raw: [],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
      billed_amount_raw: "$500", description_raw: "Office visit",
      source_page: 1, source_snippet: "99214 $500",
      upstream_treatment_id: "pm-tx-001", extraction_confidence_score: 0.82,
    },
  ],
};

// ─── Scenario 7: Pricing available vs unavailable ───────

export const PRICED_BILL_RAW: RawBillInput = {
  source_document_id: "doc-fix-005", source_page_start: 1, source_page_end: 1,
  source_snippet: "Imaging center bill",
  provider_name_raw: "Regional Imaging", facility_name_raw: "Regional Imaging",
  statement_date_raw: "07/15/2025", bill_date_raw: "07/15/2025",
  statement_total_raw: "$4,500", bill_format_hint: "cms1500",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.90,
  lines: [
    {
      service_date_raw: "07/01/2025", service_date_end_raw: "",
      cpt_code_raw: "72141", hcpcs_code_raw: "", icd_codes_raw: [],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
      billed_amount_raw: "$3,200", description_raw: "MRI cervical spine w/o contrast",
      source_page: 1, source_snippet: "72141 $3200",
      upstream_treatment_id: null, extraction_confidence_score: 0.92,
    },
    {
      service_date_raw: "07/01/2025", service_date_end_raw: "",
      cpt_code_raw: "CUSTOM01", hcpcs_code_raw: "", icd_codes_raw: [],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
      billed_amount_raw: "$1,300", description_raw: "Proprietary imaging analysis",
      source_page: 1, source_snippet: "CUSTOM01 $1300",
      upstream_treatment_id: null, extraction_confidence_score: 0.80,
    },
  ],
};

// ─── Scenario 8: Escalation without supporting findings ─

export const ESCALATION_TREATMENT: ReviewerTreatmentRecord = baseTx({
  id: "esc-tx-001", visit_date: "2025-08-01", visit_type: "pain_management",
  provider_name_raw: "Dr. Kim Pain Clinic", provider_name_normalized: "Kim",
  procedures: [{ code: "64483", description: "Transforaminal epidural" }],
  objective_findings: "", // no findings
  total_billed: 5500,
});

export const ESCALATION_BILL_RAW: RawBillInput = {
  source_document_id: "doc-fix-006", source_page_start: 1, source_page_end: 1,
  source_snippet: "Pain clinic bill",
  provider_name_raw: "Kim Pain Management", facility_name_raw: "Kim Pain Clinic",
  statement_date_raw: "08/15/2025", bill_date_raw: "08/15/2025",
  statement_total_raw: "$5,500", bill_format_hint: "cms1500",
  extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0",
  extraction_confidence_score: 0.88,
  lines: [
    {
      service_date_raw: "08/01/2025", service_date_end_raw: "",
      cpt_code_raw: "64483", hcpcs_code_raw: "", icd_codes_raw: ["M54.5"],
      modifiers_raw: [], revenue_code_raw: "", units_raw: "1",
      billed_amount_raw: "$5,500", description_raw: "Transforaminal epidural injection",
      source_page: 1, source_snippet: "64483 $5500",
      upstream_treatment_id: "esc-tx-001", extraction_confidence_score: 0.90,
    },
  ],
};
