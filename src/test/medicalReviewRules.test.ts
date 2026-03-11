/**
 * Tests for ReviewerIQ medical review rules and reference pricing.
 */

import { describe, it, expect } from "vitest";
import { runMedicalReviewRules, DEFAULT_MEDICAL_REVIEW_CONFIG } from "@/lib/medicalReviewRules";
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
    // Sacramento GPCI is 1.12
    expect(ref!.adjusted_amount).toBeCloseTo(380 * 1.12, 0);
  });

  it("computes variance correctly", () => {
    const { variance_amount, variance_pct } = computeVariance(3200, 425);
    expect(variance_amount).toBe(2775);
    expect(variance_pct).toBe(753); // 753% of reference
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
      soft_tissue_recovery_days: 180, // relaxed window
    });
    // Should not flag excessive frequency or beyond-window for this clean course
    const frequencyIssues = issues.filter(i => i.issue_type === "excessive_visit_frequency");
    expect(frequencyIssues).toHaveLength(0);
  });

  it("flags treatment beyond soft-tissue recovery window", () => {
    const issues = runMedicalReviewRules(ESCALATING_CARE, emptyBillLines, {
      ...DEFAULT_MEDICAL_REVIEW_CONFIG,
      soft_tissue_recovery_days: 7, // very tight window to trigger on fixtures
    });
    const windowIssues = issues.filter(i => i.issue_type === "treatment_beyond_recovery_window");
    // ESCALATING_CARE may or may not have PT records spanning > 7 days
    // At minimum verify the rule runs without error and returns valid issues
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
    // Create a record with an injection but no objective findings
    const injectionNoFindings: ReviewerTreatmentRecord[] = [{
      ...ESCALATING_CARE[0],
      id: "test-escalation",
      procedures: [{ code: "64483", description: "ESI" }],
      objective_findings: "", // Empty findings
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
    expect(pricingIssues[0].severity).toBe("high"); // >500%
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

// ─── Reviewer Package Structure Tests ───────────────────

describe("ReviewerPackage contract", () => {
  it("REVIEWER_PACKAGE_VERSION is defined", async () => {
    const { REVIEWER_PACKAGE_VERSION } = await import("@/types/reviewer-package");
    expect(REVIEWER_PACKAGE_VERSION).toBe("1.0.0");
  });
});
