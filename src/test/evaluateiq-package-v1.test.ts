/**
 * EvaluateIQ — EvaluatePackage v1 Contract Tests
 *
 * Tests covering:
 *  - Package validation (required fields, corridor sanity, state checks)
 *  - Publication state transitions
 *  - Serialization for registry
 *  - Shape detection for legacy vs v1 payloads
 */

import { describe, it, expect } from "vitest";
import type { EvaluatePackageV1 } from "@/types/evaluate-package-v1";
import { EVALUATE_PACKAGE_CONTRACT_VERSION, VALID_PUBLICATION_TRANSITIONS } from "@/types/evaluate-package-v1";
import {
  validateEvaluatePackage,
  validatePublicationTransition,
  serializeForRegistry,
  isEvaluatePackageV1Shape,
} from "@/lib/evaluatePackageValidator";

// ─── Factory ────────────────────────────────────────────

function makeMinimalPackage(overrides?: Partial<EvaluatePackageV1>): EvaluatePackageV1 {
  return {
    contract_version: EVALUATE_PACKAGE_CONTRACT_VERSION,
    case_id: "case-001",
    claim_id: "claim-001",
    evaluation_id: "eval-001",
    tenant_id: "tenant-001",
    package_version: 1,
    evaluation_status: "draft",
    scoring_logic_version: "1.0.0",
    benchmark_logic_version: "1.0.0",
    engine_version: "1.0.0",
    source_module: "revieweriq",
    source_package_version: 1,
    snapshot_id: "snap-001",
    valuation_run_id: "vr-001",
    selection_id: null,
    claim_profile: {
      claimant_name: "Jane Doe",
      claimant_dob: "1985-03-15",
      date_of_loss: "2025-06-01",
      mechanism_of_loss: "Rear-end collision",
      jurisdiction_state: "FL",
      venue_county: "Broward",
      policy_type: "BI",
      policy_limits: 100000,
      comparative_negligence_pct: null,
      injury_count: 2,
      provider_count: 3,
      treatment_duration_days: 180,
    },
    merits: {
      merits_score: 72,
      merits_label: "above_average",
      corridor_floor: 25000,
      corridor_likely: 45000,
      corridor_stretch: 65000,
      contributing_factors: ["Surgery documented", "Strong objective findings"],
    },
    settlement_corridor: {
      range_floor: 25000,
      range_likely: 45000,
      range_stretch: 65000,
      confidence: 78,
      confidence_level: "high",
      selected_floor: 30000,
      selected_likely: 48000,
      selected_stretch: 62000,
      authority_recommendation: 50000,
      rationale_notes: "Range supported by reviewed specials and comparable outcomes.",
    },
    documentation_sufficiency: {
      score: 85,
      label: "sufficient",
      findings: ["All key medical records present"],
      incomplete_fields: [],
    },
    factor_summaries: [
      {
        factor_key: "surgery",
        label: "Surgical Intervention",
        family: "surgery",
        direction: "expander",
        score: 80,
        impact_description: "+$15,000",
        narrative: "ACL reconstruction surgery documented with post-surgical recovery.",
        evidence_ref_ids: ["doc-1:5"],
      },
    ],
    top_drivers: [{
      factor_key: "surgery",
      label: "Surgical Intervention",
      family: "surgery",
      direction: "expander",
      score: 80,
      impact_description: "+$15,000",
      narrative: "ACL reconstruction surgery documented.",
      evidence_ref_ids: ["doc-1:5"],
    }],
    top_suppressors: [{
      factor_key: "gap",
      label: "Treatment Gap",
      family: "credibility",
      direction: "reducer",
      score: 40,
      impact_description: "-$5,000",
      narrative: "45-day unexplained treatment gap.",
      evidence_ref_ids: [],
    }],
    top_uncertainty_drivers: [],
    benchmark_summary: {
      comparable_claim_count: 12,
      comparable_median: 42000,
      comparable_p25: 28000,
      comparable_p75: 58000,
      matching_criteria: ["jurisdiction", "injury_type", "surgery"],
      match_quality: "moderate",
      calibration_config_version: 1,
    },
    post_merit_adjustments: [],
    driver_summaries: [],
    explanation_ledger: null,
    assumptions: [],
    overrides: [],
    total_billed: 32000,
    total_reviewed: 28000,
    completeness_score: 85,
    negotiation_handoff: {
      adjusted_corridor: { floor: 30000, likely: 48000, stretch: 65000, is_overridden: false },
      confidence_level: "moderate",
      confidence_score: 0.65,
      recommended_opening_zone: { anchor: 65000, ceiling: 69250, rationale: "Opening at stretch" },
      target_settlement_zone: { floor: 30000, target: 48000, rationale: "Target at likely" },
      walk_away_floor: 25500,
      escalation_threshold: { amount: 78000, rationale: "120% of stretch", review_required: true },
      key_strengths: [{ label: "Surgery", description: "Documented ACL reconstruction", impact: "high", evidence_ref_ids: ["doc-1:5"] }],
      key_weaknesses: [{ label: "Gap", description: "45-day treatment gap", impact: "medium", evidence_ref_ids: [] }],
      key_uncertainties: [],
      documentation_gaps: [],
      unresolved_issues: [],
      total_reviewed_specials: 28000,
      total_billed_specials: 32000,
      policy_limits: 100000,
    },
    audit: {
      accepted_by: null,
      accepted_at: null,
      overridden_by: null,
      overridden_at: null,
      published_by: null,
      published_at: null,
      override_reason: null,
    },
    generated_at: "2026-03-13T00:00:00Z",
    created_at: "2026-03-13T00:00:00Z",
    fact_based_value_range: { low: 25000, mid: 45000, high: 65000 },
    expected_resolution_range: { low: 25000, mid: 45000, high: 65000 },
    valuation_outputs: {
      fact_based_value_range: { low: 25000, mid: 45000, high: 65000 },
      expected_resolution_range: { low: 25000, mid: 45000, high: 65000 },
    },
    representation_context: {
      representation_status_current: 'unknown',
      representation_status_at_evaluation: 'unknown',
      representation_transition_flag: false,
      attorney_retained_during_claim_flag: false,
      attorney_retained_after_initial_offer_flag: false,
      representation_history_count: 0,
      attorney_retention_risk: 0,
      current_attorney_name: null,
      current_firm_name: null,
    },
    representation_scenarios: {
      direct_resolution_range_unrepresented: null,
      likely_range_if_counsel_retained: null,
      early_resolution_opportunity_range: null,
      current_represented_posture_range: null,
    },
    representation_notes: {
      value_rule_applied: 'Representation status did not directly reduce fact-based case value.',
      fact_value_independence_statement: 'Fact-based value determined by claim facts only.',
      resolution_context_explanation: 'No representation context available.',
      negotiation_context_summary: null,
      compliance_notes: [],
    },
    scenario_outputs: null,
    confidence_and_uncertainty: {
      confidence_score: 78,
      confidence_level: 'high',
      uncertainty_drivers: [],
      documentation_quality_impact: null,
      data_completeness_score: 85,
    },
    handoff_notes: {
      evaluation_summary: 'Evaluation produced a high-confidence corridor.',
      negotiation_considerations: [],
      representation_posture_note: null,
      constraint_notes: [],
    },
    ...overrides,
  };
}

