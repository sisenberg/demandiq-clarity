/**
 * ReviewerIQ — Overlay & Calibration Regression Tests
 */

import { describe, it, expect } from "vitest";
import { applyOverlays, runSimulation, type OverlayContext } from "@/lib/policyOverlayEngine";
import { runCalibration } from "@/lib/calibrationRunner";
import { runSpecialtyReview } from "@/lib/specialtyReviewEngine";
import type { PolicyProfile, OverlayRule } from "@/types/policy-overlay";
import { CALIBRATION_BENCHMARKS, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES } from "@/data/mock/calibrationBenchmarks";
import {
  CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS,
  PT_GOOD_TREATMENTS, PT_GOOD_BILLS,
  SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS,
} from "@/test/fixtures/specialtyReviewFixtures";

const CTX: OverlayContext = {
  jurisdiction: "FL",
  client_id: "acme-insurance",
  claim_type: "WC",
  program: null,
  visit_count: 10,
};

describe("Policy Overlay Engine", () => {
  it("applies threshold adjustments to scores", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    const rec = recommendations.find(r => r.specialty_type === "chiro")!;
    const result = applyOverlays(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);

    // FL chiro rule adds +10 to necessity, Acme rule subtracts -5 → net +5
    expect(result.adjusted_necessity_score).toBe(rec.necessity_support_score + 5);
    expect(result.applied_overlays.length).toBeGreaterThan(0);
  });

  it("preserves base recommendation values for audit", () => {
    const { recommendations } = runSpecialtyReview(PT_GOOD_TREATMENTS, PT_GOOD_BILLS);
    const rec = recommendations[0];
    const result = applyOverlays(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);

    expect(result.base_support_level).toBe(rec.support_level);
    expect(result.base_documentation_score).toBe(rec.documentation_sufficiency_score);
    expect(result.base_coding_score).toBe(rec.coding_integrity_score);
    expect(result.base_necessity_score).toBe(rec.necessity_support_score);
  });

  it("records overlay provenance", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    const rec = recommendations.find(r => r.specialty_type === "chiro")!;
    const result = applyOverlays(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);

    for (const overlay of result.applied_overlays) {
      expect(overlay.profile_id).toBeTruthy();
      expect(overlay.profile_name).toBeTruthy();
      expect(overlay.rule_id).toBeTruthy();
      expect(overlay.action_type).toBeTruthy();
    }
  });

  it("does not de-escalate surgery (protected category)", () => {
    const { recommendations } = runSpecialtyReview(SURGERY_PROPER_TREATMENTS, SURGERY_PROPER_BILLS);
    const surgRec = recommendations.find(r => r.specialty_type === "surgery")!;

    const deEscalateProfile: PolicyProfile = {
      ...SAMPLE_POLICY_PROFILES[0],
      id: "pp-deescalate",
    };
    const deEscalateRules = new Map<string, OverlayRule[]>([
      ["pp-deescalate", [{
        id: "rule-deesc",
        profile_id: "pp-deescalate",
        name: "Attempt de-escalation",
        description: "Try to de-escalate surgery",
        is_active: true,
        target_rule_id: null,
        target_issue_type: null,
        conditions: [{ field: "specialty_type", operator: "eq" as const, value: "surgery" }],
        actions: [{ type: "escalation_override" as const, target_field: null, value: null, text: null, severity_mode: "informational" }],
        priority: 1,
        created_at: "",
        updated_at: "",
      }]],
    ]);

    const result = applyOverlays(surgRec, [deEscalateProfile], deEscalateRules, CTX);
    // Surgery must remain escalated
    expect(result.adjusted_escalation_required).toBe(true);
  });

  it("chains overlays in correct order (jurisdiction → client)", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    const rec = recommendations.find(r => r.specialty_type === "chiro")!;
    const result = applyOverlays(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);

    // Should have both FL jurisdiction and Acme client overlays
    const scopes = result.applied_overlays.map(o => o.scope);
    const jurisdictionIdx = scopes.indexOf("jurisdiction");
    const clientIdx = scopes.indexOf("client");
    if (jurisdictionIdx >= 0 && clientIdx >= 0) {
      expect(jurisdictionIdx).toBeLessThan(clientIdx);
    }
  });
});

describe("Simulation Engine", () => {
  it("produces comparison with deltas", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    const rec = recommendations.find(r => r.specialty_type === "chiro")!;
    const sim = runSimulation(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);

    expect(sim.base.support_level).toBe(rec.support_level);
    expect(sim.recommendation_id).toBe(rec.id);
    expect(typeof sim.deltas.documentation_delta).toBe("number");
    expect(typeof sim.deltas.necessity_delta).toBe("number");
  });
});

describe("Calibration Runner", () => {
  it("runs all benchmark cases and produces results", () => {
    const run = runCalibration(CALIBRATION_BENCHMARKS);
    expect(run.total_cases).toBe(CALIBRATION_BENCHMARKS.length);
    expect(run.results.length).toBe(CALIBRATION_BENCHMARKS.length);
    expect(run.engine_version).toBeTruthy();
    expect(run.match_count + run.partial_match_count + run.false_positive_count + run.false_negative_count + run.needs_review_count)
      .toBe(run.total_cases);
  });

  it("produces valid result types", () => {
    const validTypes = new Set(["match", "partial_match", "false_positive", "false_negative", "needs_review"]);
    const run = runCalibration(CALIBRATION_BENCHMARKS);
    for (const r of run.results) {
      expect(validTypes.has(r.result_type)).toBe(true);
    }
  });

  it("surgery cases always show escalation_required", () => {
    const run = runCalibration(CALIBRATION_BENCHMARKS);
    const surgResults = run.results.filter(r => r.specialty === "surgery");
    for (const r of surgResults) {
      expect(r.actual_escalation).toBe(true);
    }
  });

  it("runs with overlays applied", () => {
    const run = runCalibration(
      CALIBRATION_BENCHMARKS,
      SAMPLE_POLICY_PROFILES,
      SAMPLE_OVERLAY_RULES,
      CTX,
    );
    expect(run.total_cases).toBe(CALIBRATION_BENCHMARKS.length);
    expect(run.profile_id).toBeTruthy();
  });

  it("calibration results are immutable snapshots", () => {
    const run1 = runCalibration(CALIBRATION_BENCHMARKS);
    const run2 = runCalibration(CALIBRATION_BENCHMARKS);
    // IDs should be different (timestamp-based)
    expect(run1.id).not.toBe(run2.id);
    // But results should be deterministic
    expect(run1.match_count).toBe(run2.match_count);
    expect(run1.false_positive_count).toBe(run2.false_positive_count);
  });
});

describe("Safety Constraints", () => {
  it("never outputs deny/coverage denied in overlay explanations", () => {
    const { recommendations } = runSpecialtyReview(CHIRO_PROLONGED_TREATMENTS, CHIRO_PROLONGED_BILLS);
    for (const rec of recommendations) {
      const result = applyOverlays(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, CTX);
      for (const text of result.overlay_explanation_additions) {
        expect(text).not.toMatch(/deny care|coverage denied|claim denied/i);
      }
    }
  });
});
