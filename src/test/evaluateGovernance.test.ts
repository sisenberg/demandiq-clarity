/**
 * EvaluateIQ — Governance Policy Tests
 */

import { describe, it, expect } from "vitest";
import {
  validateFactorGovernance,
  enforceGovernancePolicy,
  buildGovernanceSummary,
  FORBIDDEN_FACTOR_CATEGORIES,
  GOVERNANCE_POLICY_VERSION,
} from "@/lib/evaluateGovernanceEngine";
import { FACTOR_REGISTRY, getActiveFactors } from "@/lib/factorRegistry";
import type { FactorDefinition } from "@/types/factor-taxonomy";

// Helper to create a minimal factor
function makeFactor(overrides: Partial<FactorDefinition> = {}): FactorDefinition {
  return {
    id: "test_factor",
    name: "Test Factor",
    layer: 1,
    family: "test",
    description: "Test",
    input_dependencies: [],
    score_type: "ordinal_0_5",
    scale_min: 0,
    scale_max: 5,
    default_direction: "neutral",
    evidence_requirement: "optional",
    explanation_template: "{detail}",
    version: "1.0.0",
    effective_date: "2026-03-13",
    is_active: true,
    prohibited: false,
    admin_notes: "",
    ...overrides,
  };
}

describe("Governance Policy Engine", () => {
  it("validates clean registry as compliant", () => {
    const result = validateFactorGovernance(FACTOR_REGISTRY);
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.policy_version).toBe(GOVERNANCE_POLICY_VERSION);
  });

  it("detects attorney identity factor by ID pattern", () => {
    const factors = [makeFactor({ id: "attorney_identity_score", name: "Attorney Score" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].category_id).toBe("attorney_identity");
  });

  it("detects attorney trial frequency factor", () => {
    const factors = [makeFactor({ id: "attorney_trial_frequency", name: "Trial Frequency" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "attorney_identity")).toBe(true);
  });

  it("detects forbidden dependency on attorney_name", () => {
    const factors = [makeFactor({ id: "safe_id", input_dependencies: ["attorney_name"] })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations[0].violation_type).toBe("dependency_match");
  });

  it("detects provider blacklist factor", () => {
    const factors = [makeFactor({ id: "provider_blacklist_check" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "provider_blacklist")).toBe(true);
  });

  it("detects protected class proxy by dependency", () => {
    const factors = [makeFactor({ id: "demo_adjust", input_dependencies: ["ethnicity"] })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "protected_class_proxy")).toBe(true);
  });

  it("detects neighborhood proxy factor", () => {
    const factors = [makeFactor({ id: "zip_code_factor_adjust" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "neighborhood_proxy")).toBe(true);
  });

  it("detects representation status factor", () => {
    const factors = [makeFactor({ id: "pro_se_discount" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "representation_status")).toBe(true);
  });

  it("detects raw LLM valuation factor", () => {
    const factors = [makeFactor({ id: "llm_valuation_output" })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(false);
    expect(result.violations.some(v => v.category_id === "raw_llm_valuation")).toBe(true);
  });

  it("skips explicitly prohibited factors without violation", () => {
    const factors = [makeFactor({ id: "attorney_identity_score", prohibited: true })];
    const result = validateFactorGovernance(factors);
    expect(result.valid).toBe(true);
    expect(result.prohibited_factors).toContain("attorney_identity_score");
  });

  it("enforceGovernancePolicy throws on violation", () => {
    const factors = [makeFactor({ id: "attorney_trial_check" })];
    expect(() => enforceGovernancePolicy(factors)).toThrow("GOVERNANCE VIOLATION");
  });

  it("enforceGovernancePolicy passes for clean factors", () => {
    expect(() => enforceGovernancePolicy(getActiveFactors())).not.toThrow();
  });

  it("buildGovernanceSummary returns compliant for registry", () => {
    const summary = buildGovernanceSummary(FACTOR_REGISTRY, {
      scoringEngine: "1.0.0",
      benchmarkEngine: "1.0.0",
      corridorEngine: "1.0.0",
      profileWeighting: "1.0.0",
    });
    expect(summary.governanceStatus).toBe("compliant");
    expect(summary.activeFactors).toBeGreaterThan(0);
    expect(summary.forbiddenCategories).toBe(FORBIDDEN_FACTOR_CATEGORIES.length);
  });

  it("covers all 7 forbidden categories", () => {
    expect(FORBIDDEN_FACTOR_CATEGORIES.length).toBe(7);
    const ids = FORBIDDEN_FACTOR_CATEGORIES.map(c => c.id);
    expect(ids).toContain("attorney_identity");
    expect(ids).toContain("representation_status");
    expect(ids).toContain("provider_blacklist");
    expect(ids).toContain("protected_class_proxy");
    expect(ids).toContain("neighborhood_proxy");
    expect(ids).toContain("undocumented_suppression");
    expect(ids).toContain("raw_llm_valuation");
  });
});
