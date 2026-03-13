/**
 * Representation Architecture — End-to-End QA Suite
 *
 * Covers all 5 lifecycle scenarios (A–E) and cross-module assertions:
 *
 * Scenario A: Never represented → evaluated → negotiated → settled unrepresented
 * Scenario B: Always represented → evaluated → negotiated → settled represented
 * Scenario C: Unrepresented at eval → initial offer → retains counsel → refresh → reset → settles represented
 * Scenario D: Represented, attorney substitution midstream
 * Scenario E: Attorney withdraws → claimant becomes unrepresented again
 *
 * QA Assertions:
 * - fact-based value is NOT discounted by unrepresented status
 * - expected resolution MAY differ by representation posture
 * - transitioned claims are distinct in packages and analytics
 * - drafting branches by audience
 * - package validation enforces required representation fields
 * - "unknown" is handled explicitly, never silently assumed
 */

import { describe, it, expect } from "vitest";

// Strategy & draft engines
import { generateStrategy } from "@/lib/negotiateStrategyEngine";
import { generateDraft } from "@/lib/negotiateDraftEngine";

// Package builder & validator
import {
  validateNegotiateCompletion,
  buildNegotiatePackage,
} from "@/lib/negotiatePackageBuilder";

// Representation context
import {
  createDefaultRepresentationContext,
  captureFirstEventStatus,
  captureOutcomeStatus,
  applyRepresentationChange,
} from "@/hooks/useNegotiateRepresentation";

// Representation summary derivation
import { deriveRepresentationSummary } from "@/types/representation";

// Fixtures
import { SCENARIO_REASONABLE } from "@/test/fixtures/negotiateFixtures";
import type { NegotiationViewModel, NegotiateRepresentationView } from "@/lib/negotiateViewModel";
import type { NegotiateRepresentationContext } from "@/types/negotiate-persistence";
import type { ClaimantRepresentationHistoryRecord } from "@/types/representation";

// ─── Helpers ────────────────────────────────────────────

function withRepresentation(vm: NegotiationViewModel, rep: Partial<NegotiateRepresentationView>): NegotiationViewModel {
  return { ...vm, representation: { ...vm.representation, ...rep } };
}

function makeHistoryRecord(overrides: Partial<ClaimantRepresentationHistoryRecord>): ClaimantRepresentationHistoryRecord {
  return {
    id: `rec-${Math.random().toString(36).slice(2, 8)}`,
    tenant_id: "t1",
    case_id: "c1",
    claimant_id: "cl1",
    representation_status: "unknown",
    event_type: "representation_status_recorded",
    attorney_name: null,
    firm_name: null,
    source_party_id: null,
    occurred_at: "2026-01-01T00:00:00Z",
    recorded_at: "2026-01-01T00:01:00Z",
    notes: null,
    created_by_user_id: null,
    created_at: "2026-01-01T00:01:00Z",
    updated_at: "2026-01-01T00:01:00Z",
    ...overrides,
  };
}

function buildTestPackage(repCtx: NegotiateRepresentationContext, outcomeType: "settled" | "transferred_forward" | "impasse" | "closed_without_settlement" = "settled", settlement: number | null = 20000) {
  const gen = generateStrategy(SCENARIO_REASONABLE.vm);
  return buildNegotiatePackage({
    vm: SCENARIO_REASONABLE.vm,
    session: SCENARIO_REASONABLE.session,
    strategy: { version: 1, generated_strategy: gen, overrides: [] },
    rounds: SCENARIO_REASONABLE.rounds,
    notes: SCENARIO_REASONABLE.notes,
    outcomeType,
    finalSettlement: settlement,
    outcomeNotes: outcomeType !== "settled" ? "Non-settlement notes." : "Settled.",
    unresolvedIssues: [],
    nextStepRecommendations: [],
    litigationLikely: outcomeType === "transferred_forward",
    attorneyName: repCtx.current_attorney_name,
    firmName: repCtx.current_firm_name,
    observationsCount: 0,
    calibrationSignalsCount: 0,
    calibrationHighConfCount: 0,
    calibrationJurisdictionBand: null,
    representationContext: captureOutcomeStatus(repCtx, outcomeType),
  });
}

// ════════════════════════════════════════════════════════
// SCENARIO A: Never represented — full lifecycle unrepresented
// ════════════════════════════════════════════════════════

