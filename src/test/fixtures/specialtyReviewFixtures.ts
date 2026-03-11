/**
 * ReviewerIQ — Specialty Review Test Fixtures
 * Realistic scenarios per specialty for regression testing.
 */

import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";
import type { ReviewerBillLine } from "@/types/reviewer-bills";

const T = "tenant-test";
const C = "case-test";

function makeRec(id: string, overrides: Partial<ReviewerTreatmentRecord>): ReviewerTreatmentRecord {
  return {
    id, tenant_id: T, case_id: C,
    source_document_id: null, source_page_start: null, source_page_end: null,
    source_snippet: "", extraction_model: "test", extraction_version: "1.0.0",
    extracted_at: "2025-01-01T00:00:00Z",
    visit_type: "outpatient", visit_date: "2025-01-01",
    visit_date_text: "", service_date_start: "2025-01-01", service_date_end: "2025-01-01",
    is_date_ambiguous: false,
    provider_name_raw: "Test Provider", provider_name_normalized: "Test Provider",
    upstream_provider_id: null, facility_name: "Test Facility",
    provider_specialty: "", provider_npi: null,
    subjective_summary: "", objective_findings: "", assessment_summary: "", plan_summary: "",
    diagnoses: [], procedures: [], medications: [],
    body_parts: [], restrictions: [], follow_up_recommendations: "",
    upstream_injury_ids: [], upstream_bill_ids: [],
    total_billed: 200, total_paid: null,
    overall_confidence: 0.9, confidence_tier: "high" as const,
    confidence_details: { overall: 0.9 },
    review_state: "draft" as const,
    reviewed_by: null, reviewed_at: null, reviewer_notes: "",
    is_duplicate_suspect: false, duplicate_of_record_id: null,
    duplicate_similarity: null, duplicate_reason: "",
    created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as ReviewerTreatmentRecord;
}

function makeBillLine(id: string, headerId: string, overrides: Partial<ReviewerBillLine>): ReviewerBillLine {
  return {
    id, tenant_id: T, case_id: C, bill_header_id: headerId,
    service_date: "2025-01-01", service_date_end: null, service_date_raw: "2025-01-01",
    cpt_code: "99213", cpt_code_raw: "99213",
    hcpcs_code: null, icd_codes: [], modifiers: [], revenue_code: null,
    units: 1, billed_amount: 200, billed_amount_raw: "$200",
    reference_amount: null, reference_basis: "", variance_amount: null, variance_pct: null,
    description: "Test service", description_raw: "Test service",
    upstream_treatment_id: null, treatment_review_id: null, upstream_provider_id: null,
    provider_name: "Test Provider", facility_name: "Test Facility",
    source_page: null, source_snippet: "",
    extraction_confidence: "high" as const, extraction_confidence_score: 0.9,
    disposition: "pending" as const, accepted_amount: null,
    reduction_reason: "", reviewer_notes: "",
    reviewed_by: null, reviewed_at: null, flags: [],
    created_at: "2025-01-01T00:00:00Z", updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  } as ReviewerBillLine;
}

// ─── 1. Chiropractic: Prolonged passive care ───────────

export const CHIRO_PROLONGED_TREATMENTS: ReviewerTreatmentRecord[] = Array.from({ length: 20 }, (_, i) => {
  const date = new Date(2025, 0, 1 + i * 3); // every 3 days for 60 days
  const dateStr = date.toISOString().split("T")[0];
  return makeRec(`chiro-${i}`, {
    visit_type: "chiropractic",
    visit_date: dateStr,
    service_date_start: dateStr,
    provider_name_raw: "Dr. Spine Adjuster",
    provider_name_normalized: "Dr. Spine Adjuster",
    provider_specialty: "Chiropractic",
    body_parts: ["Cervical Spine", "Lumbar Spine"],
    subjective_summary: i === 0 ? "Patient presents after MVA with neck and back pain." : "Ongoing neck and back pain.",
    objective_findings: i === 0 ? "Cervical ROM limited 30%. Lumbar tenderness." : "Tender",
    assessment_summary: "Cervical and lumbar strain",
    plan_summary: i === 0 ? "Chiro adjustments 3x/week for 8 weeks" : "Continue treatment",
    diagnoses: [{ code: "S13.4XXA", description: "Cervical strain", is_primary: true }],
    procedures: [
      { code: "98941", description: "Chiro manipulation 3-4 regions" },
      { code: "97010", description: "Hot/cold packs" },
    ],
    total_billed: 180,
  });
});

export const CHIRO_PROLONGED_BILLS: ReviewerBillLine[] = CHIRO_PROLONGED_TREATMENTS.map((t, i) =>
  makeBillLine(`chiro-bl-${i}`, "bh-chiro", {
    service_date: t.visit_date!,
    cpt_code: "98941",
    description: "Chiro manipulation",
    units: 1,
    billed_amount: 120,
    provider_name: "Dr. Spine Adjuster",
    upstream_treatment_id: t.id,
  })
);

// ─── 2. PT: Good case with progression ─────────────────

export const PT_GOOD_TREATMENTS: ReviewerTreatmentRecord[] = [
  makeRec("pt-eval", {
    visit_type: "physical_therapy", visit_date: "2025-01-05",
    provider_name_raw: "Good PT Clinic", provider_name_normalized: "Good PT Clinic",
    body_parts: ["Right Shoulder"],
    objective_findings: "ROM: shoulder flexion 120/180. Strength: 3+/5. VAS pain score 7/10.",
    plan_summary: "PT 3x/week x 6 weeks. Goals: improve ROM to WNL, strength to 4+/5, return to work.",
    procedures: [{ code: "97163", description: "PT eval high complexity" }],
    total_billed: 250,
  }),
  ...Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2025, 0, 7 + i * 3);
    return makeRec(`pt-visit-${i}`, {
      visit_type: "physical_therapy", visit_date: date.toISOString().split("T")[0],
      provider_name_raw: "Good PT Clinic", provider_name_normalized: "Good PT Clinic",
      body_parts: ["Right Shoulder"],
      objective_findings: `ROM improving: shoulder flexion ${130 + i * 4}/180. Strength: ${i > 6 ? "4/5" : "3+/5"}. VAS ${Math.max(2, 7 - i)}/10.`,
      procedures: [
        { code: "97110", description: "Therapeutic exercise" },
        { code: "97140", description: "Manual therapy" },
      ],
      total_billed: 320,
    });
  }),
];

