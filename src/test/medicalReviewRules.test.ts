/**
 * Tests for ReviewerIQ medical review rules, reference pricing, and clinical Phase 1 rules.
 */

import { describe, it, expect } from "vitest";
import { runMedicalReviewRules, DEFAULT_MEDICAL_REVIEW_CONFIG, jaccardSimilarity } from "@/lib/medicalReviewRules";
import { lookupReferencePrice, computeVariance, isHighVariance, computeReferenceTotal } from "@/lib/referencePricing";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import {
  SOFT_TISSUE_COURSE,
  ESCALATING_CARE,
  DUPLICATE_RECORDS,
  BILL_NO_TREATMENT,
  TREATMENT_NO_BILL,
} from "@/test/fixtures/treatmentFixtures";

// ─── Reference Pricing Tests ────────────────────────────

describe("Reference Pricing", () => {
  it("returns Medicare reference for known CPT codes", () => {
    const ref = lookupReferencePrice("99283");
    expect(ref).not.toBeNull();
    expect(ref!.medicare_national).toBe(148);
    expect(ref!.geographic_factor).toBeGreaterThan(0);
    expect(ref!.adjusted_amount).toBeGreaterThan(0);
    expect(ref!.basis).toContain("Medicare");
  });

  it("returns null for unknown CPT codes", () => {
    expect(lookupReferencePrice("XXXXX")).toBeNull();
  });

  it("applies geographic adjustment", () => {
    const ref = lookupReferencePrice("72141"); // MRI cervical
    expect(ref).not.toBeNull();
    expect(ref!.adjusted_amount).toBeCloseTo(380 * 1.12, 0);
  });

  it("computes variance correctly", () => {
    const { variance_amount, variance_pct } = computeVariance(3200, 425);
    expect(variance_amount).toBe(2775);
    expect(variance_pct).toBe(753);
  });

  it("identifies high variance", () => {
    expect(isHighVariance(753)).toBe(true);
    expect(isHighVariance(150)).toBe(false);
    expect(isHighVariance(200)).toBe(false);
    expect(isHighVariance(201)).toBe(true);
  });

  it("computes reference total for multiple codes", () => {
    const total = computeReferenceTotal([
      { cpt_code: "97110", units: 4 },
      { cpt_code: "97140", units: 2 },
    ]);
    expect(total).toBeGreaterThan(0);
  });
});

// ─── Medical Review Rules Tests ─────────────────────────

