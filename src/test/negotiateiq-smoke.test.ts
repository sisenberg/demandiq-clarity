/**
 * NegotiateIQ — Test Suite
 *
 * Covers: strategy generation, response recommendations,
 * authority checks, draft generation, package validation & building,
 * numeric validation, and edge cases.
 */

import { describe, it, expect } from "vitest";

import { generateStrategy } from "@/lib/negotiateStrategyEngine";
import { generateResponseRecommendations } from "@/lib/negotiateResponseEngine";
import { generateDraft, DRAFT_TYPE_META, type DraftType } from "@/lib/negotiateDraftEngine";
import { checkAuthority, buildEscalationSummary, formatEscalationSummaryText } from "@/lib/negotiateAuthorityEngine";
import { validateNegotiateCompletion, buildNegotiatePackage, type NegotiateOutcomeType } from "@/lib/negotiatePackageBuilder";

import {
  SCENARIO_REASONABLE,
  SCENARIO_EXCESSIVE_DEMAND,
  SCENARIO_WEAK_LIABILITY,
  SCENARIO_KNOWN_ATTORNEY,
  SCENARIO_NEAR_CEILING,
  ALL_NEGOTIATE_FIXTURES,
} from "@/test/fixtures/negotiateFixtures";

// ════════════════════════════════════════════════════════
// STRATEGY GENERATION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Strategy Generation", () => {
  it("generates strategy from any valid VM", () => {
    for (const f of ALL_NEGOTIATE_FIXTURES) {
      const s = generateStrategy(f.vm);
      expect(s).toBeDefined();
      expect(s.engineVersion).toBe("1.0.0");
      expect(s.openingOffer.generated).toBeGreaterThan(0);
      expect(s.authorityCeiling.generated).toBeGreaterThan(0);
      expect(s.targetSettlementZone.generated.low).toBeLessThanOrEqual(s.targetSettlementZone.generated.high);
      expect(s.walkAwayThreshold.generated).toBeGreaterThanOrEqual(0);
      expect(s.movementPlan.firstMove.generated).toBeGreaterThan(0);
      expect(s.concessionPosture.generated).toMatch(/^(conservative|standard|flexible)$/);
      expect(s.rationaleSummary.length).toBeGreaterThan(20);
    }
  });

  it("generates conservative posture for strong liability with expanders", () => {
    const s = generateStrategy(SCENARIO_NEAR_CEILING.vm);
    // Has 3 expanders, no reducers, high confidence
    expect(s.concessionPosture.generated).toBe("conservative");
  });

  it("generates flexible posture for weak liability", () => {
    const s = generateStrategy(SCENARIO_WEAK_LIABILITY.vm);
    // Has 3 reducers, no expanders, low confidence (0.45)
    expect(s.concessionPosture.generated).toBe("flexible");
  });

  it("opening offer is below floor", () => {
    for (const f of ALL_NEGOTIATE_FIXTURES) {
      const s = generateStrategy(f.vm);
      const floor = f.vm.valuationRange.selectedFloor ?? f.vm.valuationRange.floor ?? 0;
      expect(s.openingOffer.generated).toBeLessThanOrEqual(floor);
    }
  });

  it("walk-away is at or below floor", () => {
    for (const f of ALL_NEGOTIATE_FIXTURES) {
      const s = generateStrategy(f.vm);
      const floor = f.vm.valuationRange.selectedFloor ?? f.vm.valuationRange.floor ?? 0;
      expect(s.walkAwayThreshold.generated).toBeLessThanOrEqual(floor);
    }
  });

  it("includes tactical recommendations", () => {
    const s = generateStrategy(SCENARIO_REASONABLE.vm);
    expect(s.tacticalRecommendations.length).toBeGreaterThanOrEqual(3);
    expect(s.tacticalRecommendations.every(t => typeof t.recommended === "boolean")).toBe(true);
  });

  it("respects authority recommendation when set", () => {
    const s = generateStrategy(SCENARIO_KNOWN_ATTORNEY.vm);
    expect(s.authorityCeiling.generated).toBe(42000);
  });
});

