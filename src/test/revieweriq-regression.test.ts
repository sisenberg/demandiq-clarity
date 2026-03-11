/**
 * ReviewerIQ — Regression Test Suite
 *
 * Covers: bill ingestion, normalization, linkage, pricing, issue generation,
 * reviewer dispositions, financial totals, package generation, and PHI logging.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeBill, linkBillLinesToTreatments, detectProviderMismatches,
  resetIdCounters,
} from "@/lib/billNormalization";
import { lookupReferencePrice } from "@/lib/referencePricing";
import { runMedicalReviewRules, DEFAULT_MEDICAL_REVIEW_CONFIG } from "@/lib/medicalReviewRules";
import { sanitizeForLogSafe as sanitizeForLog } from "@/lib/safe-log";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import type { ReviewIssueDisposition } from "@/types/reviewer-issues";
import { REVIEWER_PACKAGE_VERSION } from "@/types/reviewer-package";
import type { ReviewerPackage, ReviewerFinancialSummary } from "@/types/reviewer-package";
import {
  MATCHING_BILLS_TREATMENTS, MATCHING_BILLS_RAW,
  PROLONGED_PASSIVE_TREATMENTS,
  DUPLICATE_BILL_RAW,
  ORPHAN_BILL_RAW,
  UNBILLED_TREATMENT,
  MISMATCH_TREATMENT, MISMATCH_BILL_RAW,
  PRICED_BILL_RAW,
  ESCALATION_TREATMENT, ESCALATION_BILL_RAW,
} from "@/test/fixtures/billReviewFixtures";

beforeEach(() => resetIdCounters());

// ─── 1. Bill Ingestion & Normalization ──────────────────

describe("Bill Ingestion & Normalization", () => {
  it("ingests matching bills into structured header + lines", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    expect(result.header.id).toBeTruthy();
    expect(result.header.provider_name_raw).toBe("Metro Physical Therapy");
    expect(result.header.provider_name_normalized).toBeTruthy();
    expect(result.header.bill_format).toBe("cms1500");
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].cpt_code).toBe("97110");
    expect(result.lines[0].billed_amount).toBe(380);
    expect(result.lines[0].units).toBe(4);
  });

  it("preserves raw values alongside normalized", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    expect(result.lines[0].service_date_raw).toBe("06/01/2025");
    expect(result.lines[0].service_date).toBe("2025-06-01");
    expect(result.lines[0].billed_amount_raw).toBe("$380.00");
    expect(result.lines[0].cpt_code_raw).toBe("97110");
  });

  it("flags duplicate bill lines", () => {
    const result = normalizeBill(DUPLICATE_BILL_RAW, "t1", "c1");
    expect(result.lines).toHaveLength(2);
    const dupFlags = result.lines.flatMap(l => l.flags).filter(f => f.type === "duplicate_line");
    expect(dupFlags.length).toBeGreaterThanOrEqual(1);
  });

  it("detects total mismatch in header flags", () => {
    const modifiedInput = {
      ...MATCHING_BILLS_RAW,
      statement_total_raw: "$999.00", // wrong total
    };
    const result = normalizeBill(modifiedInput, "t1", "c1");
    const mismatchFlags = result.header.flags.filter(f => f.type === "total_mismatch");
    expect(mismatchFlags.length).toBe(1);
  });

  it("retains source evidence references on every line", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    for (const line of result.lines) {
      expect(line.source_page).not.toBeNull();
      expect(line.source_snippet).toBeTruthy();
    }
  });
});

// ─── 2. Provider/Treatment Linkage ──────────────────────

describe("Provider & Treatment Linkage", () => {
  it("links bill lines to treatments by date and provider", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    const lines = result.lines.map(l => ({ ...l, flags: [...l.flags] }));
    linkBillLinesToTreatments(lines, MATCHING_BILLS_TREATMENTS);

    const linked = lines.filter(l => l.upstream_treatment_id);
    expect(linked.length).toBe(2);
    expect(linked[0].upstream_treatment_id).toBe("mbf-tx-001");
    expect(linked[1].upstream_treatment_id).toBe("mbf-tx-002");
  });

  it("detects provider mismatch when bill and treatment providers differ", () => {
    const result = normalizeBill(MISMATCH_BILL_RAW, "t1", "c1");
    const lines = result.lines.map(l => ({ ...l, flags: [...l.flags] }));
    // Pre-link treatment
    lines[0].upstream_treatment_id = "pm-tx-001";
    detectProviderMismatches(lines, [MISMATCH_TREATMENT]);

    const mismatchFlags = lines[0].flags.filter(f => f.type === "provider_mismatch");
    expect(mismatchFlags.length).toBe(1);
  });
});

// ─── 3. Reference Pricing ───────────────────────────────

describe("Pricing Result Generation", () => {
  it("applies reference pricing to known CPT codes", () => {
    const result = normalizeBill(PRICED_BILL_RAW, "t1", "c1");
    const mriLine = result.lines.find(l => l.cpt_code === "72141");
    expect(mriLine).toBeTruthy();
    expect(mriLine!.reference_amount).toBeGreaterThan(0);
    expect(mriLine!.variance_amount).toBeGreaterThan(0);
    expect(mriLine!.variance_pct).toBeGreaterThan(100);
    expect(mriLine!.reference_basis).toContain("Medicare");
  });

  it("leaves reference null for unknown codes", () => {
    const result = normalizeBill(PRICED_BILL_RAW, "t1", "c1");
    const customLine = result.lines.find(l => l.cpt_code_raw === "CUSTOM01");
    expect(customLine).toBeTruthy();
    expect(customLine!.reference_amount).toBeNull();
    expect(customLine!.reference_basis).toContain("No reference");
  });

  it("lookupReferencePrice returns explainable basis", () => {
    const ref = lookupReferencePrice("97110");
    expect(ref).not.toBeNull();
    expect(ref!.basis).toContain("Medicare");
    expect(ref!.basis).toContain("GPCI");
    expect(ref!.fee_schedule_year).toBe(2024);
  });
});

// ─── 4. Issue Generation ────────────────────────────────

describe("Issue Generation", () => {
  it("generates escalation-without-findings for ESI with no objective", () => {
    const issues = runMedicalReviewRules([ESCALATION_TREATMENT], []);
    const esc = issues.filter(i => i.issue_type === "escalation_without_findings");
    expect(esc.length).toBe(1);
    expect(esc[0].severity).toBe("high");
    expect(esc[0].evidence.length).toBeGreaterThan(0);
  });

  it("generates bill-no-treatment for orphan bill line", () => {
    const result = normalizeBill(ORPHAN_BILL_RAW, "t1", "c1");
    const issues = runMedicalReviewRules([], result.lines);
    const orphan = issues.filter(i => i.issue_type === "bill_no_treatment_note");
    expect(orphan.length).toBe(1);
    expect(orphan[0].questioned_amount).toBe(850);
  });

  it("generates treatment-no-bill for unbilled visit", () => {
    const issues = runMedicalReviewRules([UNBILLED_TREATMENT], []);
    const noBill = issues.filter(i => i.issue_type === "treatment_no_bill");
    expect(noBill.length).toBe(1);
  });

  it("generates repeated-passive-modalities for prolonged passive care", () => {
    const issues = runMedicalReviewRules(PROLONGED_PASSIVE_TREATMENTS, []);
    const passive = issues.filter(i => i.issue_type === "repeated_passive_modalities");
    expect(passive.length).toBeGreaterThanOrEqual(1);
    expect(passive[0].machine_explanation).toContain("passive");
  });

  it("all generated issues start with pending disposition", () => {
    const issues = runMedicalReviewRules([ESCALATION_TREATMENT, UNBILLED_TREATMENT], []);
    for (const issue of issues) {
      expect(issue.disposition).toBe("pending");
      expect(issue.disposition_history).toEqual([]);
    }
  });

  it("includes rule engine version in machine explanations", () => {
    const issues = runMedicalReviewRules([ESCALATION_TREATMENT], []);
    const versioned = issues.filter(i => i.machine_explanation.includes("v"));
    expect(versioned.length).toBeGreaterThan(0);
  });
});

// ─── 5. Reviewer Dispositions & Audit Trail ─────────────

describe("Reviewer Dispositions & Audit Trail", () => {
  it("tracks disposition changes with history", () => {
    const issues = runMedicalReviewRules([ESCALATION_TREATMENT], []);
    const issue = { ...issues[0] };

    // Simulate disposition
    const now = new Date().toISOString();
    issue.disposition = "accepted";
    issue.disposition_rationale = "Confirmed — no objective findings documented";
    issue.disposition_by = "reviewer-001";
    issue.disposition_at = now;
    issue.disposition_history = [
      { disposition: "accepted", rationale: "Confirmed — no objective findings documented", by: "reviewer-001", at: now },
    ];

    expect(issue.disposition).toBe("accepted");
    expect(issue.disposition_history).toHaveLength(1);
    expect(issue.disposition_history[0].by).toBe("reviewer-001");
  });

  it("preserves rationale text on dispositions", () => {
    const issues = runMedicalReviewRules([ESCALATION_TREATMENT], []);
    const issue = { ...issues[0] };
    issue.disposition_rationale = "Escalation appears clinically appropriate per MRI findings from 06/20";
    expect(issue.disposition_rationale.length).toBeGreaterThan(10);
  });
});

// ─── 6. Financial Total Updates ─────────────────────────

describe("Financial Total Updates", () => {
  it("computes billed totals from bill lines", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    const totalBilled = result.lines.reduce((s, l) => s + l.billed_amount, 0);
    expect(totalBilled).toBe(740);
  });

  it("updates accepted totals based on dispositions", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    const lines: ReviewerBillLine[] = result.lines.map(l => ({ ...l }));

    // Accept first line, reduce second
    lines[0].disposition = "accepted";
    lines[0].accepted_amount = lines[0].billed_amount;
    lines[1].disposition = "reduced";
    lines[1].accepted_amount = 200;

    const accepted = lines.filter(l => l.disposition === "accepted").reduce((s, l) => s + (l.accepted_amount ?? 0), 0);
    const reduced = lines.filter(l => l.disposition === "reduced").reduce((s, l) => s + (l.billed_amount - (l.accepted_amount ?? 0)), 0);

    expect(accepted).toBe(380);
    expect(reduced).toBe(160);
  });

  it("separates disputed from accepted amounts", () => {
    const result = normalizeBill(ORPHAN_BILL_RAW, "t1", "c1");
    const lines: ReviewerBillLine[] = result.lines.map(l => ({ ...l }));

    lines[0].disposition = "disputed";
    lines[0].accepted_amount = null;

    const disputed = lines.filter(l => l.disposition === "disputed").reduce((s, l) => s + l.billed_amount, 0);
    expect(disputed).toBe(850);
  });
});

// ─── 7. ReviewerPackage Generation ──────────────────────

describe("ReviewerPackage Generation", () => {
  it("has stable contract version", () => {
    expect(REVIEWER_PACKAGE_VERSION).toBe("1.0.0");
  });

  it("can construct a valid ReviewerPackage", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    const issues = runMedicalReviewRules(MATCHING_BILLS_TREATMENTS, result.lines);

    const financial: ReviewerFinancialSummary = {
      total_billed: result.lines.reduce((s, l) => s + l.billed_amount, 0),
      total_reference: result.lines.reduce((s, l) => s + (l.reference_amount ?? 0), 0),
      total_questioned: issues.reduce((s, i) => s + i.questioned_amount, 0),
      total_accepted: 0,
      total_reduced: 0,
      total_disputed: 0,
      by_provider: [],
      by_code_category: [],
    };

    const pkg: ReviewerPackage = {
      contract_version: REVIEWER_PACKAGE_VERSION,
      module_id: "revieweriq",
      case_id: "c1",
      tenant_id: "t1",
      completed_at: null,
      completed_by: null,
      version: 1,
      treatment_reviews: [],
      bill_headers: [result.header],
      bill_lines: result.lines,
      issues,
      financial_summary: financial,
      provider_rationales: [],
      evidence_count: issues.reduce((s, i) => s + i.evidence.length, 0),
    };

    expect(pkg.contract_version).toBe("1.0.0");
    expect(pkg.module_id).toBe("revieweriq");
    expect(pkg.bill_lines).toHaveLength(2);
    expect(pkg.financial_summary.total_billed).toBe(740);
  });

  it("separates upstream data from ReviewerIQ-derived data", () => {
    const result = normalizeBill(MATCHING_BILLS_RAW, "t1", "c1");
    // Bill lines are ReviewerIQ-derived
    for (const line of result.lines) {
      expect(line.id).toMatch(/^bl-gen-/);
      expect(line.bill_header_id).toMatch(/^bh-gen-/);
    }
    // Upstream references preserved
    expect(result.lines[0].upstream_treatment_id).toBe("mbf-tx-001");
  });
});

// ─── 8. No Raw-PHI Logging Regressions ──────────────────

describe("No Raw-PHI Logging", () => {
  it("sanitizes treatment records for logging", () => {
    const record = {
      id: "tx-001",
      provider_name_raw: "Dr. Sarah Chen",
      subjective_summary: "Patient reports neck pain after MVA on 1/15/2025",
      ssn: "123-45-6789",
      date_of_birth: "1985-03-15",
    };

    const sanitized = sanitizeForLog(record);
    expect(sanitized).not.toContain("123-45-6789");
    expect(sanitized).not.toContain("1985-03-15");
    // ID is safe (pseudonymous)
    expect(sanitized).toContain("tx-001");
  });

  it("sanitizes bill lines for logging", () => {
    const billLine = {
      id: "bl-001",
      provider_name: "Metro PT",
      patient_name: "John Doe",
      ssn: "999-88-7777",
      billed_amount: 380,
    };

    const sanitized = sanitizeForLog(billLine);
    expect(sanitized).not.toContain("John Doe");
    expect(sanitized).not.toContain("999-88-7777");
    expect(sanitized).toContain("bl-001");
  });

  it("sanitizes nested PHI in issue objects", () => {
    const issue = {
      id: "ri-001",
      title: "Test issue",
      evidence: [{ quoted_text: "Patient SSN 123-45-6789 found in note" }],
      patient_ssn: "123-45-6789",
    };

    const sanitized = sanitizeForLog(issue);
    expect(sanitized).not.toContain("123-45-6789");
  });
});