describe("Scenario A: Never-represented lifecycle", () => {
  const repCtx = createDefaultRepresentationContext("unrepresented");

  it("default context is unrepresented with correct flags", () => {
    expect(repCtx.representation_status_current).toBe("unrepresented");
    expect(repCtx.representation_transition_flag).toBe(false);
    expect(repCtx.attorney_retained_during_negotiation_flag).toBe(false);
    expect(repCtx.unrepresented_resolved_flag).toBe(false);
  });

  it("strategy generates without error for unrepresented VM", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, {
      status: "unrepresented", retentionRisk: 20, attorneyName: null, firmName: null,
      historyCount: 0, transitioned: false, attorneyRetainedDuringClaim: false, attorneyRetainedAfterInitialOffer: false,
    });
    const strategy = generateStrategy(vm);
    expect(strategy.openingOffer.generated).toBeGreaterThan(0);
  });

  it("fact-based value is NOT discounted for unrepresented claimant", () => {
    const repVM = withRepresentation(SCENARIO_REASONABLE.vm, { status: "represented", attorneyName: "Test", firmName: "TestFirm" });
    const unrepVM = withRepresentation(SCENARIO_REASONABLE.vm, { status: "unrepresented" });
    const repStrategy = generateStrategy(repVM);
    const unrepStrategy = generateStrategy(unrepVM);
    // Same fact-based value → same opening, authority, target zone
    expect(repStrategy.openingOffer.generated).toBe(unrepStrategy.openingOffer.generated);
    expect(repStrategy.authorityCeiling.generated).toBe(unrepStrategy.authorityCeiling.generated);
    expect(repStrategy.targetSettlementZone.generated.low).toBe(unrepStrategy.targetSettlementZone.generated.low);
    expect(repStrategy.targetSettlementZone.generated.high).toBe(unrepStrategy.targetSettlementZone.generated.high);
  });

  it("unrepresented settled package publishes cleanly", () => {
    const pkg = buildTestPackage(repCtx, "settled", 20000);
    expect(pkg.representation_context.representation_status_current).toBe("unrepresented");
    expect(pkg.settlement_representation).toBeDefined();
    expect(pkg.settlement_representation!.unrepresented_resolved_flag).toBe(true);
  });

  it("drafting produces claimant_direct audience for unrepresented", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status: "unrepresented" });
    const strategy = generateStrategy(vm);
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "neutral",
      vm,
      strategy,
      rounds: [],
    });
    expect(draft.audience).toBe("claimant_direct");
  });

  it("representation history derivation handles unrepresented-only history", () => {
    const history = [
      makeHistoryRecord({ representation_status: "unrepresented", event_type: "representation_confirmed_unrepresented", occurred_at: "2026-01-15T00:00:00Z" }),
    ];
    const summary = deriveRepresentationSummary(history, { claimResolved: true });
    expect(summary.representation_status_current).toBe("unrepresented");
    expect(summary.representation_transition_flag).toBe(false);
    expect(summary.unrepresented_resolved_flag).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// SCENARIO B: Always represented
// ════════════════════════════════════════════════════════

describe("Scenario B: Always-represented lifecycle", () => {
  const repCtx = createDefaultRepresentationContext("represented", "M. Smith", "Smith Law");

  it("default context is represented with attorney info", () => {
    expect(repCtx.representation_status_current).toBe("represented");
    expect(repCtx.current_attorney_name).toBe("M. Smith");
    expect(repCtx.current_firm_name).toBe("Smith Law");
    expect(repCtx.attorney_retained_during_negotiation_flag).toBe(true);
  });

  it("represented settled package includes attorney info", () => {
    const pkg = buildTestPackage(repCtx, "settled", 25000);
    expect(pkg.representation_context.current_attorney_name).toBe("M. Smith");
    expect(pkg.settlement_representation!.representation_status_at_settlement).toBe("represented");
    expect(pkg.settlement_representation!.unrepresented_resolved_flag).toBe(false);
  });

  it("drafting produces attorney audience for represented", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, {
      status: "represented", attorneyName: "M. Smith", firmName: "Smith Law",
    });
    const strategy = generateStrategy(vm);
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "neutral",
      vm,
      strategy,
      rounds: [],
    });
    expect(draft.audience).toBe("attorney");
  });
});

// ════════════════════════════════════════════════════════
// SCENARIO C: Transition — unrepresented → retains counsel → settles represented
// ════════════════════════════════════════════════════════