describe("Medical Review Rules", () => {
  const emptyBillLines: ReviewerBillLine[] = [];

  it("generates no issues for clean single-provider course", () => {
    const issues = runMedicalReviewRules(SOFT_TISSUE_COURSE, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      soft_tissue_recovery_days: 180,
    });
    const frequencyIssues = issues.filter(i => i.issue_type === "excessive_visit_frequency");
    expect(frequencyIssues).toHaveLength(0);
  });

  it("flags treatment beyond soft-tissue recovery window", () => {
    const issues = runMedicalReviewRules(ESCALATING_CARE, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      soft_tissue_recovery_days: 7,
    });
    const windowIssues = issues.filter(i => i.issue_type === "treatment_beyond_recovery_window");
    for (const issue of windowIssues) {
      expect(issue.machine_explanation).toContain("soft-tissue");
    }
  });

  it("flags treatment records without bills", () => {
    const issues = runMedicalReviewRules(TREATMENT_NO_BILL, emptyBillLines);
    const noBillIssues = issues.filter(i => i.issue_type === "treatment_no_bill");
    expect(noBillIssues.length).toBeGreaterThan(0);
    expect(noBillIssues[0].severity).toBe("low");
  });

  it("flags escalation without findings", () => {
    const injectionNoFindings: ReviewerTreatmentRecord[] = [{
      ...ESCALATING_CARE[0],
      id: "test-escalation",
      procedures: [{ code: "64483", description: "ESI" }],
      objective_findings: "",
    }];
    const issues = runMedicalReviewRules(injectionNoFindings, emptyBillLines);
    const escalationIssues = issues.filter(i => i.issue_type === "escalation_without_findings");
    expect(escalationIssues.length).toBeGreaterThan(0);
  });

  it("flags high variance pricing in bill lines", () => {
    const highBillLine: ReviewerBillLine[] = [{
      id: "test-high", tenant_id: "t", case_id: "c", bill_header_id: "bh",
      service_date: "2024-12-01", service_date_end: null, service_date_raw: "12/01/2024",
      cpt_code: "72141", cpt_code_raw: "72141", hcpcs_code: null, icd_codes: [], modifiers: [],
      revenue_code: null, units: 1, billed_amount: 3200, billed_amount_raw: "$3,200",
      reference_amount: 425, reference_basis: "Medicare 2024",
      variance_amount: 2775, variance_pct: 753,
      description: "MRI cervical spine", description_raw: "MRI cervical spine",
      upstream_treatment_id: null, treatment_review_id: null, upstream_provider_id: null,
      provider_name: "Test", facility_name: "Test",
      source_page: null, source_snippet: "",
      extraction_confidence: "high", extraction_confidence_score: 0.9,
      disposition: "pending", accepted_amount: null,
      reduction_reason: "", reviewer_notes: "",
      reviewed_by: null, reviewed_at: null,
      flags: [], created_at: "", updated_at: "",
    }];

    const issues = runMedicalReviewRules([], highBillLine);
    const pricingIssues = issues.filter(i => i.issue_type === "high_variance_pricing");
    expect(pricingIssues.length).toBe(1);
    expect(pricingIssues[0].questioned_amount).toBe(2775);
    expect(pricingIssues[0].severity).toBe("high");
  });

  it("includes machine explanation on all issues", () => {
    const issues = runMedicalReviewRules(ESCALATING_CARE, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      soft_tissue_recovery_days: 10,
    });
    for (const issue of issues) {
      expect(issue.machine_explanation).toBeTruthy();
      expect(issue.machine_explanation.length).toBeGreaterThan(10);
    }
  });

  it("all issues have required fields", () => {
    const issues = runMedicalReviewRules(DUPLICATE_RECORDS, emptyBillLines);
    for (const issue of issues) {
      expect(issue.id).toBeTruthy();
      expect(issue.issue_type).toBeTruthy();
      expect(issue.severity).toBeTruthy();
      expect(issue.title).toBeTruthy();
      expect(issue.disposition).toBe("pending");
      expect(issue.disposition_history).toEqual([]);
    }
  });

  it("bills without linked treatments are flagged", () => {
    const orphanBill: ReviewerBillLine[] = [{
      id: "orphan", tenant_id: "t", case_id: "c", bill_header_id: "bh",
      service_date: "2024-12-01", service_date_end: null, service_date_raw: "12/01/2024",
      cpt_code: "99283", cpt_code_raw: "99283", hcpcs_code: null, icd_codes: [], modifiers: [],
      revenue_code: null, units: 1, billed_amount: 2500, billed_amount_raw: "$2,500",
      reference_amount: 148, reference_basis: "Medicare",
      variance_amount: 2352, variance_pct: 1689,
      description: "ED visit", description_raw: "ED visit",
      upstream_treatment_id: "nonexistent-id", treatment_review_id: null, upstream_provider_id: null,
      provider_name: "Test Hospital", facility_name: "Test Hospital",
      source_page: null, source_snippet: "",
      extraction_confidence: "high", extraction_confidence_score: 0.9,
      disposition: "pending", accepted_amount: null,
      reduction_reason: "", reviewer_notes: "",
      reviewed_by: null, reviewed_at: null,
      flags: [], created_at: "", updated_at: "",
    }];

    const issues = runMedicalReviewRules([], orphanBill);
    const noTxIssues = issues.filter(i => i.issue_type === "bill_no_treatment_note");
    expect(noTxIssues.length).toBe(1);
  });
});

// ─── Clinical Phase 1 Rules ────────────────────────────

describe("Clinical Phase 1 — Prolonged Care with Weak Findings", () => {
  const emptyBillLines: ReviewerBillLine[] = [];

  it("flags prolonged care with weak objective findings", () => {
    // Create 6 PT visits spanning 120 days, later ones with no findings
    const records: ReviewerTreatmentRecord[] = Array.from({ length: 6 }, (_, i) => ({
      ...SOFT_TISSUE_COURSE[1], // PT template
      id: `pcwf-${i}`,
      visit_date: `2025-0${Math.min(i + 1, 9)}-${String((i * 20) % 28 + 1).padStart(2, "0")}`,
      visit_type: "physical_therapy" as const,
      objective_findings: i < 2 ? "ROM cervical 60% flexion, tenderness C5-C6" : "", // weak after first 2
      total_billed: 400,
    }));

    const issues = runMedicalReviewRules(records, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      soft_tissue_recovery_days: 30, // tight window
    });
    const pwf = issues.filter(i => i.issue_type === "prolonged_care_weak_findings");
    expect(pwf.length).toBeGreaterThanOrEqual(1);
    expect(pwf[0].severity).toBe("high");
    expect(pwf[0].machine_explanation).toContain("weak");
  });
});

