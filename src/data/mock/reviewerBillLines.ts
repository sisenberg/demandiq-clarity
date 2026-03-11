/**
 * ReviewerIQ — Mock Bill Line Items with Reference Pricing
 * Represents the Martinez v. Pacific Freight Lines demo case.
 * Updated for enhanced bill types with raw/normalized fields.
 */

import type { ReviewerBillHeader, ReviewerBillLine } from "@/types/reviewer-bills";
import { lookupReferencePrice, computeVariance } from "@/lib/referencePricing";

const T = "tenant-001";
const C = "case-001";

function makeLine(
  id: string, headerId: string, serviceDate: string, cptCode: string,
  desc: string, units: number, billed: number,
  provider: string, facility: string,
  treatmentId: string | null = null,
  extra: Partial<ReviewerBillLine> = {},
): ReviewerBillLine {
  const ref = lookupReferencePrice(cptCode);
  const refAmt = ref ? ref.adjusted_amount * units : null;
  const variance = refAmt ? computeVariance(billed, refAmt) : null;

  return {
    id, tenant_id: T, case_id: C, bill_header_id: headerId,
    service_date: serviceDate, service_date_end: null,
    service_date_raw: serviceDate,
    cpt_code: cptCode, cpt_code_raw: cptCode,
    hcpcs_code: null, icd_codes: [], modifiers: [],
    revenue_code: null, units, billed_amount: billed,
    billed_amount_raw: `$${billed.toLocaleString()}`,
    reference_amount: refAmt, reference_basis: ref?.basis ?? "No reference available",
    variance_amount: variance?.variance_amount ?? null,
    variance_pct: variance?.variance_pct ?? null,
    description: desc, description_raw: desc,
    upstream_treatment_id: treatmentId, treatment_review_id: null,
    upstream_provider_id: null,
    provider_name: provider, facility_name: facility,
    source_page: null, source_snippet: "",
    extraction_confidence: "high", extraction_confidence_score: 0.9,
    disposition: "pending", accepted_amount: null,
    reduction_reason: "", reviewer_notes: "",
    reviewed_by: null, reviewed_at: null,
    flags: [],
    created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z",
    ...extra,
  };
}

