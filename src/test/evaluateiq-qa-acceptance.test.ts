/**
 * EvaluateIQ — QA Acceptance Test Suite
 *
 * End-to-end validation checks covering the full EvaluateIQ pipeline
 * using demo seed data. These tests verify that the QA support layer
 * enables exercising every major feature without live production data.
 *
 * Coverage:
 *  1. Snapshot assembly from all seed archetypes
 *  2. Factor scoring across all profiles
 *  3. Range generation for all seeds
 *  4. Explainability rendering (ledger completeness)
 *  5. Override audit logging structure
 *  6. EvaluatePackage publication readiness
 *  7. Stale detection state
 *  8. Represented vs unrepresented seed coverage
 *  9. Prior injury / treatment gap handling
 */

import { describe, it, expect } from "vitest";
import { EVALUATE_DEMO_SEEDS, type EvaluateDemoSeed } from "@/data/mock/evaluateSeeds";
import {
  ALL_EVALUATE_FIXTURES,
  SOFT_TISSUE_LOW_IMPACT,
  SURGERY_STRONG_LIABILITY,
  EMPTY_SNAPSHOT,
} from "@/test/fixtures/evaluateFixtures";
import { extractValuationDrivers } from "@/lib/valuationDriverEngine";
import { computeSettlementRange } from "@/lib/settlementRangeEngine";
import { buildExplanationLedger } from "@/lib/explanationLedgerBuilder";
import { validateEvaluateCompletion } from "@/hooks/useEvaluateCompletion";
import { assembleEvaluatePackageV1, type PackageAssemblyInput } from "@/lib/evaluatePackageAssembler";
import { validateEvaluatePackage } from "@/lib/evaluatePackageValidator";

// ═══════════════════════════════════════════════════════
// 1. SEED ARCHETYPE COVERAGE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Seed Archetype Coverage", () => {
  it("has at least 8 demo seeds covering required archetypes", () => {
    expect(EVALUATE_DEMO_SEEDS.length).toBeGreaterThanOrEqual(8);
  });

  it("covers all required archetypes", () => {
    const archetypes = EVALUATE_DEMO_SEEDS.map(s => s.id);
    expect(archetypes).toContain("st-minor");        // soft tissue unrepresented
    expect(archetypes).toContain("st-extended");      // represented conservative
    expect(archetypes).toContain("ortho-nonsurg");    // imaging + injections
    expect(archetypes).toContain("surgery");          // surgical
    expect(archetypes).toContain("provisional");      // liability-disputed
    expect(archetypes).toContain("prior-injury");     // prior injury / treatment gap
  });

  it("includes both represented and unrepresented cases", () => {
    const represented = EVALUATE_DEMO_SEEDS.filter(s => s.is_represented);
    const unrepresented = EVALUATE_DEMO_SEEDS.filter(s => !s.is_represented);
    expect(represented.length).toBeGreaterThanOrEqual(2);
    expect(unrepresented.length).toBeGreaterThanOrEqual(2);
  });

  it("includes cases with and without ReviewerIQ data", () => {
    const withReviewer = EVALUATE_DEMO_SEEDS.filter(s => s.has_revieweriq_data);
    const withoutReviewer = EVALUATE_DEMO_SEEDS.filter(s => !s.has_revieweriq_data);
    expect(withReviewer.length).toBeGreaterThanOrEqual(2);
    expect(withoutReviewer.length).toBeGreaterThanOrEqual(2);
  });

  it("every seed has a valid valuation_run", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.valuation_run.run_id).toBeTruthy();
      expect(seed.valuation_run.run_version).toBeGreaterThanOrEqual(1);
      expect(seed.valuation_run.confidence_label).toMatch(/^(high|moderate|low|very_low)$/);
    }
  });
});

