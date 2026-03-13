/**
 * NegotiateIQ — Representation-Aware Strategy, Drafting, and Compliance Tests
 *
 * Validates:
 * 1. Strategy posture selection based on representation context
 * 2. Draft language differentiation by audience
 * 3. No language implies value discount for unrepresented claimants
 * 4. Strategy reset after attorney retention
 * 5. Recommendation wording remains defensible
 */

import { describe, it, expect } from "vitest";
import { generateStrategy } from "@/lib/negotiateStrategyEngine";
import { generateResponseRecommendations } from "@/lib/negotiateResponseEngine";
import { generateDraft, DRAFT_TYPE_META, type DraftType } from "@/lib/negotiateDraftEngine";
import type { NegotiationViewModel, NegotiateRepresentationView } from "@/lib/negotiateViewModel";
import { ALL_NEGOTIATE_FIXTURES, SCENARIO_REASONABLE } from "@/test/fixtures/negotiateFixtures";

// ─── Fixture Helpers ────────────────────────────────────

function withRepresentation(vm: NegotiationViewModel, rep: Partial<NegotiateRepresentationView>): NegotiationViewModel {
  return { ...vm, representation: { ...vm.representation, ...rep } };
}

const UNREPRESENTED_VM = withRepresentation(SCENARIO_REASONABLE.vm, {
  status: "unrepresented",
  retentionRisk: 30,
  attorneyName: null,
  firmName: null,
  historyCount: 0,
  transitioned: false,
  attorneyRetainedDuringClaim: false,
  attorneyRetainedAfterInitialOffer: false,
});

const HIGH_RETENTION_RISK_VM = withRepresentation(SCENARIO_REASONABLE.vm, {
  status: "unrepresented",
  retentionRisk: 80,
  attorneyName: null,
  firmName: null,
  historyCount: 0,
  transitioned: false,
  attorneyRetainedDuringClaim: false,
  attorneyRetainedAfterInitialOffer: false,
});

const REPRESENTED_VM = withRepresentation(SCENARIO_REASONABLE.vm, {
  status: "represented",
  retentionRisk: 0,
  attorneyName: "J. Doe",
  firmName: "Doe & Associates",
  historyCount: 1,
  transitioned: false,
  attorneyRetainedDuringClaim: true,
  attorneyRetainedAfterInitialOffer: false,
});

const TRANSITIONED_VM = withRepresentation(SCENARIO_REASONABLE.vm, {
  status: "represented",
  retentionRisk: 0,
  attorneyName: "J. Doe",
  firmName: "Doe & Associates",
  historyCount: 2,
  transitioned: true,
  attorneyRetainedDuringClaim: true,
  attorneyRetainedAfterInitialOffer: true,
});

// ════════════════════════════════════════════════════════
// STRATEGY POSTURE SELECTION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Representation Posture Selection", () => {
  it("selects direct_resolution for unrepresented claimant", () => {
    const s = generateStrategy(UNREPRESENTED_VM);
    expect(s.representationPosture.generated).toMatch(/unrepresented/);
  });

  it("selects counsel_retention_risk for high retention risk", () => {
    const s = generateStrategy(HIGH_RETENTION_RISK_VM);
    expect(s.representationPosture.generated).toBe("counsel_retention_risk");
  });

  it("selects represented_balanced for standard represented claimant", () => {
    const s = generateStrategy(REPRESENTED_VM);
    expect(s.representationPosture.generated).toBe("represented_balanced");
  });

  it("selects post_retention_strategy_reset for transitioned claimant", () => {
    const s = generateStrategy(TRANSITIONED_VM);
    expect(s.representationPosture.generated).toBe("post_retention_strategy_reset");
  });

  it("all posture reasons are non-empty", () => {
    for (const vm of [UNREPRESENTED_VM, HIGH_RETENTION_RISK_VM, REPRESENTED_VM, TRANSITIONED_VM]) {
      const s = generateStrategy(vm);
      expect(s.representationPosture.reason.length).toBeGreaterThan(10);
    }
  });
});

