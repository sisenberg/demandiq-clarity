/**
 * NegotiateIQ — Package Representation Tests
 *
 * Validates:
 * 1. representation_context is required on all packages
 * 2. settlement packages include settlement_representation
 * 3. transfer packages include transfer_representation
 * 4. unrepresented, represented, and transitioned claims publish distinctly
 * 5. validation rejects missing representation fields
 */

import { describe, it, expect } from "vitest";
import { generateStrategy } from "@/lib/negotiateStrategyEngine";
import {
  validateNegotiateCompletion,
  buildNegotiatePackage,
  type NegotiateOutcomeType,
} from "@/lib/negotiatePackageBuilder";
import { createDefaultRepresentationContext, captureOutcomeStatus } from "@/hooks/useNegotiateRepresentation";
import { SCENARIO_REASONABLE, SCENARIO_EXCESSIVE_DEMAND } from "@/test/fixtures/negotiateFixtures";
import type { NegotiateRepresentationContext } from "@/types/negotiate-persistence";

// ─── Fixtures ───────────────────────────────────────────

const REP_CTX_REPRESENTED = createDefaultRepresentationContext("represented", "J. Doe", "Doe Law");
const REP_CTX_UNREPRESENTED = createDefaultRepresentationContext("unrepresented");
const REP_CTX_TRANSITIONED: NegotiateRepresentationContext = {
  ...createDefaultRepresentationContext("represented", "J. Doe", "Doe Law"),
  representation_transition_flag: true,
  attorney_retained_during_negotiation_flag: true,
  attorney_retained_after_initial_offer_flag: true,
  representation_history_summary: "Claimant was unrepresented, then retained J. Doe (Doe Law) during negotiation.",
  representation_changes: [
    {
      event_type: "attorney_retained",
      previous_status: "unrepresented",
      new_status: "represented",
      attorney_name: "J. Doe",
      firm_name: "Doe Law",
      occurred_at: "2026-03-05T00:00:00Z",
      recorded_at: "2026-03-05T00:01:00Z",
    },
  ],
};