describe("Clinical Phase 1 — Near-Identical Notes", () => {
  const emptyBillLines: ReviewerBillLine[] = [];

  it("flags near-identical consecutive assessment notes", () => {
    const templateNote = "Patient reports continued cervical pain rated 6/10. ROM limited. Continue current treatment plan with PT exercises and modalities. Follow up in two weeks.";
    const records: ReviewerTreatmentRecord[] = Array.from({ length: 5 }, (_, i) => ({
      ...SOFT_TISSUE_COURSE[1],
      id: `nin-${i}`,
      visit_date: `2025-06-${String(i * 7 + 1).padStart(2, "0")}`,
      assessment_summary: templateNote, // identical notes
    }));

    const issues = runMedicalReviewRules(records, emptyBillLines);
    const ninIssues = issues.filter(i => i.issue_type === "near_identical_notes");
    expect(ninIssues.length).toBeGreaterThanOrEqual(1);
    expect(ninIssues[0].severity).toBe("medium");
    expect(ninIssues[0].machine_explanation).toContain("similarity");
  });

  it("does not flag dissimilar notes", () => {
    const records: ReviewerTreatmentRecord[] = [
      { ...SOFT_TISSUE_COURSE[1], id: "dsn-1", visit_date: "2025-06-01", assessment_summary: "Initial evaluation cervical strain. ROM 40% flex. Tenderness bilateral." },
      { ...SOFT_TISSUE_COURSE[1], id: "dsn-2", visit_date: "2025-06-08", assessment_summary: "Patient improving significantly. Full ROM restored. Discharge from therapy recommended." },
      { ...SOFT_TISSUE_COURSE[1], id: "dsn-3", visit_date: "2025-06-15", assessment_summary: "Final visit. No pain reported. Patient cleared for full activity return." },
    ];
    const issues = runMedicalReviewRules(records, emptyBillLines);
    const ninIssues = issues.filter(i => i.issue_type === "near_identical_notes");
    expect(ninIssues).toHaveLength(0);
  });
});

describe("Clinical Phase 1 — Gap Then Intensive Care", () => {
  const emptyBillLines: ReviewerBillLine[] = [];

  it("flags intensive care resumption after treatment gap", () => {
    const records: ReviewerTreatmentRecord[] = [
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-1", visit_date: "2025-03-01", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-2", visit_date: "2025-03-05", total_billed: 400 },
      // 45-day gap
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-3", visit_date: "2025-04-20", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-4", visit_date: "2025-04-22", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-5", visit_date: "2025-04-24", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-6", visit_date: "2025-04-26", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-7", visit_date: "2025-04-28", total_billed: 400 },
      { ...SOFT_TISSUE_COURSE[1], id: "gtic-8", visit_date: "2025-04-30", total_billed: 400 },
    ];

    const issues = runMedicalReviewRules(records, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      treatment_gap_days: 30,
      post_gap_intensive_visits_per_week: 3,
    });
    const gapIssues = issues.filter(i => i.issue_type === "gap_then_intensive_care");
    expect(gapIssues.length).toBeGreaterThanOrEqual(1);
    expect(gapIssues[0].machine_explanation).toContain("gap");
  });
});

describe("Clinical Phase 1 — Provider Utilization Pattern", () => {
  const emptyBillLines: ReviewerBillLine[] = [];

  it("flags providers with high billing concentration", () => {
    // 10 visits from one provider = $4000, 2 from another = $200
    const records: ReviewerTreatmentRecord[] = [
      ...Array.from({ length: 10 }, (_, i) => ({
        ...SOFT_TISSUE_COURSE[1],
        id: `pup-main-${i}`,
        visit_date: `2025-06-${String(i + 1).padStart(2, "0")}`,
        provider_name_normalized: "Heavy Provider",
        total_billed: 400,
      })),
      { ...SOFT_TISSUE_COURSE[1], id: "pup-other-1", visit_date: "2025-06-01", provider_name_normalized: "Light Provider", total_billed: 100 },
      { ...SOFT_TISSUE_COURSE[1], id: "pup-other-2", visit_date: "2025-06-02", provider_name_normalized: "Light Provider", total_billed: 100 },
    ];

    const issues = runMedicalReviewRules(records, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      provider_pattern_min_visits: 8,
      provider_concentration_pct: 60,
    });
    const pupIssues = issues.filter(i => i.issue_type === "provider_utilization_pattern");
    expect(pupIssues.length).toBe(1);
    expect(pupIssues[0].affected_provider).toBe("Heavy Provider");
    expect(pupIssues[0].machine_explanation).toContain("%");
  });
});

describe("Jaccard Similarity Helper", () => {
  it("returns 1 for identical strings", () => {
    expect(jaccardSimilarity("the quick brown fox", "the quick brown fox")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(jaccardSimilarity("alpha beta gamma", "delta epsilon zeta")).toBe(0);
  });

  it("returns partial overlap score", () => {
    const sim = jaccardSimilarity("the quick brown fox", "the slow brown cat");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  it("handles empty strings", () => {
    expect(jaccardSimilarity("", "test")).toBe(0);
    expect(jaccardSimilarity("", "")).toBe(1);
  });
});

// ─── Reviewer Package Structure Tests ───────────────────

describe("ReviewerPackage contract", () => {
  it("REVIEWER_PACKAGE_VERSION is defined", async () => {
    const { REVIEWER_PACKAGE_VERSION } = await import("@/types/reviewer-package");
    expect(REVIEWER_PACKAGE_VERSION).toBe("1.0.0");
  });
});