// ════════════════════════════════════════════════════════
// RESPONSE RECOMMENDATIONS
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Response Recommendations", () => {
  it("recommends settlement when counter is in target zone", () => {
    const strategy = generateStrategy(SCENARIO_REASONABLE.vm);
    const output = generateResponseRecommendations({
      strategy,
      vm: SCENARIO_REASONABLE.vm,
      rounds: SCENARIO_REASONABLE.rounds,
      currentCeiling: 25000,
      openingDemand: 35000,
      latestCounteroffer: 21000,
      lastDefenseOffer: 16000,
    });
    expect(output.postureZone).toBe("within_target");
    const settleRec = output.recommendations.find(r => r.action === "recommend_settlement");
    expect(settleRec).toBeDefined();
    expect(settleRec!.rank).toBe(1);
  });

  it("recommends hold for slow-moving excessive demand", () => {
    const strategy = generateStrategy(SCENARIO_EXCESSIVE_DEMAND.vm);
    const output = generateResponseRecommendations({
      strategy,
      vm: SCENARIO_EXCESSIVE_DEMAND.vm,
      rounds: SCENARIO_EXCESSIVE_DEMAND.rounds,
      currentCeiling: 30000,
      openingDemand: 120000,
      latestCounteroffer: 85000,
      lastDefenseOffer: 16000,
    });
    expect(output.postureZone).toBe("outside_not_moving");
    const holdRec = output.recommendations.find(r => r.action === "hold");
    expect(holdRec).toBeDefined();
    expect(holdRec!.confidence).toBe("high");
  });

  it("flags authority review when counter exceeds ceiling", () => {
    const strategy = generateStrategy(SCENARIO_NEAR_CEILING.vm);
    const output = generateResponseRecommendations({
      strategy,
      vm: SCENARIO_NEAR_CEILING.vm,
      rounds: SCENARIO_NEAR_CEILING.rounds,
      currentCeiling: 55000,
      openingDemand: 110000,
      latestCounteroffer: 58000,
      lastDefenseOffer: 52000,
    });
    expect(["beyond_ceiling", "near_ceiling"]).toContain(output.postureZone);
    const authRec = output.recommendations.find(r => r.action === "request_authority_review");
    expect(authRec).toBeDefined();
  });

  it("returns warnings for weak liability + credibility issues", () => {
    const strategy = generateStrategy(SCENARIO_WEAK_LIABILITY.vm);
    const output = generateResponseRecommendations({
      strategy,
      vm: SCENARIO_WEAK_LIABILITY.vm,
      rounds: SCENARIO_WEAK_LIABILITY.rounds,
      currentCeiling: 15000,
      openingDemand: 55000,
      latestCounteroffer: 45000,
      lastDefenseOffer: 7000,
    });
    const supportRec = output.recommendations.find(r => r.action === "request_support");
    expect(supportRec).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════
// AUTHORITY CHECKS
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Authority Checks", () => {
  it("detects when offer exceeds authority", () => {
    const check = checkAuthority(55000, 70000, 58000);
    expect(check.exceedsAuthority).toBe(true);
    expect(check.exceedsBy).toBe(3000);
    expect(check.exceedsPct).toBe(5);
    expect(check.escalationStatus).toBe("escalation_recommended");
  });

  it("no escalation when offer is under authority", () => {
    const check = checkAuthority(25000, null, 16000);
    expect(check.exceedsAuthority).toBe(false);
    expect(check.escalationStatus).toBe("no_escalation_needed");
  });

  it("recommends escalation when recommended > current", () => {
    const check = checkAuthority(25000, 42000, 16000);
    expect(check.exceedsAuthority).toBe(false);
    expect(check.escalationStatus).toBe("escalation_recommended");
  });

  it("handles null authority gracefully", () => {
    const check = checkAuthority(null, null, 16000);
    expect(check.exceedsAuthority).toBe(false);
    expect(check.escalationStatus).toBe("no_escalation_needed");
  });

  it("builds escalation summary with all sections", () => {
    const strategy = generateStrategy(SCENARIO_NEAR_CEILING.vm);
    const summary = buildEscalationSummary({
      caseId: "case-ceiling",
      vm: SCENARIO_NEAR_CEILING.vm,
      strategy,
      rounds: SCENARIO_NEAR_CEILING.rounds,
      currentAuthority: 55000,
      requestedAmount: 70000,
      reason: "Strategy recommends higher authority based on surgery case valuation.",
      currentDemand: 58000,
      currentCounter: 52000,
    });
    expect(summary.sections.length).toBeGreaterThanOrEqual(5);
    expect(summary.requestedAmount).toBe(70000);
    expect(summary.sections.some(s => s.heading.includes("Authority"))).toBe(true);

    const text = formatEscalationSummaryText(summary);
    expect(text).toContain("SUPERVISOR AUTHORITY REVIEW");
    expect(text).toContain("$70,000");
  });
});