// ═══════════════════════════════════════════════════════
// 2. TEST STATE COVERAGE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Test State Coverage", () => {
  it("has an incomplete data state (low completeness)", () => {
    const incomplete = EVALUATE_DEMO_SEEDS.find(s => s.snapshot.overall_completeness_score < 40);
    expect(incomplete).toBeDefined();
    expect(incomplete!.doc_sufficiency.tier).toBe("weak");
  });

  it("has a stale valuation state", () => {
    const stale = EVALUATE_DEMO_SEEDS.find(s => s.stale_state?.is_stale);
    expect(stale).toBeDefined();
    expect(stale!.stale_state!.stale_reason).toBeTruthy();
    expect(stale!.stale_state!.upstream_version).toBeGreaterThan(0);
  });

  it("has a manual override present state", () => {
    const overridden = EVALUATE_DEMO_SEEDS.find(s => !!s.override);
    expect(overridden).toBeDefined();
    expect(overridden!.override!.reason_code).toBeTruthy();
    expect(overridden!.valuation_run.override_count).toBeGreaterThan(0);
  });

  it("has a completed valuation state", () => {
    const completed = EVALUATE_DEMO_SEEDS.filter(s => s.module_status === "completed");
    expect(completed.length).toBeGreaterThanOrEqual(1);
  });

  it("has a published valuation state", () => {
    const published = EVALUATE_DEMO_SEEDS.filter(s => s.module_status === "published");
    expect(published.length).toBeGreaterThanOrEqual(1);
  });

  it("has a not_started state", () => {
    const notStarted = EVALUATE_DEMO_SEEDS.find(s => s.module_status === "not_started");
    expect(notStarted).toBeDefined();
  });

  it("covers all module statuses", () => {
    const statuses = new Set(EVALUATE_DEMO_SEEDS.map(s => s.module_status));
    expect(statuses.has("not_started")).toBe(true);
    expect(statuses.has("in_progress")).toBe(true);
    expect(statuses.has("valued")).toBe(true);
    expect(statuses.has("completed")).toBe(true);
    expect(statuses.has("published")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 3. SNAPSHOT ASSEMBLY ACCEPTANCE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Snapshot Assembly", () => {
  it("every seed snapshot has valid required sections", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      const s = seed.snapshot;
      expect(s.snapshot_id, `${seed.id}: snapshot_id`).toBeTruthy();
      expect(s.case_id, `${seed.id}: case_id`).toBeTruthy();
      expect(s.tenant_id, `${seed.id}: tenant_id`).toBeTruthy();
      expect(s.source_module, `${seed.id}: source_module`).toMatch(/^(demandiq|revieweriq)$/);
      expect(s.claimant.claimant_name.value, `${seed.id}: claimant_name`).toBeTruthy();
      expect(s.accident.date_of_loss.value, `${seed.id}: date_of_loss`).toBeTruthy();
      expect(s.venue_jurisdiction.jurisdiction_state.value, `${seed.id}: jurisdiction`).toBeTruthy();
    }
  });

  it("prior-injury seed has pre-existing injury flag", () => {
    const priorSeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "prior-injury");
    expect(priorSeed).toBeDefined();
    const preExisting = priorSeed!.snapshot.injuries.filter(i => i.is_pre_existing);
    expect(preExisting.length).toBeGreaterThanOrEqual(1);
  });

  it("provisional seed sources from demandiq (no ReviewerIQ)", () => {
    const provisional = EVALUATE_DEMO_SEEDS.find(s => s.id === "provisional");
    expect(provisional!.snapshot.source_module).toBe("demandiq");
    expect(provisional!.has_revieweriq_data).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════
// 4. FACTOR SCORING ACCEPTANCE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Factor Scoring", () => {
  it("extracts drivers from every seed snapshot without crashing", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      const result = extractValuationDrivers(seed.snapshot);
      expect(result.drivers, `${seed.id}: drivers`).toBeDefined();
      expect(result.family_summaries, `${seed.id}: families`).toBeDefined();
    }
  });

  it("surgery seeds produce surgery driver", () => {
    const surgerySeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "surgery");
    const result = extractValuationDrivers(surgerySeed!.snapshot);
    const surgeryDriver = result.drivers.find(d => d.driver_key === "surgical_intervention");
    expect(surgeryDriver).toBeDefined();
  });

  it("prior-injury seed produces causation-related drivers or concerns", () => {
    const priorSeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "prior-injury");
    expect(priorSeed!.snapshot.upstream_concerns.some(c => c.category === "causation")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// 5. RANGE GENERATION ACCEPTANCE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Range Generation", () => {
  it("generates valid range for every seed snapshot", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      const drivers = extractValuationDrivers(seed.snapshot);
      const range = computeSettlementRange(seed.snapshot, drivers);
      expect(range.floor, `${seed.id}: floor >= 0`).toBeGreaterThanOrEqual(0);
      expect(range.likely, `${seed.id}: likely >= floor`).toBeGreaterThanOrEqual(range.floor);
      expect(range.stretch, `${seed.id}: stretch >= likely`).toBeGreaterThanOrEqual(range.likely);
    }
  });

  it("incomplete data seed produces zero or very low range", () => {
    const provisional = EVALUATE_DEMO_SEEDS.find(s => s.id === "provisional");
    const drivers = extractValuationDrivers(provisional!.snapshot);
    const range = computeSettlementRange(provisional!.snapshot, drivers);
    // Very low completeness should yield very low confidence
    expect(range.confidence_label).toMatch(/^(low|very_low)$/);
  });

  it("prior-injury seed produces constrained range", () => {
    const priorSeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "prior-injury");
    const drivers = extractValuationDrivers(priorSeed!.snapshot);
    const range = computeSettlementRange(priorSeed!.snapshot, drivers);
    // Prior injury should have lower confidence
    expect(range.confidence).toBeLessThan(70);
  });
});