export const PT_GOOD_BILLS: ReviewerBillLine[] = [
  makeBillLine("pt-bl-eval", "bh-pt", { service_date: "2025-01-05", cpt_code: "97163", billed_amount: 250, provider_name: "Good PT Clinic", upstream_treatment_id: "pt-eval" }),
  ...Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2025, 0, 7 + i * 3);
    return makeBillLine(`pt-bl-${i}`, "bh-pt", {
      service_date: date.toISOString().split("T")[0],
      cpt_code: "97110",
      units: 3,
      billed_amount: 240,
      provider_name: "Good PT Clinic",
      upstream_treatment_id: `pt-visit-${i}`,
    });
  }),
];

// ─── 3. Ortho: Escalation without conservative care ────

export const ORTHO_EARLY_ESCALATION_TREATMENTS: ReviewerTreatmentRecord[] = [
  makeRec("ortho-consult", {
    visit_type: "outpatient", visit_date: "2025-01-10",
    provider_name_raw: "Dr. Quick Surgeon", provider_name_normalized: "Dr. Quick Surgeon",
    provider_specialty: "Orthopedic Surgery",
    body_parts: ["Right Knee"],
    subjective_summary: "Patient fell at work. Right knee pain and swelling.",
    objective_findings: "Right knee effusion. ROM limited. Lachman negative. McMurray equivocal.",
    assessment_summary: "Right knee internal derangement.",
    plan_summary: "MRI right knee. Consider arthroscopy.",
    diagnoses: [{ code: "M23.20", description: "Right knee derangement" }],
    procedures: [{ code: "99243", description: "Ortho consultation" }],
    total_billed: 400,
  }),
  makeRec("ortho-surgery", {
    visit_type: "surgery", visit_date: "2025-02-01",
    provider_name_raw: "Dr. Quick Surgeon", provider_name_normalized: "Dr. Quick Surgeon",
    body_parts: ["Right Knee"],
    objective_findings: "Under anesthesia. Arthroscopic findings: partial meniscus tear.",
    assessment_summary: "Partial medial meniscus tear, right knee.",
    procedures: [{ code: "29881", description: "Knee arthroscopy with meniscectomy" }],
    total_billed: 12000,
  }),
];

export const ORTHO_EARLY_ESCALATION_BILLS: ReviewerBillLine[] = [
  makeBillLine("ortho-bl-1", "bh-ortho", { service_date: "2025-01-10", cpt_code: "99243", billed_amount: 400, provider_name: "Dr. Quick Surgeon", upstream_treatment_id: "ortho-consult" }),
  makeBillLine("ortho-bl-2", "bh-ortho", { service_date: "2025-02-01", cpt_code: "29881", billed_amount: 12000, provider_name: "Dr. Quick Surgeon", upstream_treatment_id: "ortho-surgery" }),
];

// ─── 4. Pain Management: Repeat injections ─────────────

export const PAIN_REPEAT_TREATMENTS: ReviewerTreatmentRecord[] = [
  ...Array.from({ length: 4 }, (_, i) => {
    const date = new Date(2025, 0, 15 + i * 30);
    return makeRec(`pain-inj-${i}`, {
      visit_type: "pain_management", visit_date: date.toISOString().split("T")[0],
      provider_name_raw: "Dr. Needle Happy", provider_name_normalized: "Dr. Needle Happy",
      provider_specialty: "Interventional Pain",
      body_parts: ["Lumbar Spine"],
      subjective_summary: "Persistent low back pain.",
      objective_findings: "Tenderness L4-L5. Straight leg raise equivocal.",
      assessment_summary: "Lumbar radiculopathy.",
      plan_summary: "ESI L4-L5.",
      diagnoses: [{ code: "M54.5", description: "Lumbar radiculopathy" }],
      procedures: [{ code: "62323", description: "Lumbar interlaminar ESI" }],
      total_billed: 4500,
    });
  }),
];

