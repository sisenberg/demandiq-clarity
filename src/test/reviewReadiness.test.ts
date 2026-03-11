import { describe, it, expect } from "vitest";
import {
  generateReviewFlags,
  assessReadiness,
  getRecordIdsWithFlags,
  getFlagsForRecord,
  type ReadinessConfig,
} from "@/lib/reviewReadiness";
import {
  SOFT_TISSUE_COURSE,
  ESCALATING_CARE,
  DUPLICATE_RECORDS,
  BILL_NO_TREATMENT,
  TREATMENT_NO_BILL,
  AMBIGUOUS_PROVIDERS,
  MISSING_DATE_RECORD,
  MISSING_PROVIDER_RECORD,
  AMBIGUOUS_DATE_RECORD,
  BAD_CODE_RECORD,
  ALL_FIXTURE_RECORDS,
} from "./fixtures/treatmentFixtures";

const CFG: ReadinessConfig = {
  gapThresholdDays: 30,
  lowConfidenceThreshold: 0.5,
  providerSimilarityThreshold: 0.7,
};

describe("generateReviewFlags", () => {
  it("flags missing visit date as error", () => {
    const flags = generateReviewFlags([MISSING_DATE_RECORD], CFG);
    const dateFlags = flags.filter((f) => f.category === "missing_date");
    expect(dateFlags).toHaveLength(1);
    expect(dateFlags[0].severity).toBe("error");
    expect(dateFlags[0].recordId).toBe(MISSING_DATE_RECORD.id);
  });

  it("flags missing provider as error", () => {
    const flags = generateReviewFlags([MISSING_PROVIDER_RECORD], CFG);
    const provFlags = flags.filter((f) => f.category === "missing_provider");
    expect(provFlags).toHaveLength(1);
    expect(provFlags[0].severity).toBe("error");
  });

  it("flags duplicate visits as warning", () => {
    const flags = generateReviewFlags(DUPLICATE_RECORDS, CFG);
    const dupFlags = flags.filter((f) => f.category === "duplicate_visit");
    expect(dupFlags).toHaveLength(1);
    expect(dupFlags[0].severity).toBe("warning");
    expect(dupFlags[0].recordId).toBe("fix-dup-002");
  });

  it("flags treatment without bill as warning", () => {
    const flags = generateReviewFlags(TREATMENT_NO_BILL, CFG);
    const noBill = flags.filter((f) => f.category === "treatment_no_bill");
    expect(noBill).toHaveLength(1);
    expect(noBill[0].recordId).toBe("fix-tnb-001");
  });

  it("does not flag IME records for missing bills", () => {
    const ime = { ...TREATMENT_NO_BILL[0], id: "ime-1", visit_type: "ime" as const };
    const flags = generateReviewFlags([ime], CFG);
    expect(flags.filter((f) => f.category === "treatment_no_bill")).toHaveLength(0);
  });

  it("flags ambiguous date extraction", () => {
    const flags = generateReviewFlags([AMBIGUOUS_DATE_RECORD], CFG);
    const ambig = flags.filter((f) => f.category === "ambiguous_extraction");
    expect(ambig).toHaveLength(1);
  });

  it("flags low confidence records", () => {
    const flags = generateReviewFlags(BILL_NO_TREATMENT, CFG);
    const lowConf = flags.filter((f) => f.category === "low_confidence");
    expect(lowConf).toHaveLength(1);
  });

  it("flags unsupported code formats", () => {
    const flags = generateReviewFlags([BAD_CODE_RECORD], CFG);
    const codeFlags = flags.filter((f) => f.category === "unsupported_code_format");
    expect(codeFlags).toHaveLength(2); // 1 diagnosis + 1 procedure
  });

  it("detects chronology gaps exceeding threshold", () => {
    // SOFT_TISSUE_COURSE: Jun 1 → Jun 8 (7d) → Jul 20 (42d gap)
    const flags = generateReviewFlags(SOFT_TISSUE_COURSE, CFG);
    const gaps = flags.filter((f) => f.category === "chronology_gap");
    expect(gaps).toHaveLength(1);
    expect(gaps[0].description).toContain("42");
  });

  it("does not flag gaps under threshold", () => {
    const flags = generateReviewFlags(SOFT_TISSUE_COURSE, { ...CFG, gapThresholdDays: 60 });
    const gaps = flags.filter((f) => f.category === "chronology_gap");
    expect(gaps).toHaveLength(0);
  });

  it("every flag has a non-empty action", () => {
    const flags = generateReviewFlags(ALL_FIXTURE_RECORDS, CFG);
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) {
      expect(f.action.length).toBeGreaterThan(0);
    }
  });
});

describe("assessReadiness", () => {
  it("returns review_ready for clean records", () => {
    const clean = SOFT_TISSUE_COURSE.map((r) => ({
      ...r,
      // remove the 42-day gap by bringing visit dates closer
    }));
    // Use escalating care which has no errors
    const assessment = assessReadiness(ESCALATING_CARE, { ...CFG, gapThresholdDays: 999 });
    expect(assessment.status).toBe("review_ready");
    expect(assessment.score).toBeGreaterThanOrEqual(75);
  });

  it("returns not_ready when errors exist", () => {
    const assessment = assessReadiness([MISSING_DATE_RECORD, MISSING_PROVIDER_RECORD], CFG);
    expect(assessment.status).toBe("not_ready");
    expect(assessment.errorCount).toBeGreaterThanOrEqual(2);
  });

  it("returns partially_ready with many warnings", () => {
    const records = [...DUPLICATE_RECORDS, ...TREATMENT_NO_BILL, ...BILL_NO_TREATMENT, AMBIGUOUS_DATE_RECORD];
    const assessment = assessReadiness(records, CFG);
    expect(["partially_ready", "not_ready"]).toContain(assessment.status);
    expect(assessment.warningCount).toBeGreaterThan(0);
  });

  it("score is bounded 0–100", () => {
    const assessment = assessReadiness(ALL_FIXTURE_RECORDS, CFG);
    expect(assessment.score).toBeGreaterThanOrEqual(0);
    expect(assessment.score).toBeLessThanOrEqual(100);
  });

  it("summary is non-empty when flags exist", () => {
    const assessment = assessReadiness(ALL_FIXTURE_RECORDS, CFG);
    expect(assessment.summary.length).toBeGreaterThan(0);
    expect(assessment.summary).not.toBe("All treatment records pass readiness checks.");
  });

  it("categoryCounts sums match total flags", () => {
    const assessment = assessReadiness(ALL_FIXTURE_RECORDS, CFG);
    const sum = Object.values(assessment.categoryCounts).reduce((a, b) => a + b, 0);
    expect(sum).toBe(assessment.flags.length);
  });
});

describe("getRecordIdsWithFlags / getFlagsForRecord", () => {
  it("returns correct set of flagged record IDs", () => {
    const flags = generateReviewFlags(DUPLICATE_RECORDS, CFG);
    const ids = getRecordIdsWithFlags(flags);
    expect(ids.has("fix-dup-002")).toBe(true);
  });

  it("getFlagsForRecord filters correctly", () => {
    const flags = generateReviewFlags([MISSING_DATE_RECORD, AMBIGUOUS_DATE_RECORD], CFG);
    const specific = getFlagsForRecord(flags, MISSING_DATE_RECORD.id);
    expect(specific.every((f) => f.recordId === MISSING_DATE_RECORD.id)).toBe(true);
  });
});