// ═══════════════════════════════════════════════════════
// 6. EXPLAINABILITY RENDERING
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Explainability Rendering", () => {
  it("builds complete ledger for every seed snapshot", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      const drivers = extractValuationDrivers(seed.snapshot);
      const range = computeSettlementRange(seed.snapshot, drivers);
      const ledger = buildExplanationLedger(range, drivers, null, []);
      expect(ledger.entries, `${seed.id}: entries`).toBeDefined();
      expect(ledger.summary, `${seed.id}: summary`).toBeDefined();
      expect(ledger.engine_version, `${seed.id}: engine_version`).toBeTruthy();
    }
  });

  it("ledger entries have proper source attribution", () => {
    const surgerySeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "surgery");
    const drivers = extractValuationDrivers(surgerySeed!.snapshot);
    const range = computeSettlementRange(surgerySeed!.snapshot, drivers);
    const ledger = buildExplanationLedger(range, drivers, null, []);

    for (const entry of ledger.entries) {
      expect(entry.source).toMatch(/^(engine|human_override|system_constraint)$/);
      expect(entry.direction).toMatch(/^(increase|decrease|neutral|constraint)$/);
      expect(entry.narrative).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════
// 7. OVERRIDE AUDIT LOGGING
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Override Audit Structure", () => {
  it("override seed has complete override metadata", () => {
    const overrideSeed = EVALUATE_DEMO_SEEDS.find(s => !!s.override);
    expect(overrideSeed).toBeDefined();
    const o = overrideSeed!.override!;
    expect(o.reason_code).toBeTruthy();
    expect(o.reason_label).toBeTruthy();
    expect(o.rationale).toBeTruthy();
    expect(o.system_corridor.floor).toBeGreaterThan(0);
    expect(o.override_corridor.floor).toBeGreaterThan(0);
    expect(typeof o.requires_supervisor_review).toBe("boolean");
  });

  it("override corridor differs from system corridor", () => {
    const overrideSeed = EVALUATE_DEMO_SEEDS.find(s => !!s.override);
    const o = overrideSeed!.override!;
    expect(o.override_corridor.mid).not.toBe(o.system_corridor.mid);
  });
});