function buildPkg(outcomeType: NegotiateOutcomeType, repCtx: NegotiateRepresentationContext, settlement: number | null = null) {
  const gen = generateStrategy(SCENARIO_REASONABLE.vm);
  return buildNegotiatePackage({
    vm: SCENARIO_REASONABLE.vm,
    session: SCENARIO_REASONABLE.session,
    strategy: { version: 1, generated_strategy: gen, overrides: [] },
    rounds: SCENARIO_REASONABLE.rounds,
    notes: SCENARIO_REASONABLE.notes,
    outcomeType,
    finalSettlement: settlement,
    outcomeNotes: outcomeType !== "settled" ? "Non-settlement notes for outcome." : "Settled.",
    unresolvedIssues: [],
    nextStepRecommendations: [],
    litigationLikely: false,
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
// VALIDATION
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Representation Validation", () => {
  const strategy = { version: 1, generated_strategy: generateStrategy(SCENARIO_REASONABLE.vm) };

  it("rejects package when representation_context is missing", () => {
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
    expect(v.errors.some(e => e.includes("Representation context"))).toBe(true);
  });

  it("accepts package when representation_context is provided", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
      representationContext: REP_CTX_REPRESENTED,
    });
    expect(v.valid).toBe(true);
  });

  it("warns when representation transitioned", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
      representationContext: REP_CTX_TRANSITIONED,
    });
    expect(v.valid).toBe(true);
    expect(v.warnings.some(w => w.includes("transition"))).toBe(true);
  });

  it("backward compat: validation works without representationContext param", () => {
    const v = validateNegotiateCompletion({
      session: SCENARIO_REASONABLE.session,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
      outcomeType: "settled",
      finalSettlement: 20000,
      outcomeNotes: "Settled.",
    });
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes("Representation context"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// SETTLEMENT PACKAGES
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Settlement Representation", () => {
  it("represented settlement includes settlement_representation", () => {
    const pkg = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    expect(pkg.representation_context).toBeDefined();
    expect(pkg.representation_context.representation_status_current).toBe("represented");
    expect(pkg.settlement_representation).toBeDefined();
    expect(pkg.settlement_representation!.representation_status_at_settlement).toBe("represented");
    expect(pkg.settlement_representation!.representation_transition_flag).toBe(false);
    expect(pkg.transfer_representation).toBeNull();
  });

  it("unrepresented settlement publishes cleanly", () => {
    const pkg = buildPkg("settled", REP_CTX_UNREPRESENTED, 20000);
    expect(pkg.representation_context.representation_status_current).toBe("unrepresented");
    expect(pkg.settlement_representation).toBeDefined();
    expect(pkg.settlement_representation!.representation_status_at_settlement).toBe("unrepresented");
    expect(pkg.settlement_representation!.unrepresented_resolved_flag).toBe(true);
  });

  it("transitioned settlement preserves transition flag", () => {
    const pkg = buildPkg("settled", REP_CTX_TRANSITIONED, 20000);
    expect(pkg.representation_context.representation_transition_flag).toBe(true);
    expect(pkg.settlement_representation).toBeDefined();
    expect(pkg.settlement_representation!.representation_transition_flag).toBe(true);
    expect(pkg.settlement_representation!.attorney_retained_during_claim_flag).toBe(true);
    expect(pkg.settlement_representation!.attorney_retained_after_initial_offer_flag).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// TRANSFER PACKAGES
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Transfer Representation", () => {
  it("transfer includes transfer_representation", () => {
    const pkg = buildPkg("transferred_forward", REP_CTX_REPRESENTED);
    expect(pkg.transfer_representation).toBeDefined();
    expect(pkg.transfer_representation!.representation_status_at_transfer).toBe("represented");
    expect(pkg.settlement_representation).toBeNull();
  });

  it("transitioned transfer preserves transition flag", () => {
    const pkg = buildPkg("transferred_forward", REP_CTX_TRANSITIONED);
    expect(pkg.transfer_representation).toBeDefined();
    expect(pkg.transfer_representation!.representation_transition_flag).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// IMPASSE / CLOSED PACKAGES
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Non-Settlement Representation", () => {
  it("impasse has representation_context but no settlement/transfer sections", () => {
    const pkg = buildPkg("impasse", REP_CTX_UNREPRESENTED);
    expect(pkg.representation_context).toBeDefined();
    expect(pkg.representation_context.representation_status_current).toBe("unrepresented");
    expect(pkg.settlement_representation).toBeNull();
    expect(pkg.transfer_representation).toBeNull();
  });

  it("closed_without_settlement has representation_context", () => {
    const pkg = buildPkg("closed_without_settlement", REP_CTX_REPRESENTED);
    expect(pkg.representation_context).toBeDefined();
    expect(pkg.settlement_representation).toBeNull();
    expect(pkg.transfer_representation).toBeNull();
  });
});

// ════════════════════════════════════════════════════════
// PACKAGE STRUCTURE
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Structure & Required Fields", () => {
  it("engine_version is v1.1.0", () => {
    const pkg = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    expect(pkg.engine_version).toBe("negotiate-v1.1.0");
  });

  it("representation_context has all required fields", () => {
    const pkg = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    const rc = pkg.representation_context;
    expect(rc.representation_status_current).toBeDefined();
    expect(rc.representation_status_at_first_negotiation_event).toBeDefined(); // null is valid
    expect(rc.representation_status_at_publication).toBeDefined();
    expect(rc.representation_status_at_outcome).toBeDefined();
    expect(typeof rc.representation_transition_flag).toBe("boolean");
  });

  it("representation_context has all recommended fields", () => {
    const pkg = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    const rc = pkg.representation_context;
    expect(typeof rc.attorney_retained_during_negotiation_flag).toBe("boolean");
    expect(typeof rc.attorney_retained_after_initial_offer_flag).toBe("boolean");
    expect(typeof rc.unrepresented_resolved_flag).toBe("boolean");
    expect(typeof rc.representation_history_summary).toBe("string");
    expect(rc.representation_history_summary.length).toBeGreaterThan(0);
  });

  it("all three representation states produce distinct packages", () => {
    const pkgRep = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    const pkgUnrep = buildPkg("settled", REP_CTX_UNREPRESENTED, 20000);
    const pkgTrans = buildPkg("settled", REP_CTX_TRANSITIONED, 20000);

    // All have representation_context
    expect(pkgRep.representation_context.representation_status_current).toBe("represented");
    expect(pkgUnrep.representation_context.representation_status_current).toBe("unrepresented");
    expect(pkgTrans.representation_context.representation_status_current).toBe("represented");
    expect(pkgTrans.representation_context.representation_transition_flag).toBe(true);

    // Unrepresented is distinctly flagged, not collapsed into represented
    expect(pkgUnrep.settlement_representation!.unrepresented_resolved_flag).toBe(true);
    expect(pkgRep.settlement_representation!.unrepresented_resolved_flag).toBe(false);

    // Transitioned is distinctly flagged, not collapsed into either
    expect(pkgTrans.settlement_representation!.representation_transition_flag).toBe(true);
    expect(pkgRep.settlement_representation!.representation_transition_flag).toBe(false);
    expect(pkgUnrep.settlement_representation!.representation_transition_flag).toBe(false);
  });
});

// ════════════════════════════════════════════════════════
// TIMELINE REPRESENTATION EVENTS IN PACKAGE
// ════════════════════════════════════════════════════════

describe("NegotiatePackage — Representation Timeline", () => {
  it("transitioned package includes representation_changes", () => {
    const pkg = buildPkg("settled", REP_CTX_TRANSITIONED, 20000);
    expect(pkg.representation_context.representation_changes.length).toBeGreaterThan(0);
    expect(pkg.representation_context.representation_changes[0].event_type).toBe("attorney_retained");
  });

  it("non-transitioned package has empty representation_changes", () => {
    const pkg = buildPkg("settled", REP_CTX_REPRESENTED, 20000);
    expect(pkg.representation_context.representation_changes).toHaveLength(0);
  });
});