export const MOCK_BILL_LINES: ReviewerBillLine[] = [
  // ER Visit
  makeLine("bl-001", "bh-001", "2024-11-15", "99283", "ED visit, moderate severity", 1, 2800, "Mercy General Hospital", "Mercy General Hospital", "rtr-001"),
  makeLine("bl-002", "bh-001", "2024-11-15", "70450", "CT head without contrast", 1, 1480, "Mercy General Hospital", "Mercy General Hospital", "rtr-001"),

  // Orthopedic consultation
  makeLine("bl-003", "bh-002", "2024-11-18", "99243", "Orthopedic consultation", 1, 475, "Dr. Sarah Chen", "Chen Orthopedic Associates", "rtr-002"),

  // MRI
  makeLine("bl-004", "bh-003", "2024-12-02", "72141", "MRI cervical spine w/o contrast", 1, 3200, "Regional Radiology Associates", "Regional Radiology Associates", "rtr-003"),
  makeLine("bl-005", "bh-003", "2024-12-02", "73721", "MRI right knee w/o contrast", 1, 3200, "Regional Radiology Associates", "Regional Radiology Associates"),

  // Physical Therapy (representative sessions)
  makeLine("bl-006", "bh-004", "2024-12-10", "97162", "PT evaluation, moderate complexity", 1, 250, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-007", "bh-004", "2024-12-12", "97110", "Therapeutic exercise, 15 min", 4, 640, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-008", "bh-004", "2024-12-12", "97140", "Manual therapy, 15 min", 2, 320, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-009", "bh-004", "2025-01-06", "97110", "Therapeutic exercise, 15 min", 4, 640, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-010", "bh-004", "2025-01-06", "97530", "Therapeutic activities, 15 min", 2, 320, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-011", "bh-004", "2025-02-03", "97110", "Therapeutic exercise, 15 min", 4, 640, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),
  makeLine("bl-012", "bh-004", "2025-03-10", "97110", "Therapeutic exercise, 15 min", 4, 640, "Advanced Rehabilitation Center", "Advanced Rehabilitation Center", "rtr-004"),

  // Pain Management — ESIs
  makeLine("bl-013", "bh-005", "2025-01-15", "64483", "Transforaminal ESI, cervical", 1, 4800, "Dr. Raj Patel", "Sacramento Pain Management", "rtr-005"),
  makeLine("bl-014", "bh-005", "2025-01-15", "77003", "Fluoroscopic guidance", 1, 1400, "Dr. Raj Patel", "Sacramento Pain Management", "rtr-005"),

  // Follow-up visit
  makeLine("bl-015", "bh-002", "2024-12-16", "99214", "Office visit, moderate complexity", 1, 225, "Dr. Sarah Chen", "Chen Orthopedic Associates", "rtr-007"),

  // Pharmacy (no CPT — flagged)
  {
    id: "bl-016", tenant_id: T, case_id: C, bill_header_id: "bh-006",
    service_date: "2024-11-15", service_date_end: null,
    service_date_raw: "11/15/2024",
    cpt_code: null, cpt_code_raw: "",
    hcpcs_code: null, icd_codes: ["M50.12", "M54.5"],
    modifiers: [], revenue_code: null, units: 1, billed_amount: 1920,
    billed_amount_raw: "$1,920.00",
    reference_amount: null, reference_basis: "No CPT code — pharmacy/prescription",
    variance_amount: null, variance_pct: null,
    description: "Rx: Meloxicam 15mg, Cyclobenzaprine 10mg, Gabapentin 300mg",
    description_raw: "Rx: Meloxicam 15mg, Cyclobenzaprine 10mg, Gabapentin 300mg",
    upstream_treatment_id: null, treatment_review_id: null, upstream_provider_id: null,
    provider_name: "CVS Pharmacy", facility_name: "CVS Pharmacy",
    source_page: null, source_snippet: "",
    extraction_confidence: "medium", extraction_confidence_score: 0.7,
    disposition: "pending", accepted_amount: null,
    reduction_reason: "", reviewer_notes: "",
    reviewed_by: null, reviewed_at: null,
    flags: [{ type: "missing_code", severity: "info", message: "No CPT/HCPCS code — pharmacy charge" }],
    created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z",
  },
];

export const MOCK_BILL_HEADERS: ReviewerBillHeader[] = [
  { id: "bh-001", tenant_id: T, case_id: C, upstream_bill_id: "bill-001", bill_format: "ub04", source_document_id: "doc-002", source_page_start: 1, source_page_end: 4, source_snippet: "ER bill", provider_name_raw: "Mercy General Hospital", provider_name_normalized: "Mercy General Hospital", upstream_provider_id: null, provider_npi: null, facility_name: "Mercy General Hospital", statement_date: "2024-11-15", bill_date: null, total_billed: 4280, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: 4280, extraction_confidence: "high", extraction_confidence_score: 0.93, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 2, flagged_line_count: 0, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
  { id: "bh-002", tenant_id: T, case_id: C, upstream_bill_id: "bill-002", bill_format: "cms1500", source_document_id: "doc-003", source_page_start: 1, source_page_end: 3, source_snippet: "Ortho bill", provider_name_raw: "Dr. Sarah Chen", provider_name_normalized: "Sarah Chen", upstream_provider_id: null, provider_npi: null, facility_name: "Chen Orthopedic Associates", statement_date: null, bill_date: "2024-12-20", total_billed: 700, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: 700, extraction_confidence: "high", extraction_confidence_score: 0.90, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 2, flagged_line_count: 0, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
  { id: "bh-003", tenant_id: T, case_id: C, upstream_bill_id: "bill-003", bill_format: "ub04", source_document_id: "doc-004", source_page_start: 1, source_page_end: 7, source_snippet: "Radiology bill", provider_name_raw: "Regional Radiology Associates", provider_name_normalized: "Regional Radiology Associates", upstream_provider_id: null, provider_npi: null, facility_name: "Regional Radiology Associates", statement_date: "2024-12-02", bill_date: null, total_billed: 6400, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: 6400, extraction_confidence: "high", extraction_confidence_score: 0.92, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 2, flagged_line_count: 0, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
  { id: "bh-004", tenant_id: T, case_id: C, upstream_bill_id: "bill-004", bill_format: "provider_ledger", source_document_id: "doc-005", source_page_start: 1, source_page_end: 2, source_snippet: "PT ledger", provider_name_raw: "Advanced Rehabilitation Center", provider_name_normalized: "Advanced Rehabilitation Center", upstream_provider_id: null, provider_npi: null, facility_name: "Advanced Rehabilitation Center", statement_date: null, bill_date: null, total_billed: 3450, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: null, extraction_confidence: "medium", extraction_confidence_score: 0.78, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 7, flagged_line_count: 0, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
  { id: "bh-005", tenant_id: T, case_id: C, upstream_bill_id: "bill-005", bill_format: "cms1500", source_document_id: "doc-006", source_page_start: 1, source_page_end: 1, source_snippet: "Pain mgmt bill", provider_name_raw: "Dr. Raj Patel", provider_name_normalized: "Raj Patel", upstream_provider_id: null, provider_npi: null, facility_name: "Sacramento Pain Management", statement_date: "2025-01-15", bill_date: null, total_billed: 6200, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: 6200, extraction_confidence: "high", extraction_confidence_score: 0.91, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 2, flagged_line_count: 0, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
  { id: "bh-006", tenant_id: T, case_id: C, upstream_bill_id: "bill-006", bill_format: "pharmacy", source_document_id: null, source_page_start: null, source_page_end: null, source_snippet: "", provider_name_raw: "CVS Pharmacy", provider_name_normalized: "CVS Pharmacy", upstream_provider_id: null, provider_npi: null, facility_name: "CVS Pharmacy", statement_date: null, bill_date: null, total_billed: 1920, total_reference: 0, total_accepted: 0, total_reduced: 0, total_disputed: 0, statement_total_printed: null, extraction_confidence: "medium", extraction_confidence_score: 0.65, extraction_model: "google/gemini-3-flash-preview", extraction_version: "1.0.0", extracted_at: "2025-03-10T12:00:00Z", review_state: "draft", reviewed_by: null, reviewed_at: null, reviewer_notes: "", line_count: 1, flagged_line_count: 1, flags: [], created_at: "2025-03-10T12:00:00Z", updated_at: "2025-03-10T12:00:00Z" },
];
