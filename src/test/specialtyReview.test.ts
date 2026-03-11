/**
 * ReviewerIQ — Specialty Review Engine Regression Tests
 */

import { describe, it, expect } from "vitest";
import { groupIntoEpisodes, runSpecialtyReview } from "@/lib/specialtyReviewEngine";
import {
  CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS,
  PT_GOOD_TREATMENTS, PT_GOOD_BILLS,
  ORTHO_EARLY_ESCALATION_TREATMENTS, ORTHO_EARLY_ESCALATION_BILLS,
  PAIN_REPEAT_TREATMENTS, PAIN_REPEAT_BILLS,
  RADIOLOGY_EARLY_TREATMENTS, RADIOLOGY_EARLY_BILLS,
  SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS,
} from "@/test/fixtures/specialtyReviewFixtures";

describe("Episode Grouping", () => {
  it("groups chiropractic visits into a single episode", () => {
    const eps = groupIntoEpisodes(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    expect(eps.length).toBeGreaterThanOrEqual(1);
    const chiroEp = eps.find(e => e.specialty === "chiro");
    expect(chiroEp).toBeDefined();
    expect(chiroEp!.visit_count).toBe(20);
  });

  it("groups PT visits with evaluation", () => {
    const eps = groupIntoEpisodes(PT_GOOD_TREATMENTS, PT_GOOD_BILLS);
    expect(eps.length).toBeGreaterThanOrEqual(1);
    const ptEp = eps.find(e => e.specialty === "pt");
    expect(ptEp).toBeDefined();
  });

  it("classifies surgery episode", () => {
    const eps = groupIntoEpisodes(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS);
    const surgEp = eps.find(e => e.specialty === "surgery");
    expect(surgEp).toBeDefined();
  });
});

describe("Chiropractic Review Logic", () => {
  it("flags prolonged chiro as chronic with documentation issues", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    const chiroRec = recommendations.find(r => r.specialty_type === "chiro");
    expect(chiroRec).toBeDefined();
    expect(chiroRec!.issue_tags.length).toBeGreaterThan(0);
    // Should flag cloned notes (all assessments are identical)
    const clonedTag = chiroRec!.issue_tags.find(t => t.label.includes("Cloned"));
    expect(clonedTag).toBeDefined();
  });

  it("never outputs deny/coverage denied language", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    for (const r of recommendations) {
      expect(r.narrative_explanation).not.toMatch(/deny care|coverage denied|claim denied/i);
      expect(r.support_level).not.toBe("denied");
    }
  });
});

describe("Physical Therapy Review Logic", () => {
  it("produces recommendation for well-documented PT course", () => {
    const { recommendations } = runSpecialtyReview(PT_GOOD_TREATMENTS, PT_GOOD_BILLS);
    const ptRec = recommendations.find(r => r.specialty_type === "pt");
    expect(ptRec).toBeDefined();
    // Well-documented case should score reasonably
    expect(ptRec!.documentation_sufficiency_score).toBeGreaterThanOrEqual(50);
  });
});

describe("Orthopedics Review Logic", () => {
  it("flags surgery without prior conservative care", () => {
    const { recommendations } = runSpecialtyReview(ORTHO_EARLY_ESCALATION_TREATMENTS, ORTHO_EARLY_ESCALATION_BILLS);
    const surgRec = recommendations.find(r => r.specialty_type === "surgery");
    expect(surgRec).toBeDefined();
    expect(surgRec!.escalation_required).toBe(true);
    // Should flag no conservative care
    const conservTag = surgRec!.issue_tags.find(t => t.label.includes("conservative"));
    expect(conservTag).toBeDefined();
  });
});

describe("Pain Management Review Logic", () => {
  it("flags repeat injections without documented benefit", () => {
    const { recommendations } = runSpecialtyReview(PAIN_REPEAT_TREATMENTS, PAIN_REPEAT_BILLS);
    const painRec = recommendations.find(r => r.specialty_type === "pain_management");
    expect(painRec).toBeDefined();
    const repeatTag = painRec!.issue_tags.find(t => t.label.includes("Repeat injections"));
    expect(repeatTag).toBeDefined();
    expect(repeatTag!.severity).toBe("critical");
  });

  it("flags no prior conservative care", () => {
    const { recommendations } = runSpecialtyReview(PAIN_REPEAT_TREATMENTS, PAIN_REPEAT_BILLS);
    const painRec = recommendations.find(r => r.specialty_type === "pain_management");
    const conservTag = painRec!.issue_tags.find(t => t.label.includes("No prior conservative"));
    expect(conservTag).toBeDefined();
  });
});

describe("Radiology Review Logic", () => {
  it("flags early advanced imaging without red flags", () => {
    const { recommendations } = runSpecialtyReview(RADIOLOGY_EARLY_TREATMENTS, RADIOLOGY_EARLY_BILLS);
    const radRec = recommendations.find(r => r.specialty_type === "radiology");
    expect(radRec).toBeDefined();
    const earlyTag = radRec!.issue_tags.find(t => t.label.includes("Early advanced imaging"));
    expect(earlyTag).toBeDefined();
  });

  it("flags non-acute imaging findings", () => {
    const { recommendations } = runSpecialtyReview(RADIOLOGY_EARLY_TREATMENTS, RADIOLOGY_EARLY_BILLS);
    const radRec = recommendations.find(r => r.specialty_type === "radiology");
    const acuteTag = radRec!.issue_tags.find(t => t.label.includes("No acute findings"));
    expect(acuteTag).toBeDefined();
  });
});

describe("Surgery Review Logic", () => {
  it("always requires escalation for surgery", () => {
    const { recommendations } = runSpecialtyReview(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS);
    const surgRecs = recommendations.filter(r => r.specialty_type === "surgery");
    for (const r of surgRecs) {
      expect(r.escalation_required).toBe(true);
    }
  });

  it("properly documented surgery has better scores", () => {
    const { recommendations } = runSpecialtyReview(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS);
    const surgRec = recommendations.find(r => r.specialty_type === "surgery");
    expect(surgRec).toBeDefined();
    // Proper pathway should have better doc score
    expect(surgRec!.documentation_sufficiency_score).toBeGreaterThanOrEqual(40);
  });
});

describe("Coding Layer", () => {
  it("includes coding integrity score in all recommendations", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    for (const r of recommendations) {
      expect(r.coding_integrity_score).toBeGreaterThanOrEqual(0);
      expect(r.coding_integrity_score).toBeLessThanOrEqual(100);
    }
  });
});

describe("Safety Constraints", () => {
  it("uses only valid support_level values", () => {
    const validLevels = new Set(["supported", "partially_supported", "weakly_supported", "unsupported", "escalate"]);
    const all = [
      ...runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS).recommendations,
      ...runSpecialtyReview(PT_GOOD_TREATMENTS, PT_GOOD_BILLS).recommendations,
      ...runSpecialtyReview(PAIN_REPEAT_TREATMENTS, PAIN_REPEAT_BILLS).recommendations,
      ...runSpecialtyReview(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS).recommendations,
    ];
    for (const r of all) {
      expect(validLevels.has(r.support_level)).toBe(true);
    }
  });

  it("every recommendation has explanation and evidence", () => {
    const { recommendations } = runSpecialtyReview(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS);
    for (const r of recommendations) {
      expect(r.narrative_explanation.length).toBeGreaterThan(0);
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });
});