// ════════════════════════════════════════════════════════
// DRAFT GENERATION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Draft Generation", () => {
  const strategy = generateStrategy(SCENARIO_REASONABLE.vm);

  it("generates all draft types without errors", () => {
    const draftTypes = Object.keys(DRAFT_TYPE_META) as DraftType[];
    for (const draftType of draftTypes) {
      const draft = generateDraft({
        draftType,
        tone: "neutral",
        vm: SCENARIO_REASONABLE.vm,
        strategy,
        rounds: SCENARIO_REASONABLE.rounds,
      });
      expect(draft.draftType).toBe(draftType);
      expect(draft.engineVersion).toBe("1.0.0");
      expect(draft.title.length).toBeGreaterThan(0);
      // Either externalContent or internalNotes should be non-empty
      expect(draft.externalContent.length + draft.internalNotes.length).toBeGreaterThan(0);
    }
  });

  it("offer letter includes amount and drivers", () => {
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "firm",
      vm: SCENARIO_REASONABLE.vm,
      strategy,
      rounds: [],
      proposedOffer: 12000,
      recipientName: "J. Smith",
      recipientFirm: "Smith Law",
    });
    expect(draft.externalContent).toContain("$12,000");
    expect(draft.externalContent).toContain("J. Smith");
    expect(draft.externalContent).toContain("direct and firm");
  });

  it("excessive demand response references reducers", () => {
    const excessiveStrategy = generateStrategy(SCENARIO_EXCESSIVE_DEMAND.vm);
    const draft = generateDraft({
      draftType: "excessive_demand_response",
      tone: "firm",
      vm: SCENARIO_EXCESSIVE_DEMAND.vm,
      strategy: excessiveStrategy,
      rounds: SCENARIO_EXCESSIVE_DEMAND.rounds,
    });
    expect(draft.externalContent).toContain("Excessive Chiropractic");
  });

  it("phone talking points include DO NOT EXCEED warning", () => {
    const draft = generateDraft({
      draftType: "phone_talking_points",
      tone: "collaborative",
      vm: SCENARIO_REASONABLE.vm,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
    });
    expect(draft.externalContent).toContain("DO NOT EXCEED");
  });

  it("claim file note is internal-only", () => {
    const draft = generateDraft({
      draftType: "claim_file_note",
      tone: "neutral",
      vm: SCENARIO_REASONABLE.vm,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
    });
    expect(draft.externalContent).toBe("");
    expect(draft.internalNotes.length).toBeGreaterThan(50);
  });
});