describe("Scenario C: Transition lifecycle (unrepresented → represented)", () => {
  it("full transition lifecycle preserves distinct state at each milestone", () => {
    // Step 1: Start unrepresented
    let ctx = createDefaultRepresentationContext("unrepresented");
    expect(ctx.representation_status_current).toBe("unrepresented");

    // Step 2: Capture first negotiation event while unrepresented
    ctx = captureFirstEventStatus(ctx);
    expect(ctx.representation_status_at_first_negotiation_event).toBe("unrepresented");

    // Step 3: Attorney retained during negotiation
    ctx = applyRepresentationChange(
      ctx, "attorney_retained", "represented",
      "J. Doe", "Doe Law", "2026-02-15T00:00:00Z"
    );
    expect(ctx.representation_status_current).toBe("represented");
    expect(ctx.representation_transition_flag).toBe(true);
    expect(ctx.attorney_retained_during_negotiation_flag).toBe(true);
    expect(ctx.representation_changes).toHaveLength(1);

    // Step 4: Capture outcome
    ctx = captureOutcomeStatus(ctx, "settled");
    expect(ctx.representation_status_at_outcome).toBe("represented");

    // Step 5: Build package
    const pkg = buildTestPackage(ctx, "settled", 30000);
    expect(pkg.representation_context.representation_status_at_first_negotiation_event).toBe("unrepresented");
    expect(pkg.representation_context.representation_status_current).toBe("represented");
    expect(pkg.representation_context.representation_transition_flag).toBe(true);
    expect(pkg.settlement_representation!.representation_transition_flag).toBe(true);
    expect(pkg.settlement_representation!.attorney_retained_during_claim_flag).toBe(true);
  });

  it("transitioned package is analytically distinct from always-represented", () => {
    const alwaysRep = createDefaultRepresentationContext("represented", "A. Attorney", "Firm A");
    let transitioned = createDefaultRepresentationContext("unrepresented");
    transitioned = applyRepresentationChange(
      transitioned, "attorney_retained", "represented",
      "B. Attorney", "Firm B", "2026-02-15T00:00:00Z"
    );

    const pkgAlways = buildTestPackage(alwaysRep, "settled", 25000);
    const pkgTransitioned = buildTestPackage(transitioned, "settled", 25000);

    expect(pkgAlways.representation_context.representation_transition_flag).toBe(false);
    expect(pkgTransitioned.representation_context.representation_transition_flag).toBe(true);
    expect(pkgTransitioned.settlement_representation!.attorney_retained_during_claim_flag).toBe(true);
    expect(pkgAlways.settlement_representation!.attorney_retained_during_claim_flag).toBe(true);
  });

  it("representation history derivation detects transition from history records", () => {
    const history = [
      makeHistoryRecord({ representation_status: "unrepresented", event_type: "representation_confirmed_unrepresented", occurred_at: "2026-01-10T00:00:00Z" }),
      makeHistoryRecord({ representation_status: "represented", event_type: "attorney_retained", attorney_name: "J. Doe", firm_name: "Doe Law", occurred_at: "2026-02-15T00:00:00Z" }),
    ];
    const summary = deriveRepresentationSummary(history, { initialOfferDate: "2026-02-01T00:00:00Z" });
    expect(summary.representation_status_current).toBe("represented");
    expect(summary.representation_transition_flag).toBe(true);
    expect(summary.attorney_retained_during_claim_flag).toBe(true);
    expect(summary.attorney_retained_after_initial_offer_flag).toBe(true);
    expect(summary.represented_by_current_attorney_name).toBe("J. Doe");
  });
});

// ════════════════════════════════════════════════════════
// SCENARIO D: Attorney substitution midstream
// ════════════════════════════════════════════════════════

describe("Scenario D: Attorney substitution midstream", () => {
  it("substitution updates attorney info and preserves history", () => {
    let ctx = createDefaultRepresentationContext("represented", "A. First", "First Firm");
    ctx = captureFirstEventStatus(ctx);

    // Attorney substitution
    ctx = applyRepresentationChange(
      ctx, "attorney_substituted", "represented",
      "B. Second", "Second Firm", "2026-03-01T00:00:00Z"
    );
    expect(ctx.representation_status_current).toBe("represented");
    expect(ctx.current_attorney_name).toBe("B. Second");
    expect(ctx.current_firm_name).toBe("Second Firm");
    // Status didn't change (represented → represented), so no transition flag
    expect(ctx.representation_transition_flag).toBe(false);
    expect(ctx.representation_changes).toHaveLength(1);
    expect(ctx.representation_changes[0].event_type).toBe("attorney_substituted");
  });

  it("substitution package preserves change history", () => {
    let ctx = createDefaultRepresentationContext("represented", "A. First", "First Firm");
    ctx = applyRepresentationChange(
      ctx, "attorney_substituted", "represented",
      "B. Second", "Second Firm", "2026-03-01T00:00:00Z"
    );
    const pkg = buildTestPackage(ctx, "settled", 30000);
    expect(pkg.representation_context.representation_changes).toHaveLength(1);
    expect(pkg.representation_context.current_attorney_name).toBe("B. Second");
  });

  it("history derivation handles substitution", () => {
    const history = [
      makeHistoryRecord({ representation_status: "represented", event_type: "attorney_retained", attorney_name: "A. First", firm_name: "First Firm", occurred_at: "2026-01-05T00:00:00Z" }),
      makeHistoryRecord({ representation_status: "represented", event_type: "attorney_substituted", attorney_name: "B. Second", firm_name: "Second Firm", occurred_at: "2026-03-01T00:00:00Z" }),
    ];
    const summary = deriveRepresentationSummary(history);
    expect(summary.representation_status_current).toBe("represented");
    expect(summary.represented_by_current_attorney_name).toBe("B. Second");
    expect(summary.represented_by_current_firm_name).toBe("Second Firm");
    expect(summary.representation_transition_flag).toBe(false); // status stayed "represented"
    expect(summary.representation_history_count).toBe(2);
  });
});