// ════════════════════════════════════════════════════════
// VALUE PARITY — NO DISCOUNT FOR UNREPRESENTED
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Value Parity (No Unrepresented Discount)", () => {
  it("opening offer is identical for represented and unrepresented with same facts", () => {
    const sRep = generateStrategy(REPRESENTED_VM);
    const sUnrep = generateStrategy(UNREPRESENTED_VM);
    expect(sUnrep.openingOffer.generated).toBe(sRep.openingOffer.generated);
  });

  it("authority ceiling is identical for represented and unrepresented", () => {
    const sRep = generateStrategy(REPRESENTED_VM);
    const sUnrep = generateStrategy(UNREPRESENTED_VM);
    expect(sUnrep.authorityCeiling.generated).toBe(sRep.authorityCeiling.generated);
  });

  it("target settlement zone is identical for represented and unrepresented", () => {
    const sRep = generateStrategy(REPRESENTED_VM);
    const sUnrep = generateStrategy(UNREPRESENTED_VM);
    expect(sUnrep.targetSettlementZone.generated.low).toBe(sRep.targetSettlementZone.generated.low);
    expect(sUnrep.targetSettlementZone.generated.high).toBe(sRep.targetSettlementZone.generated.high);
  });

  it("walk-away threshold is identical for represented and unrepresented", () => {
    const sRep = generateStrategy(REPRESENTED_VM);
    const sUnrep = generateStrategy(UNREPRESENTED_VM);
    expect(sUnrep.walkAwayThreshold.generated).toBe(sRep.walkAwayThreshold.generated);
  });

  it("concession posture is identical for represented and unrepresented with same facts", () => {
    const sRep = generateStrategy(REPRESENTED_VM);
    const sUnrep = generateStrategy(UNREPRESENTED_VM);
    expect(sUnrep.concessionPosture.generated).toBe(sRep.concessionPosture.generated);
  });

  it("rationale includes compliance statement", () => {
    for (const vm of [UNREPRESENTED_VM, REPRESENTED_VM, TRANSITIONED_VM]) {
      const s = generateStrategy(vm);
      expect(s.rationaleSummary).toContain("Representation status did not directly reduce fact-based case value");
    }
  });

  it("strategy rationale never says value is lower because claimant is unrepresented", () => {
    const s = generateStrategy(UNREPRESENTED_VM);
    const lower = s.rationaleSummary.toLowerCase();
    expect(lower).not.toContain("lower because unrepresented");
    expect(lower).not.toContain("reduced due to lack of counsel");
    expect(lower).not.toContain("discount for unrepresented");
    expect(lower).not.toContain("value reduced because");
  });
});

// ════════════════════════════════════════════════════════
// DRAFT LANGUAGE DIFFERENTIATION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Draft Audience Branching", () => {
  const strategyRep = generateStrategy(REPRESENTED_VM);
  const strategyUnrep = generateStrategy(UNREPRESENTED_VM);

  it("unrepresented offer letter uses plain language", () => {
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy: strategyUnrep,
      rounds: [],
    });
    expect(draft.audience).toBe("claimant_direct");
    expect(draft.externalContent).toContain("What this means for you");
    expect(draft.externalContent).toContain("You are not required to accept");
    expect(draft.externalContent).toContain("seek legal advice");
    // Should NOT contain attorney-facing jargon
    expect(draft.externalContent).not.toContain("claimant counsel");
    expect(draft.externalContent).not.toContain("demand package");
  });

  it("represented offer letter uses attorney-facing language", () => {
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "neutral",
      vm: REPRESENTED_VM,
      strategy: strategyRep,
      rounds: [],
    });
    expect(draft.audience).toBe("attorney");
    expect(draft.externalContent).toContain("demand package");
    expect(draft.externalContent).not.toContain("What this means for you");
  });

  it("unrepresented excessive demand response is non-coercive", () => {
    const draft = generateDraft({
      draftType: "excessive_demand_response",
      tone: "firm",
      vm: UNREPRESENTED_VM,
      strategy: strategyUnrep,
      rounds: [],
    });
    expect(draft.audience).toBe("claimant_direct");
    expect(draft.externalContent).toContain("right to consult with an attorney");
    expect(draft.externalContent).not.toContain("take-it-or-leave-it");
  });

  it("phone talking points for unrepresented include plain-language reminders", () => {
    const draft = generateDraft({
      draftType: "phone_talking_points",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy: strategyUnrep,
      rounds: [],
    });
    expect(draft.externalContent).toContain("plain language");
    expect(draft.externalContent).toContain("Do not use legal jargon");
    expect(draft.externalContent).toContain("Do NOT suggest the amount is lower because they don't have an attorney");
  });

  it("all draft types generate successfully for both audiences", () => {
    const externalTypes = Object.entries(DRAFT_TYPE_META)
      .filter(([, meta]) => !meta.isInternal)
      .map(([k]) => k as DraftType);

    for (const dt of externalTypes) {
      const draftRep = generateDraft({ draftType: dt, tone: "neutral", vm: REPRESENTED_VM, strategy: strategyRep, rounds: [] });
      const draftUnrep = generateDraft({ draftType: dt, tone: "neutral", vm: UNREPRESENTED_VM, strategy: strategyUnrep, rounds: [] });

      expect(draftRep.audience).toBe("attorney");
      expect(draftUnrep.audience).toBe("claimant_direct");
      expect(draftRep.externalContent.length).toBeGreaterThan(50);
      expect(draftUnrep.externalContent.length).toBeGreaterThan(50);
    }
  });
});

