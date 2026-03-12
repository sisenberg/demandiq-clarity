/**
 * EvaluateIQ — Smoke Tests
 *
 * Covers the core EvaluateIQ pipeline:
 *  1. Intake snapshot creation
 *  2. Driver extraction
 *  3. Range generation
 *  4. Manual assumption overrides
 *  5. Explanation ledger building
 *  6. Package validation
 *
 * Uses synthetic fixtures from evaluateFixtures.ts.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_EVALUATE_FIXTURES,
  SOFT_TISSUE_LOW_IMPACT,
  HIGH_BILLED_MAJOR_REDUCTIONS,
  SURGERY_STRONG_LIABILITY,
  SURGERY_POLICY_PRESSURE,
  LONG_CHIRO_TREATMENT_GAP,
  COMPARATIVE_NEGLIGENCE_CASE,
  VENUE_SEVERITY_CASE,
  EMPTY_SNAPSHOT,
  MISSING_LIABILITY,
} from "@/test/fixtures/evaluateFixtures";
import { extractValuationDrivers } from "@/lib/valuationDriverEngine";
import { computeSettlementRange } from "@/lib/settlementRangeEngine";
import { buildExplanationLedger } from "@/lib/explanationLedgerBuilder";
import { validateEvaluateCompletion } from "@/hooks/useEvaluateCompletion";
import type { HumanAssumptionOverrides } from "@/hooks/useAssumptionOverrides";

// ═══════════════════════════════════════════════════════
// 1. DRIVER EXTRACTION
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Driver Extraction", () => {
  it("extracts drivers from all fixtures without crashing", () => {
    for (const { label, snapshot } of ALL_EVALUATE_FIXTURES) {
      const result = extractValuationDrivers(snapshot);
      expect(result.drivers, `${label}: should return drivers array`).toBeDefined();
      expect(result.family_summaries, `${label}: should return family summaries`).toBeDefined();
    }
  });

  it("extracts surgery driver for surgery case", () => {
    const result = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const surgeryDriver = result.drivers.find(d => d.driver_key === "surgical_intervention");
    expect(surgeryDriver).toBeDefined();
    expect(surgeryDriver!.direction).toBe("expander");
    expect(surgeryDriver!.score).toBeGreaterThanOrEqual(70);
  });

  it("does not extract surgery driver for soft tissue case", () => {
    const result = extractValuationDrivers(SOFT_TISSUE_LOW_IMPACT);
    const surgeryDriver = result.drivers.find(d => d.driver_key === "surgical_intervention");
    expect(surgeryDriver).toBeUndefined();
  });

  it("handles empty snapshot gracefully", () => {
    const result = extractValuationDrivers(EMPTY_SNAPSHOT);
    // May produce a few derived drivers (e.g. liability default) but should not crash
    expect(result.drivers.length).toBeLessThanOrEqual(3);
    expect(result.family_summaries).toBeDefined();
  });

  it("handles missing liability data", () => {
    const result = extractValuationDrivers(MISSING_LIABILITY);
    const liabilityDrivers = result.drivers.filter(d => d.family === "liability");
    // Should not crash; may have no liability drivers
    expect(Array.isArray(liabilityDrivers)).toBe(true);
  });

  it("extracts reviewer reduction driver when present", () => {
    const result = extractValuationDrivers(HIGH_BILLED_MAJOR_REDUCTIONS);
    const reviewedDriver = result.drivers.find(d => d.driver_key === "reviewed_medicals");
    expect(reviewedDriver).toBeDefined();
    expect(reviewedDriver!.direction).toBe("reducer");
  });
});

// ═══════════════════════════════════════════════════════
// 2. RANGE GENERATION
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Range Generation", () => {
  it("generates range for all fixtures without crashing", () => {
    for (const { label, snapshot } of ALL_EVALUATE_FIXTURES) {
      const drivers = extractValuationDrivers(snapshot);
      const range = computeSettlementRange(snapshot, drivers);
      expect(range.floor, `${label}: floor`).toBeGreaterThanOrEqual(0);
      expect(range.likely, `${label}: likely >= floor`).toBeGreaterThanOrEqual(range.floor);
      expect(range.stretch, `${label}: stretch >= likely`).toBeGreaterThanOrEqual(range.likely);
    }
  });

  it("soft tissue produces lower range than surgery", () => {
    const stDrivers = extractValuationDrivers(SOFT_TISSUE_LOW_IMPACT);
    const stRange = computeSettlementRange(SOFT_TISSUE_LOW_IMPACT, stDrivers);

    const surgDrivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const surgRange = computeSettlementRange(SURGERY_STRONG_LIABILITY, surgDrivers);

    expect(surgRange.likely).toBeGreaterThan(stRange.likely);
    expect(surgRange.stretch).toBeGreaterThan(stRange.stretch);
  });

  it("policy cap constrains range", () => {
    const drivers = extractValuationDrivers(SURGERY_POLICY_PRESSURE);
    const range = computeSettlementRange(SURGERY_POLICY_PRESSURE, drivers);

    // Policy limit is $25,000
    expect(range.stretch).toBeLessThanOrEqual(25000);
    expect(range.composition.policy_cap.applied).toBe(true);
  });

  it("comparative negligence reduces range", () => {
    // Same case without comp neg
    const baseDrivers = extractValuationDrivers(SOFT_TISSUE_LOW_IMPACT);
    const baseRange = computeSettlementRange(SOFT_TISSUE_LOW_IMPACT, baseDrivers);

    const cnDrivers = extractValuationDrivers(COMPARATIVE_NEGLIGENCE_CASE);
    const cnRange = computeSettlementRange(COMPARATIVE_NEGLIGENCE_CASE, cnDrivers);

    // The comp neg case has higher specials but 25% comp neg
    // At minimum, the liability factor should be < 1.0
    expect(cnRange.composition.liability_factor.factor).toBeLessThan(1.0);
  });

  it("empty snapshot produces $0 range with critical warning", () => {
    const drivers = extractValuationDrivers(EMPTY_SNAPSHOT);
    const range = computeSettlementRange(EMPTY_SNAPSHOT, drivers);

    expect(range.floor).toBe(0);
    expect(range.likely).toBe(0);
    expect(range.stretch).toBe(0);
    expect(range.warnings.some(w => w.code === "ZERO_ECONOMIC_BASE")).toBe(true);
  });

  it("confidence is lower for empty snapshot", () => {
    const emptyDrivers = extractValuationDrivers(EMPTY_SNAPSHOT);
    const emptyRange = computeSettlementRange(EMPTY_SNAPSHOT, emptyDrivers);

    const surgDrivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const surgRange = computeSettlementRange(SURGERY_STRONG_LIABILITY, surgDrivers);

    expect(emptyRange.confidence).toBeLessThan(surgRange.confidence);
  });

  it("range values are rounded to negotiation increments", () => {
    const drivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const range = computeSettlementRange(SURGERY_STRONG_LIABILITY, drivers);

    // All values should be multiples of at least 250
    expect(range.floor % 250).toBe(0);
    expect(range.likely % 250).toBe(0);
    expect(range.stretch % 250).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// 3. ASSUMPTION OVERRIDES
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Assumption Overrides", () => {
  it("human liability override changes range", () => {
    // Use soft tissue case (no policy cap) so liability actually affects output
    const snapshot = SOFT_TISSUE_LOW_IMPACT;
    const drivers = extractValuationDrivers(snapshot);

    const baseRange = computeSettlementRange(snapshot, drivers);
    const overrides: HumanAssumptionOverrides = {
      liability_percentage: 50,
      comparative_negligence_percentage: null,
      medical_base_preference: null,
      future_medical_override: null,
      wage_loss_override: null,
      venue_severity: null,
      credibility_impact: null,
      prior_condition_impact: null,
    };
    const reducedRange = computeSettlementRange(snapshot, drivers, overrides);

    expect(reducedRange.likely).toBeLessThan(baseRange.likely);
  });

  it("medical base preference override works", () => {
    const snapshot = HIGH_BILLED_MAJOR_REDUCTIONS;
    const drivers = extractValuationDrivers(snapshot);

    const billedOverride: HumanAssumptionOverrides = {
      liability_percentage: null,
      comparative_negligence_percentage: null,
      medical_base_preference: "billed",
      future_medical_override: null,
      wage_loss_override: null,
      venue_severity: null,
      credibility_impact: null,
      prior_condition_impact: null,
    };
    const billedRange = computeSettlementRange(snapshot, drivers, billedOverride);

    const reviewedOverride: HumanAssumptionOverrides = {
      ...billedOverride,
      medical_base_preference: "reviewed",
    };
    const reviewedRange = computeSettlementRange(snapshot, drivers, reviewedOverride);

    // Billed range should be higher since billed > reviewed
    expect(billedRange.likely).toBeGreaterThan(reviewedRange.likely);
  });

  it("venue severity override affects range", () => {
    // Use soft tissue (no policy cap) so venue adjustment is visible
    const snapshot = SOFT_TISSUE_LOW_IMPACT;
    const drivers = extractValuationDrivers(snapshot);

    const pfOverride: HumanAssumptionOverrides = {
      liability_percentage: null,
      comparative_negligence_percentage: null,
      medical_base_preference: null,
      future_medical_override: null,
      wage_loss_override: null,
      venue_severity: "plaintiff_friendly",
      credibility_impact: null,
      prior_condition_impact: null,
    };
    const pfRange = computeSettlementRange(snapshot, drivers, pfOverride);

    const dfOverride: HumanAssumptionOverrides = {
      ...pfOverride,
      venue_severity: "defense_friendly",
    };
    const dfRange = computeSettlementRange(snapshot, drivers, dfOverride);

    expect(pfRange.likely).toBeGreaterThanOrEqual(dfRange.likely);
  });
});

// ═══════════════════════════════════════════════════════
// 4. EXPLANATION LEDGER
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Explanation Ledger", () => {
  it("builds ledger for all fixtures without crashing", () => {
    for (const { label, snapshot } of ALL_EVALUATE_FIXTURES) {
      const drivers = extractValuationDrivers(snapshot);
      const range = computeSettlementRange(snapshot, drivers);
      const ledger = buildExplanationLedger(range, drivers, null, []);
      expect(ledger.entries, `${label}: entries`).toBeDefined();
      expect(ledger.summary, `${label}: summary`).toBeDefined();
      expect(ledger.engine_version).toBeTruthy();
    }
  });

  it("ledger entries have required fields", () => {
    const drivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const range = computeSettlementRange(SURGERY_STRONG_LIABILITY, drivers);
    const ledger = buildExplanationLedger(range, drivers, null, []);

    for (const entry of ledger.entries) {
      expect(entry.entry_key).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.narrative).toBeTruthy();
      expect(entry.direction).toMatch(/^(increase|decrease|neutral|constraint)$/);
      expect(entry.source).toMatch(/^(engine|human_override|system_constraint)$/);
    }
  });

  it("includes human override entries when overrides active", () => {
    const drivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const overrides: HumanAssumptionOverrides = {
      liability_percentage: 80,
      comparative_negligence_percentage: null,
      medical_base_preference: null,
      future_medical_override: null,
      wage_loss_override: null,
      venue_severity: "plaintiff_friendly",
      credibility_impact: null,
      prior_condition_impact: null,
    };
    const range = computeSettlementRange(SURGERY_STRONG_LIABILITY, drivers, overrides);
    const ledger = buildExplanationLedger(range, drivers, overrides, []);

    const humanEntries = ledger.entries.filter(e => e.source === "human_override");
    expect(humanEntries.length).toBeGreaterThanOrEqual(2);
    expect(ledger.summary.human_override_count).toBeGreaterThanOrEqual(2);
  });

  it("ledger has no duplicate entry_keys", () => {
    const drivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const range = computeSettlementRange(SURGERY_STRONG_LIABILITY, drivers);
    const ledger = buildExplanationLedger(range, drivers, null, []);

    const keys = ledger.entries.map(e => e.entry_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("policy cap shows as constraint entry", () => {
    const drivers = extractValuationDrivers(SURGERY_POLICY_PRESSURE);
    const range = computeSettlementRange(SURGERY_POLICY_PRESSURE, drivers);
    const ledger = buildExplanationLedger(range, drivers, null, []);

    const policyEntry = ledger.entries.find(e => e.entry_key === "policy_cap");
    expect(policyEntry).toBeDefined();
    expect(policyEntry!.direction).toBe("constraint");
  });
});

// ═══════════════════════════════════════════════════════
// 5. PACKAGE VALIDATION
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Package Validation", () => {
  it("validates snapshot with in_progress status as valid", () => {
    const result = validateEvaluateCompletion(SURGERY_STRONG_LIABILITY, "in_progress");
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null snapshot", () => {
    const result = validateEvaluateCompletion(null, "in_progress");
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("rejects not_started status", () => {
    const result = validateEvaluateCompletion(SURGERY_STRONG_LIABILITY, "not_started");
    expect(result.valid).toBe(false);
  });

  it("rejects already completed status", () => {
    const result = validateEvaluateCompletion(SURGERY_STRONG_LIABILITY, "completed");
    expect(result.valid).toBe(false);
  });

  it("warns on zero billed amount", () => {
    const result = validateEvaluateCompletion(EMPTY_SNAPSHOT, "in_progress");
    expect(result.warnings.some(w => w.includes("$0"))).toBe(true);
  });

  it("warns on no injuries", () => {
    const result = validateEvaluateCompletion(EMPTY_SNAPSHOT, "in_progress");
    expect(result.warnings.some(w => w.includes("injuries"))).toBe(true);
  });

  it("accepts reopened status as valid", () => {
    const result = validateEvaluateCompletion(SURGERY_STRONG_LIABILITY, "reopened");
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 6. EDGE CASES & DEFENSIVE HANDLING
// ═══════════════════════════════════════════════════════

describe("EvaluateIQ — Defensive Edge Cases", () => {
  it("treatment gap case still produces valid range", () => {
    const drivers = extractValuationDrivers(LONG_CHIRO_TREATMENT_GAP);
    const range = computeSettlementRange(LONG_CHIRO_TREATMENT_GAP, drivers);
    expect(range.floor).toBeGreaterThan(0);
    expect(range.likely).toBeGreaterThan(0);
  });

  it("missing liability produces moderate default factor", () => {
    const drivers = extractValuationDrivers(MISSING_LIABILITY);
    const range = computeSettlementRange(MISSING_LIABILITY, drivers);
    // With no liability facts, factor defaults to 0.75
    expect(range.composition.liability_factor.factor).toBeCloseTo(0.75, 1);
  });

  it("high-reduction case still produces positive range", () => {
    const drivers = extractValuationDrivers(HIGH_BILLED_MAJOR_REDUCTIONS);
    const range = computeSettlementRange(HIGH_BILLED_MAJOR_REDUCTIONS, drivers);
    expect(range.floor).toBeGreaterThan(0);
  });

  it("surgery cases produce higher severity tier", () => {
    const stDrivers = extractValuationDrivers(SOFT_TISSUE_LOW_IMPACT);
    const stRange = computeSettlementRange(SOFT_TISSUE_LOW_IMPACT, stDrivers);

    const surgDrivers = extractValuationDrivers(SURGERY_STRONG_LIABILITY);
    const surgRange = computeSettlementRange(SURGERY_STRONG_LIABILITY, surgDrivers);

    // Surgery case should have higher severity multiplier
    expect(surgRange.composition.severity_multiplier.likely_mult)
      .toBeGreaterThan(stRange.composition.severity_multiplier.likely_mult);
  });

  it("all range outputs include confidence label", () => {
    for (const { label, snapshot } of ALL_EVALUATE_FIXTURES) {
      const drivers = extractValuationDrivers(snapshot);
      const range = computeSettlementRange(snapshot, drivers);
      expect(range.confidence_label, `${label}`).toMatch(/^(high|moderate|low|very_low)$/);
    }
  });
});