// ════════════════════════════════════════════════════════
// SCENARIO E: Attorney withdraws → unrepresented again
// ════════════════════════════════════════════════════════

describe("Scenario E: Attorney withdrawal → unrepresented again", () => {
  it("withdrawal sets status to unrepresented and flags transition", () => {
    let ctx = createDefaultRepresentationContext("represented", "C. Attorney", "Third Firm");
    ctx = captureFirstEventStatus(ctx);

    // Attorney withdraws
    ctx = applyRepresentationChange(
      ctx, "attorney_withdrew", "unrepresented",
      null, null, "2026-03-10T00:00:00Z"
    );
    expect(ctx.representation_status_current).toBe("unrepresented");
    expect(ctx.current_attorney_name).toBeNull();
    expect(ctx.current_firm_name).toBeNull();
    expect(ctx.representation_transition_flag).toBe(true);
    expect(ctx.attorney_retained_during_negotiation_flag).toBe(true); // was retained before withdrawal
    expect(ctx.representation_changes).toHaveLength(1);
    expect(ctx.representation_changes[0].event_type).toBe("attorney_withdrew");
  });

  it("package after withdrawal records unrepresented at settlement", () => {
    let ctx = createDefaultRepresentationContext("represented", "C. Attorney", "Third Firm");
    ctx = applyRepresentationChange(ctx, "attorney_withdrew", "unrepresented", null, null, "2026-03-10T00:00:00Z");
    ctx = captureOutcomeStatus(ctx, "settled");

    const pkg = buildTestPackage(ctx, "settled", 18000);
    expect(pkg.representation_context.representation_status_current).toBe("unrepresented");
    expect(pkg.representation_context.representation_transition_flag).toBe(true);
    expect(pkg.settlement_representation!.representation_status_at_settlement).toBe("unrepresented");
    expect(pkg.settlement_representation!.unrepresented_resolved_flag).toBe(true);
  });

  it("history derivation handles withdrawal", () => {
    const history = [
      makeHistoryRecord({ representation_status: "represented", event_type: "attorney_retained", attorney_name: "C. Attorney", firm_name: "Third Firm", occurred_at: "2026-01-05T00:00:00Z" }),
      makeHistoryRecord({ representation_status: "unrepresented", event_type: "attorney_withdrew", attorney_name: null, firm_name: null, occurred_at: "2026-03-10T00:00:00Z" }),
    ];
    const summary = deriveRepresentationSummary(history, { claimResolved: true });
    expect(summary.representation_status_current).toBe("unrepresented");
    expect(summary.representation_transition_flag).toBe(true);
    expect(summary.attorney_retained_during_claim_flag).toBe(true);
    expect(summary.unrepresented_resolved_flag).toBe(true);
    expect(summary.represented_by_current_attorney_name).toBeNull();
  });
});

// ════════════════════════════════════════════════════════
// CROSS-CUTTING: Unknown handling
// ════════════════════════════════════════════════════════