// ════════════════════════════════════════════════════════
// PACKAGE VALIDATION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Package Validation", () => {
  const strategy = { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) };

  it("validates complete settlement scenario", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled at $20,000 after 3 rounds.",
    });
    expect(v.valid).toBe(true);
    expect(v.errors).toHaveLength(0);
  });

  it("rejects settled outcome without amount", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: null,
      outcomeNotes: "Settled.",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("Settlement amount"))).toBe(true);
  });

  it("rejects non-settlement without outcome notes", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "impasse",
      finalSettlement: null,
      outcomeNotes: "",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("Outcome notes"))).toBe(true);
  });

  it("rejects when no session exists", () => {
    const v = validateNegotiateCompletion({
      session: null,
      strategy,
      rounds: [],
      outcomeType: "settled",
      finalSettlement: 10000,
      outcomeNotes: "Done.",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("session"))).toBe(true);
  });

  it("rejects when no strategy exists", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy: null,
      rounds: [],
      outcomeType: "settled",
      finalSettlement: 10000,
      outcomeNotes: "Done.",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("strategy"))).toBe(true);
  });

  it("rejects when no outcome type selected", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: null,
      finalSettlement: null,
      outcomeNotes: "",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("outcome type"))).toBe(true);
  });

  it("warns when zero rounds recorded", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: [],
      outcomeType: "settled",
      finalSettlement: 10000,
      outcomeNotes: "Quick settlement.",
    });
    expect(v.valid).toBe(true);
    expect(v.warnings.some(w => w.includes("zero round"))).toBe(true);
  });

  it("warns about litigation notes for transferred_forward", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "transferred_forward",
      finalSettlement: null,
      outcomeNotes: "Cannot resolve. Sending to counsel.",
    });
    expect(v.valid).toBe(true);
    expect(v.warnings.some(w => w.includes("litigation"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// PACKAGE BUILDING
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Package Building", () => {
  it("builds complete package for settlement", () => {
    const gen = generateStrategy(SCENARIO_REASONABLE.vm);
    const pkg = buildNegotiatePackage({
      vm: SCENARIO_REASONABLE.vm,
      session: SCENARIO_REASONABLE.session,
      strategy: { version: 2, generated_strategy: gen, overrides: [] },
      rounds: SCENARIO_REASONABLE.rounds,
      notes: SCENARIO_REASONABLE.notes,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled after 3 rounds at $20,000.",
      unresolvedIssues: [],
      nextStepRecommendations: [],
      litigationLikely: false,
      attorneyName: null,
      firmName: null,
      observationsCount: 0,
      calibrationSignalsCount: 0,
      calibrationHighConfCount: 0,
      calibrationJurisdictionBand: null,
    });

    expect(pkg.engine_version).toBe("negotiate-v1.0.0");
    expect(pkg.outcome_type).toBe("settled");
    expect(pkg.final_settlement_amount).toBe(20000);
    expect(pkg.source_eval_package_id).toBe("eval-pkg-reasonable");
    expect(pkg.source_eval_package_version).toBe(1);
    expect(pkg.strategy_version).toBe(2);
    expect(pkg.round_timeline).toHaveLength(3);
    expect(pkg.total_rounds).toBe(3);
    expect(pkg.strategy_summary).toBeDefined();
    expect(pkg.strategy_summary!.opening_offer).toBeGreaterThan(0);
    expect(pkg.valuation_summary.floor).toBe(15000);
    expect(pkg.key_notes).toHaveLength(2);
  });

  it("builds package for non-settlement with unresolved issues", () => {
    const gen = generateStrategy(SCENARIO_EXCESSIVE_DEMAND.vm);
    const pkg = buildNegotiatePackage({
      vm: SCENARIO_EXCESSIVE_DEMAND.vm,
      session: SCENARIO_EXCESSIVE_DEMAND.session,
      strategy: { version: 1, generated_strategy: gen, overrides: [] },
      rounds: SCENARIO_EXCESSIVE_DEMAND.rounds,
      notes: SCENARIO_EXCESSIVE_DEMAND.notes,
      outcomeType: "impasse",
      finalSettlement: null,
      outcomeNotes: "Impasse after 4 rounds. Claimant refuses to acknowledge medical review reductions.",
      unresolvedIssues: ["Medical specials dispute", "Excessive demand anchoring"],
      nextStepRecommendations: ["Consider mediation", "Update medical review with latest records"],
      litigationLikely: true,
      attorneyName: null,
      firmName: null,
      observationsCount: 0,
      calibrationSignalsCount: 0,
      calibrationHighConfCount: 0,
      calibrationJurisdictionBand: null,
    });

    expect(pkg.outcome_type).toBe("impasse");
    expect(pkg.final_settlement_amount).toBeNull();
    expect(pkg.unresolved_issues).toHaveLength(2);
    expect(pkg.next_step_recommendations).toHaveLength(2);
    expect(pkg.litigation_likely).toBe(true);
    expect(pkg.round_timeline).toHaveLength(4);
  });

  it("builds package with attorney intelligence", () => {
    const gen = generateStrategy(SCENARIO_KNOWN_ATTORNEY.vm);
    const pkg = buildNegotiatePackage({
      vm: SCENARIO_KNOWN_ATTORNEY.vm,
      session: SCENARIO_KNOWN_ATTORNEY.session,
      strategy: { version: 1, generated_strategy: gen, overrides: [] },
      rounds: SCENARIO_KNOWN_ATTORNEY.rounds,
      notes: SCENARIO_KNOWN_ATTORNEY.notes,
      outcomeType: "settled",
      finalSettlement: 38000,
      outcomeNotes: "Settled at $38K consistent with attorney historical pattern.",
      unresolvedIssues: [],
      nextStepRecommendations: [],
      litigationLikely: false,
      attorneyName: "R. Patterson",
      firmName: "Patterson & Associates",
      observationsCount: 5,
      calibrationSignalsCount: 4,
      calibrationHighConfCount: 2,
      calibrationJurisdictionBand: "$25K-$45K",
    });

    expect(pkg.attorney_intelligence).toBeDefined();
    expect(pkg.attorney_intelligence!.attorney_name).toBe("R. Patterson");
    expect(pkg.attorney_intelligence!.observations_count).toBe(5);
    expect(pkg.calibration_summary).toBeDefined();
    expect(pkg.calibration_summary!.signals_count).toBe(4);
  });

  it("preserves EvaluatePackage provenance in all packages", () => {
    for (const f of ALL_NEGOTIATE_FIXTURES) {
      const gen = generateStrategy(f.vm);
      const pkg = buildNegotiatePackage({
        vm: f.vm,
        session: f.session,
        strategy: { version: 1, generated_strategy: gen, overrides: [] },
        rounds: f.rounds,
        notes: f.notes,
        outcomeType: "settled",
        finalSettlement: 10000,
        outcomeNotes: "Test.",
        unresolvedIssues: [],
        nextStepRecommendations: [],
        litigationLikely: false,
        attorneyName: null,
        firmName: null,
        observationsCount: 0,
        calibrationSignalsCount: 0,
        calibrationHighConfCount: 0,
        calibrationJurisdictionBand: null,
      });
      expect(pkg.source_eval_package_id).toBe(f.vm.provenance.packageId);
      expect(pkg.source_eval_package_version).toBe(f.vm.provenance.packageVersion);
    }
  });
});

// ════════════════════════════════════════════════════════
// NUMERIC VALIDATION & EDGE CASES
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Numeric Validation & Edge Cases", () => {
  it("strategy handles zero-range VM gracefully", () => {
    const zeroVM = {
      ...SCENARIO_REASONABLE.vm,
      valuationRange: { floor: 0, likely: 0, stretch: 0, confidence: 0, selectedFloor: null, selectedLikely: null, selectedStretch: null, authorityRecommendation: null },
      specials: { totalBilled: 0, totalReviewed: null, reductionPercent: null },
    };
    const s = generateStrategy(zeroVM);
    expect(s.openingOffer.generated).toBe(0);
    expect(s.walkAwayThreshold.generated).toBe(0);
    expect(s.concessionPosture.generated).toBe("flexible");
  });

  it("authority check handles zero authority", () => {
    const check = checkAuthority(0, null, 1000);
    expect(check.exceedsAuthority).toBe(true);
    expect(check.exceedsPct).toBeNull(); // can't divide by zero
  });

  it("authority check handles negative amounts", () => {
    const check = checkAuthority(10000, null, -500);
    expect(check.exceedsAuthority).toBe(false);
  });

  it("package validation rejects negative settlement", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy: { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) },
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: -1000,
      outcomeNotes: "Negative.",
    });
    expect(v.valid).toBe(false);
  });

  it("package validation rejects zero settlement", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy: { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) },
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 0,
      outcomeNotes: "Zero.",
    });
    expect(v.valid).toBe(false);
  });

  it("all outcome types can be validated", () => {
    const outcomes: NegotiateOutcomeType[] = ["settled", "impasse", "transferred_forward", "closed_without_settlement"];
    for (const outcome of outcomes) {
      const v = validateNegotiateCompletion({
        session: SCENARIO_REASONABLE.session,
        strategy: { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) },
        rounds: SCENARIO_REASONABLE.rounds,
        outcomeType: outcome,
        finalSettlement: outcome === "settled" ? 15000 : null,
        outcomeNotes: outcome !== "settled" ? "Non-settlement outcome with notes." : "",
      });
      expect(v.valid).toBe(true);
    }
  });
});