// ─── Validation ─────────────────────────────────────────

describe("EvaluatePackage v1 Validator", () => {
  it("validates a complete draft package", () => {
    const pkg = makeMinimalPackage();
    const result = validateEvaluatePackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.error_count).toBe(0);
  });

  it("detects contract version mismatch", () => {
    const pkg = makeMinimalPackage({ contract_version: "2.0.0" });
    const result = validateEvaluatePackage(pkg);
    expect(result.valid).toBe(false);
    expect(result.findings.some(f => f.code === "CONTRACT_VERSION_MISMATCH")).toBe(true);
  });

  it("detects missing required identity fields", () => {
    const pkg = makeMinimalPackage({ case_id: "", claim_id: "" });
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.filter(f => f.code === "MISSING_FIELD").length).toBeGreaterThanOrEqual(2);
  });

  it("detects inverted corridor", () => {
    const pkg = makeMinimalPackage();
    pkg.settlement_corridor.range_floor = 80000;
    pkg.settlement_corridor.range_likely = 50000;
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "CORRIDOR_INVERTED")).toBe(true);
  });

  it("detects empty corridor", () => {
    const pkg = makeMinimalPackage();
    pkg.settlement_corridor.range_floor = null;
    pkg.settlement_corridor.range_likely = null;
    pkg.settlement_corridor.range_stretch = null;
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "EMPTY_CORRIDOR")).toBe(true);
  });

  it("requires published_by for published status", () => {
    const pkg = makeMinimalPackage({ evaluation_status: "published" });
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "MISSING_PUBLISHER")).toBe(true);
  });

  it("warns on overrides without actor", () => {
    const pkg = makeMinimalPackage({
      overrides: [{
        override_key: "floor",
        category: "damages",
        original_value: "25000",
        override_value: "30000",
        reason: "Manager override",
        overridden_by: "user-001",
        overridden_at: "2026-03-13T00:00:00Z",
      }],
    });
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "OVERRIDE_NO_ACTOR")).toBe(true);
  });

  it("detects invalid merits score", () => {
    const pkg = makeMinimalPackage();
    pkg.merits.merits_score = 150;
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "INVALID_RANGE")).toBe(true);
  });

  it("warns on empty handoff", () => {
    const pkg = makeMinimalPackage();
    pkg.negotiation_handoff.key_strengths = [];
    pkg.negotiation_handoff.key_weaknesses = [];
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "EMPTY_HANDOFF")).toBe(true);
  });

  it("warns on missing explanation ledger", () => {
    const pkg = makeMinimalPackage({ explanation_ledger: null });
    const result = validateEvaluatePackage(pkg);
    expect(result.findings.some(f => f.code === "NO_LEDGER")).toBe(true);
  });
});