export const PAIN_REPEAT_BILLS: ReviewerBillLine[] = PAIN_REPEAT_TREATMENTS.map((t, i) =>
  makeBillLine(`pain-bl-${i}`, "bh-pain", {
    service_date: t.visit_date!,
    cpt_code: "62323",
    billed_amount: 4500,
    provider_name: "Dr. Needle Happy",
    upstream_treatment_id: t.id,
  })
);

// ─── 5. Radiology: Early advanced imaging ──────────────

export const RADIOLOGY_EARLY_TREATMENTS: ReviewerTreatmentRecord[] = [
  makeRec("rad-er", {
    visit_type: "emergency", visit_date: "2025-01-01",
    provider_name_raw: "ER Hospital", provider_name_normalized: "ER Hospital",
    body_parts: ["Lumbar Spine"],
    subjective_summary: "Low back pain after lifting.",
    objective_findings: "Lumbar tenderness. Normal neurological exam. No red flags.",
    assessment_summary: "Acute lumbar strain.",
    diagnoses: [{ code: "S39.012A", description: "Lumbar strain" }],
    procedures: [{ code: "99283", description: "ER visit" }],
    total_billed: 2000,
  }),
  makeRec("rad-mri", {
    visit_type: "radiology", visit_date: "2025-01-05",
    provider_name_raw: "Quick Imaging Center", provider_name_normalized: "Quick Imaging Center",
    body_parts: ["Lumbar Spine"],
    objective_findings: "MRI lumbar spine: mild degenerative disc disease L4-L5. No acute findings.",
    assessment_summary: "Degenerative changes. No acute pathology.",
    diagnoses: [{ code: "M51.36", description: "Lumbar disc degeneration" }],
    procedures: [{ code: "72148", description: "MRI lumbar spine w/o contrast" }],
    total_billed: 2800,
  }),
];

export const RADIOLOGY_EARLY_BILLS: ReviewerBillLine[] = [
  makeBillLine("rad-bl-1", "bh-rad", { service_date: "2025-01-01", cpt_code: "99283", billed_amount: 2000, provider_name: "ER Hospital", upstream_treatment_id: "rad-er" }),
  makeBillLine("rad-bl-2", "bh-rad", { service_date: "2025-01-05", cpt_code: "72148", billed_amount: 2800, provider_name: "Quick Imaging Center", upstream_treatment_id: "rad-mri" }),
];

// ─── 6. Surgery: Proper pathway ────────────────────────

export const SURGERY_PROPER_TREATMENTS: ReviewerTreatmentRecord[] = [
  makeRec("surg-consult", {
    visit_type: "outpatient", visit_date: "2025-01-15",
    provider_name_raw: "Dr. Careful Surgeon", provider_name_normalized: "Dr. Careful Surgeon",
    body_parts: ["Cervical Spine"],
    objective_findings: "Cervical ROM limited 40%. Motor deficit C6 distribution 4-/5. Hyperreflexia bilateral.",
    assessment_summary: "C5-C6 herniation with myelopathy.",
    procedures: [{ code: "99243", description: "Consultation" }],
    total_billed: 500,
  }),
  makeRec("surg-imaging", {
    visit_type: "radiology", visit_date: "2025-01-20",
    provider_name_raw: "Imaging Center", provider_name_normalized: "Imaging Center",
    body_parts: ["Cervical Spine"],
    objective_findings: "MRI: C5-C6 large disc herniation with cord compression. Myelopathy signal.",
    procedures: [{ code: "72141", description: "MRI cervical spine" }],
    total_billed: 3000,
  }),
  makeRec("surg-op", {
    visit_type: "surgery", visit_date: "2025-03-01",
    provider_name_raw: "Dr. Careful Surgeon", provider_name_normalized: "Dr. Careful Surgeon",
    body_parts: ["Cervical Spine"],
    objective_findings: "Under GA. ACDF C5-C6 performed without complication. Cord decompression confirmed.",
    assessment_summary: "ACDF C5-C6 for myelopathic herniation.",
    procedures: [{ code: "22551", description: "ACDF single level" }],
    total_billed: 35000,
  }),
];

export const SURGERY_PROPER_BILLS: ReviewerBillLine[] = [
  makeBillLine("surg-bl-1", "bh-surg", { service_date: "2025-01-15", cpt_code: "99243", billed_amount: 500, provider_name: "Dr. Careful Surgeon", upstream_treatment_id: "surg-consult" }),
  makeBillLine("surg-bl-2", "bh-surg", { service_date: "2025-01-20", cpt_code: "72141", billed_amount: 3000, provider_name: "Imaging Center", upstream_treatment_id: "surg-imaging" }),
  makeBillLine("surg-bl-3", "bh-surg", { service_date: "2025-03-01", cpt_code: "22551", billed_amount: 35000, provider_name: "Dr. Careful Surgeon", upstream_treatment_id: "surg-op" }),
];