// ════════════════════════════════════════════════════════
// DRAFT COMPLIANCE — NO VALUE DISCOUNT LANGUAGE
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Draft Compliance (No Bias Language)", () => {
  const FORBIDDEN_PHRASES = [
    "lower because unrepresented",
    "reduced due to lack of counsel",
    "discount for unrepresented",
    "value is lower without an attorney",
    "less because you do not have",
    "reduced because no attorney",
    "unrepresented claimants receive less",
    "without counsel, the value",
  ];

  it("no unrepresented offer letter contains forbidden bias language", () => {
    const strategy = generateStrategy(UNREPRESENTED_VM);
    const draft = generateDraft({
      draftType: "offer_letter",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy,
      rounds: [],
    });
    const combined = (draft.externalContent + " " + draft.internalNotes).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(combined).not.toContain(phrase);
    }
  });

  it("no unrepresented counteroffer letter contains forbidden bias language", () => {
    const strategy = generateStrategy(UNREPRESENTED_VM);
    const draft = generateDraft({
      draftType: "counteroffer_letter",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
    });
    const combined = (draft.externalContent + " " + draft.internalNotes).toLowerCase();
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(combined).not.toContain(phrase);
    }
  });

  it("internal notes include compliance statement", () => {
    const strategy = generateStrategy(UNREPRESENTED_VM);
    const draft = generateDraft({
      draftType: "claim_file_note",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
    });
    expect(draft.internalNotes).toContain("Representation status did not directly reduce fact-based case value");
  });

  it("supervisor escalation includes compliance statement", () => {
    const strategy = generateStrategy(UNREPRESENTED_VM);
    const draft = generateDraft({
      draftType: "supervisor_escalation",
      tone: "neutral",
      vm: UNREPRESENTED_VM,
      strategy,
      rounds: SCENARIO_REASONABLE.rounds,
    });
    expect(draft.internalNotes).toContain("Representation status did not directly reduce fact-based case value");
  });
});

// ════════════════════════════════════════════════════════
// RECOMMENDATION COMPLIANCE
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Recommendation Compliance", () => {
  it("recommendation rationale never implies value discount for unrepresented", () => {
    const strategy = generateStrategy(UNREPRESENTED_VM);
    const output = generateResponseRecommendations({
      strategy,
      vm: UNREPRESENTED_VM,
      rounds: SCENARIO_REASONABLE.rounds,
      currentCeiling: 25000,
      openingDemand: 35000,
      latestCounteroffer: 21000,
      lastDefenseOffer: 16000,
    });
    for (const rec of output.recommendations) {
      const lower = rec.rationale.toLowerCase();
      expect(lower).not.toContain("lower because unrepresented");
      expect(lower).not.toContain("discount for unrepresented");
      expect(lower).not.toContain("value reduced because");
    }
  });

  it("retention risk warning appears for high-risk unrepresented on hold recommendation", () => {
    const strategy = generateStrategy(HIGH_RETENTION_RISK_VM);
    const output = generateResponseRecommendations({
      strategy,
      vm: HIGH_RETENTION_RISK_VM,
      rounds: SCENARIO_REASONABLE.rounds,
      currentCeiling: 25000,
      openingDemand: 35000,
      latestCounteroffer: 21000,
      lastDefenseOffer: 16000,
    });
    const holdRec = output.recommendations.find(r => r.action === "hold");
    if (holdRec) {
      const hasRetentionWarning = holdRec.warnings.some(w => w.code === "RETENTION_RISK");
      expect(hasRetentionWarning).toBe(true);
    }
  });

  it("post-retention strategy reset adds context to recommendations", () => {
    const strategy = generateStrategy(TRANSITIONED_VM);
    const output = generateResponseRecommendations({
      strategy,
      vm: TRANSITIONED_VM,
      rounds: SCENARIO_REASONABLE.rounds,
      currentCeiling: 25000,
      openingDemand: 35000,
      latestCounteroffer: 21000,
      lastDefenseOffer: 16000,
    });
    // At least one recommendation should mention post-retention context
    const hasContext = output.recommendations.some(r =>
      r.rationale.includes("Representation changed during this claim")
    );
    expect(hasContext).toBe(true);
  });
});

// ════════════════════════════════════════════════════════
// STRATEGY RESET AFTER ATTORNEY RETENTION
// ════════════════════════════════════════════════════════

describe("NegotiateIQ — Strategy Reset After Retention", () => {
  it("post-retention strategy preserves same value positions", () => {
    const sBefore = generateStrategy(UNREPRESENTED_VM);
    const sAfter = generateStrategy(TRANSITIONED_VM);

    // Same underlying facts → same value positions
    expect(sAfter.openingOffer.generated).toBe(sBefore.openingOffer.generated);
    expect(sAfter.targetSettlementZone.generated.low).toBe(sBefore.targetSettlementZone.generated.low);
    expect(sAfter.targetSettlementZone.generated.high).toBe(sBefore.targetSettlementZone.generated.high);
  });

  it("post-retention strategy has different representation posture", () => {
    const sBefore = generateStrategy(UNREPRESENTED_VM);
    const sAfter = generateStrategy(TRANSITIONED_VM);

    expect(sBefore.representationPosture.generated).not.toBe(sAfter.representationPosture.generated);
    expect(sAfter.representationPosture.generated).toBe("post_retention_strategy_reset");
  });
});