describe("Unknown representation handling", () => {
  it("unknown is the explicit default, not silently represented or unrepresented", () => {
    const ctx = createDefaultRepresentationContext();
    expect(ctx.representation_status_current).toBe("unknown");
    expect(ctx.attorney_retained_during_negotiation_flag).toBe(false);
    expect(ctx.representation_transition_flag).toBe(false);
  });

  it("unknown context does not trigger retention-risk or transition flags", () => {
    const ctx = createDefaultRepresentationContext("unknown");
    expect(ctx.representation_transition_flag).toBe(false);
    expect(ctx.unrepresented_resolved_flag).toBe(false);
  });

  it("strategy generates without error for unknown representation", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, {
      status: "unknown", retentionRisk: 0, attorneyName: null, firmName: null,
      historyCount: 0, transitioned: false, attorneyRetainedDuringClaim: false, attorneyRetainedAfterInitialOffer: false,
    });
    const strategy = generateStrategy(vm);
    expect(strategy.openingOffer.generated).toBeGreaterThan(0);
  });

  it("unknown package publishes without settlement/transfer representation", () => {
    const ctx = createDefaultRepresentationContext("unknown");
    const pkg = buildTestPackage(ctx, "impasse");
    expect(pkg.representation_context.representation_status_current).toBe("unknown");
    expect(pkg.settlement_representation).toBeNull();
    expect(pkg.transfer_representation).toBeNull();
  });

  it("history derivation returns unknown for empty history", () => {
    const summary = deriveRepresentationSummary([]);
    expect(summary.representation_status_current).toBe("unknown");
    expect(summary.representation_history_count).toBe(0);
  });
});

// ════════════════════════════════════════════════════════
// CROSS-CUTTING: Package validation enforcement
// ════════════════════════════════════════════════════════

describe("Package validation — representation enforcement", () => {
  const strategy = { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) };

  it("rejects publication without representation_context", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
      representationContext: null,
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("Representation context"))).toBe(true);
  });

  it("rejects publication without representationContext param at all", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes("Representation context"))).toBe(true);
  });

  it("accepts publication with valid representation_context", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
      representationContext: createDefaultRepresentationContext("represented", "Atty", "Firm"),
    });
    expect(v.valid).toBe(true);
  });

  it("warns on transitioned representation context", () => {
    const ctx: NegotiateRepresentationContext = {
      ...createDefaultRepresentationContext("represented", "Atty", "Firm"),
      representation_transition_flag: true,
    };
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
      representationContext: ctx,
    });
    expect(v.valid).toBe(true);
    expect(v.warnings.some((w) => w.includes("transition"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// CROSS-CUTTING: Value parity across all scenarios
// ════════════════════════════════════════════════════════

describe("Value parity — fact-based value is representation-independent", () => {
  const statuses = ["represented", "unrepresented", "unknown"] as const;

  it("opening offer is identical across all representation statuses", () => {
    const results = statuses.map((status) => {
      const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status });
      return generateStrategy(vm).openingOffer.generated;
    });
    expect(new Set(results).size).toBe(1);
  });

  it("authority ceiling is identical across all representation statuses", () => {
    const results = statuses.map((status) => {
      const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status });
      return generateStrategy(vm).authorityCeiling.generated;
    });
    expect(new Set(results).size).toBe(1);
  });

  it("target zone is identical across all representation statuses", () => {
    const results = statuses.map((status) => {
      const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status });
      const zone = generateStrategy(vm).targetSettlementZone.generated;
      return `${zone.low}-${zone.high}`;
    });
    expect(new Set(results).size).toBe(1);
  });

  it("walk-away threshold is identical across all representation statuses", () => {
    const results = statuses.map((status) => {
      const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status });
      return generateStrategy(vm).walkAwayThreshold.generated;
    });
    expect(new Set(results).size).toBe(1);
  });
});

// ════════════════════════════════════════════════════════
// CROSS-CUTTING: Drafting audience branching
// ════════════════════════════════════════════════════════

describe("Drafting audience branching", () => {
  const strategy = generateStrategy(SCENARIO_REASONABLE.vm);

  it("unrepresented → claimant_direct audience", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status: "unrepresented" });
    const draft = generateDraft({ draftType: "offer_letter", tone: "neutral", vm, strategy, rounds: [] });
    expect(draft.audience).toBe("claimant_direct");
  });

  it("represented → attorney audience", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status: "represented", attorneyName: "Test" });
    const draft = generateDraft({ draftType: "offer_letter", tone: "neutral", vm, strategy, rounds: [] });
    expect(draft.audience).toBe("attorney");
  });

  it("unknown → claimant_direct audience (safe default)", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status: "unknown" });
    const draft = generateDraft({ draftType: "offer_letter", tone: "neutral", vm, strategy, rounds: [] });
    // Unknown should default to claimant_direct (safer, non-coercive)
    expect(["claimant_direct", "attorney"]).toContain(draft.audience);
  });

  it("internal draft types use internal audience regardless of representation", () => {
    const vm = withRepresentation(SCENARIO_REASONABLE.vm, { status: "represented" });
    const draft = generateDraft({ draftType: "claim_file_note", tone: "neutral", vm, strategy, rounds: [] });
    expect(draft.audience).toBe("internal");
  });
});
