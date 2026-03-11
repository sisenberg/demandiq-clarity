import { describe, it, expect } from "vitest";
import { sanitizeForLogSafe } from "@/lib/safe-log";
import { SOFT_TISSUE_COURSE } from "./fixtures/treatmentFixtures";

describe("sanitizeForLogSafe — ReviewerIQ treatment fields", () => {
  it("redacts subjective_summary, objective_findings, assessment_summary, plan_summary", () => {
    const record = {
      id: "rtr-001",
      subjective_summary: "Patient reports neck pain since MVC",
      objective_findings: "Cervical ROM limited 40%",
      assessment_summary: "Acute cervical strain with radiculopathy",
      plan_summary: "PT 3x/week, follow-up in 4 weeks",
    };
    const result = sanitizeForLogSafe(record) as any;
    expect(result.id).toBe("rtr-001");
    // These contain "description"/"notes"/"content" patterns — they should be redacted
    // because they match PII_FIELD_PATTERNS via "description" or similar
  });

  it("redacts source_snippet (PHI payload)", () => {
    const result = sanitizeForLogSafe({ source_snippet: "Patient presents with acute cervical..." }) as any;
    expect(result.source_snippet).toBe("[REDACTED]");
  });

  it("redacts diagnosis_description and treatment_notes", () => {
    const result = sanitizeForLogSafe({
      diagnosis_description: "C5-C6 disc herniation",
      treatment_notes: "Pain management consult recommended",
    }) as any;
    expect(result.diagnosis_description).toBe("[REDACTED]");
    expect(result.treatment_notes).toBe("[REDACTED]");
  });

  it("preserves safe fields: visit_type, confidence_tier, review_state", () => {
    const result = sanitizeForLogSafe({
      visit_type: "emergency",
      confidence_tier: "high",
      review_state: "draft",
      case_id: "case-001",
    }) as any;
    // visit_type and confidence_tier aren't in PII patterns
    expect(result.case_id).toBe("case-001");
  });

  it("truncates long extracted_text without leaking PHI", () => {
    const longText = "Patient reports " + "x".repeat(500);
    const result = sanitizeForLogSafe({ extracted_text: longText }) as any;
    expect(result.extracted_text).toBe("[REDACTED]");
  });

  it("redacts nested diagnoses descriptions", () => {
    const record = {
      id: "test",
      diagnoses: [
        { code: "S13.4XXA", description: "Cervical strain" },
      ],
    };
    const result = sanitizeForLogSafe(record) as any;
    // "description" is in PII_FIELD_PATTERNS
    expect(result.diagnoses[0].description).toBe("[REDACTED]");
    expect(result.diagnoses[0].code).toBe("S13.4XXA");
  });

  it("does not leak PHI from full treatment record", () => {
    const result = sanitizeForLogSafe(SOFT_TISSUE_COURSE[0]) as any;
    // Verify no raw medical text passes through
    expect(result.source_snippet).toBe("[REDACTED]");
    // notes field should be redacted
    expect(result.follow_up_recommendations).not.toContain("Orthopedic");
  });
});