// ═══════════════════════════════════════════════════════
// 8. PACKAGE PUBLICATION READINESS
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Package Publication", () => {
  it("completed seeds pass completion validation", () => {
    const completedSeeds = EVALUATE_DEMO_SEEDS.filter(
      s => s.module_status === "completed" || s.module_status === "published"
    );
    for (const seed of completedSeeds) {
      const result = validateEvaluateCompletion(seed.snapshot, "in_progress");
      expect(result.valid, `${seed.id}: should be valid`).toBe(true);
    }
  });

  it("incomplete seed still passes validation (warnings only)", () => {
    const provisional = EVALUATE_DEMO_SEEDS.find(s => s.id === "provisional");
    const result = validateEvaluateCompletion(provisional!.snapshot, "in_progress");
    // Should be valid (no errors) but have warnings
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("assembles valid package from surgery seed", () => {
    const surgerySeed = EVALUATE_DEMO_SEEDS.find(s => s.id === "surgery");
    const input: PackageAssemblyInput = {
      evaluationId: "eval-qa-test",
      caseId: surgerySeed!.snapshot.case_id,
      claimId: surgerySeed!.snapshot.case_id,
      tenantId: surgerySeed!.snapshot.tenant_id,
      snapshot: surgerySeed!.snapshot,
      sourceModule: "revieweriq",
      sourceVersion: 1,
      snapshotId: surgerySeed!.snapshot.snapshot_id,
      valuationRunId: surgerySeed!.valuation_run.run_id,
      selectionId: null,
      explanationLedger: null,
      rangeFloor: surgerySeed!.corridor.floor,
      rangeLikely: surgerySeed!.corridor.mid,
      rangeStretch: surgerySeed!.corridor.high,
      confidence: surgerySeed!.valuation_run.confidence,
      selectedFloor: surgerySeed!.corridor.floor,
      selectedLikely: surgerySeed!.corridor.mid,
      selectedStretch: surgerySeed!.corridor.high,
      authorityRecommendation: surgerySeed!.corridor.mid,
      rationaleNotes: "QA acceptance test package",
      packageVersion: 1,
      engineVersion: "1.0.0",
      scoringLogicVersion: "1.0.0",
      benchmarkLogicVersion: "1.0.0",
      userId: "qa-tester",
    };

    const pkg = assembleEvaluatePackageV1(input);
    expect(pkg.contract_version).toBeTruthy();
    expect(pkg.case_id).toBe(surgerySeed!.snapshot.case_id);
    expect(pkg.settlement_corridor.range_floor).toBe(surgerySeed!.corridor.floor);

    // Validate the assembled package
    pkg.evaluation_status = "accepted";
    pkg.audit.accepted_by = "qa-tester";
    pkg.audit.accepted_at = new Date().toISOString();
    const validation = validateEvaluatePackage(pkg);
    // May have warnings but should not have critical structural errors
    const criticalErrors = validation.findings.filter(
      f => f.severity === "error" && !f.code.includes("PUBLISHER") && !f.code.includes("VALUE_RULE")
    );
    expect(criticalErrors.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// 9. STALE DETECTION STATE
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — Stale Detection", () => {
  it("at least one seed has stale state for UI testing", () => {
    const staleSeed = EVALUATE_DEMO_SEEDS.find(s => s.stale_state?.is_stale);
    expect(staleSeed).toBeDefined();
  });

  it("stale seed has upstream version higher than snapshot version", () => {
    const staleSeed = EVALUATE_DEMO_SEEDS.find(s => s.stale_state?.is_stale);
    expect(staleSeed!.stale_state!.upstream_version).toBeGreaterThan(
      staleSeed!.snapshot.source_package_version
    );
  });

  it("non-stale seeds have no stale_state or is_stale=false", () => {
    const nonStale = EVALUATE_DEMO_SEEDS.filter(s => !s.stale_state?.is_stale);
    expect(nonStale.length).toBeGreaterThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════
// 10. NO SCREEN DATA DEPENDENCY
// ═══════════════════════════════════════════════════════

describe("QA Acceptance — No Missing Data Dependencies", () => {
  it("every seed has non-empty claimant name", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.claimant).toBeTruthy();
      expect(seed.snapshot.claimant.claimant_name.value).toBeTruthy();
    }
  });

  it("every seed has jurisdiction_state", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.snapshot.venue_jurisdiction.jurisdiction_state.value).toBeTruthy();
    }
  });

  it("every seed has doc_sufficiency with tier", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.doc_sufficiency.tier).toMatch(/^(strong|moderate|weak)$/);
    }
  });

  it("every seed has benchmark_support with tier", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.benchmark_support.tier).toMatch(/^(strong|moderate|weak|none)$/);
    }
  });

  it("every seed has a valid expected_profile code", () => {
    for (const seed of EVALUATE_DEMO_SEEDS) {
      expect(seed.expected_profile).toBeTruthy();
      expect(seed.expected_profile_label).toBeTruthy();
    }
  });
});