// ─── State Transitions ─────────────────────────────────

describe("Publication State Transitions", () => {
  it("allows draft → accepted", () => {
    expect(validatePublicationTransition("draft", "accepted").valid).toBe(true);
  });

  it("allows draft → overridden", () => {
    expect(validatePublicationTransition("draft", "overridden").valid).toBe(true);
  });

  it("allows accepted → published", () => {
    expect(validatePublicationTransition("accepted", "published").valid).toBe(true);
  });

  it("allows overridden → published", () => {
    expect(validatePublicationTransition("overridden", "published").valid).toBe(true);
  });

  it("prevents draft → published directly", () => {
    expect(validatePublicationTransition("draft", "published").valid).toBe(false);
  });

  it("prevents published → any state", () => {
    expect(validatePublicationTransition("published", "draft").valid).toBe(false);
    expect(validatePublicationTransition("published", "accepted").valid).toBe(false);
  });

  it("prevents accepted → draft (no going back)", () => {
    expect(validatePublicationTransition("accepted", "draft").valid).toBe(false);
  });
});

// ─── Serialization ──────────────────────────────────────

describe("EvaluatePackage Serialization", () => {
  it("serializes all fields for registry including representation", () => {
    const pkg = makeMinimalPackage();
    const serialized = serializeForRegistry(pkg);
    expect(serialized.contract_version).toBe(EVALUATE_PACKAGE_CONTRACT_VERSION);
    expect(serialized.case_id).toBe("case-001");
    expect(serialized.claim_profile).toBeDefined();
    expect(serialized.negotiation_handoff).toBeDefined();
    expect(serialized.fact_based_value_range).toBeDefined();
    expect(serialized.expected_resolution_range).toBeDefined();
    expect(serialized.representation_context).toBeDefined();
    expect(serialized.representation_notes).toBeDefined();
    expect(serialized.valuation_outputs).toBeDefined();
    expect(serialized.confidence_and_uncertainty).toBeDefined();
    expect(serialized.handoff_notes).toBeDefined();
    expect(serialized.scenario_outputs).toBeDefined();
  });

  it("preserves all top-level keys including v1.1 fields", () => {
    const pkg = makeMinimalPackage();
    const serialized = serializeForRegistry(pkg);
    const expectedKeys = [
      "contract_version", "case_id", "claim_id", "evaluation_id", "tenant_id",
      "package_version", "evaluation_status", "scoring_logic_version",
      "benchmark_logic_version", "engine_version", "source_module",
      "source_package_version", "snapshot_id", "valuation_run_id",
      "selection_id", "claim_profile", "merits", "settlement_corridor",
      "documentation_sufficiency", "factor_summaries", "top_drivers",
      "top_suppressors", "top_uncertainty_drivers", "benchmark_summary",
      "post_merit_adjustments", "driver_summaries", "explanation_ledger",
      "assumptions", "overrides", "total_billed", "total_reviewed",
      "completeness_score", "negotiation_handoff",
      // v1.1 fields
      "valuation_outputs", "fact_based_value_range", "expected_resolution_range",
      "representation_context", "representation_notes", "representation_scenarios",
      "scenario_outputs", "confidence_and_uncertainty", "handoff_notes",
      "audit", "generated_at", "created_at",
    ];
    for (const key of expectedKeys) {
      expect(serialized).toHaveProperty(key);
    }
  });
});

// ─── Shape Detection ────────────────────────────────────

describe("Package Shape Detection", () => {
  it("detects v1 shape", () => {
    const pkg = makeMinimalPackage();
    expect(isEvaluatePackageV1Shape(pkg)).toBe(true);
  });

  it("rejects legacy payload shape", () => {
    const legacy = {
      package_version: 1,
      engine_version: "1.0.0",
      source_module: "revieweriq",
      source_package_version: 1,
      range_floor: 25000,
      range_likely: 45000,
      range_stretch: 65000,
      confidence: 78,
    };
    expect(isEvaluatePackageV1Shape(legacy)).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isEvaluatePackageV1Shape(null)).toBe(false);
    expect(isEvaluatePackageV1Shape(undefined)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isEvaluatePackageV1Shape("string")).toBe(false);
    expect(isEvaluatePackageV1Shape(42)).toBe(false);
  });
});
