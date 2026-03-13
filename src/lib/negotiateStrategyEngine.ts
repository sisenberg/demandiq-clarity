/**
 * NegotiateIQ — Strategy Engine v1.1
 *
 * Generates an initial negotiation plan from a NegotiationViewModel
 * (derived from EvaluatePackage v1). No re-valuation is performed.
 *
 * Representation-aware: selects posture based on representation context
 * without reducing fact-based value. Same value logic, different
 * negotiation logic.
 */

import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type {
  GeneratedStrategy,
  ConcessionPosture,
  RepresentationPosture,
  MovementPlan,
  TacticalRecommendation,
  StrategyRecommendation,
} from "@/types/negotiate-strategy";

const ENGINE_VERSION = "1.1.0";

export function generateStrategy(vm: NegotiationViewModel): GeneratedStrategy {
  const r = vm.valuationRange;
  const floor = r.selectedFloor ?? r.floor ?? 0;
  const likely = r.selectedLikely ?? r.likely ?? floor;
  const stretch = r.selectedStretch ?? r.stretch ?? likely;
  const authority = r.authorityRecommendation;
  const confidence = r.confidence ?? 0.5;

  // ── Signals ──────────────────────────────────────────
  const hasStrongLiability = !vm.risks.some((rk) => rk.category === "liability");
  const hasVenueRisk = vm.risks.some((rk) => rk.category === "venue");
  const hasCausationIssues = vm.risks.some((rk) => rk.category === "causation");
  const hasCredibilityIssues = vm.risks.some((rk) => rk.category === "credibility");
  const hasTreatmentGaps = vm.risks.some((rk) => rk.category === "gap" || rk.category === "treatment");
  const significantReduction = (vm.specials.reductionPercent ?? 0) > 25;
  const expCount = vm.expanders.length;
  const redCount = vm.reducers.length;
  const netDriverBias = expCount - redCount;

  // ── Concession Posture ───────────────────────────────
  const concessionPosture = deriveConcessionPosture(
    confidence,
    netDriverBias,
    hasStrongLiability,
    hasTreatmentGaps
  );

  // ── Representation Posture ───────────────────────────
  const representationPosture = deriveRepresentationPosture(vm);

  // ── Position Calculations ────────────────────────────
  const openingOffer = deriveOpeningOffer(floor, likely, stretch, concessionPosture.generated, hasStrongLiability, confidence);
  const authorityCeiling = deriveAuthorityCeiling(floor, likely, stretch, authority, confidence);
  const targetZone = deriveTargetZone(floor, likely, stretch, concessionPosture.generated);
  const walkAway = deriveWalkAway(floor, likely, concessionPosture.generated, significantReduction);

  // ── Movement Plan ────────────────────────────────────
  const movementPlan = deriveMovementPlan(floor, likely, stretch, concessionPosture.generated);

  // ── Tactical ─────────────────────────────────────────
  const tacticalRecommendations = deriveTactical(
    floor, likely, stretch,
    hasStrongLiability, hasVenueRisk, hasCausationIssues,
    hasCredibilityIssues, significantReduction, confidence,
    vm.representation.status
  );

  // ── Rationale ────────────────────────────────────────
  const keyDrivers = [
    ...vm.expanders.slice(0, 3).map((d) => d.key),
    ...vm.reducers.slice(0, 3).map((d) => d.key),
  ];

  const rationaleSummary = buildRationale(vm, concessionPosture.generated, representationPosture.generated, confidence);

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    evalPackageVersion: vm.provenance.packageVersion,

    openingOffer,
    authorityCeiling,
    targetSettlementZone: targetZone,
    walkAwayThreshold: walkAway,

    concessionPosture,
    movementPlan,
    tacticalRecommendations,
    representationPosture,

    keyDrivers,
    rationaleSummary,
  };
}

// ─── Representation Posture Selection ─────────────────────

function deriveRepresentationPosture(vm: NegotiationViewModel): StrategyRecommendation<RepresentationPosture> {
  const rep = vm.representation;

  // Post-retention reset: claimant was unrepresented, now has attorney
  if (rep.transitioned && rep.status === "represented") {
    return {
      generated: "post_retention_strategy_reset",
      reason: "Claimant retained counsel during the negotiation. Strategy reset to account for changed negotiation dynamics. Fact-based case value remains unchanged.",
    };
  }

  // Transitioned away from representation
  if (rep.transitioned && rep.status === "unrepresented") {
    return {
      generated: "direct_resolution_unrepresented",
      reason: "Attorney withdrew. Switching to direct-resolution workflow with plain-language communications. Fact-based case value remains unchanged.",
    };
  }

  // Currently unrepresented
  if (rep.status === "unrepresented") {
    // High retention risk
    if (rep.retentionRisk >= 70) {
      return {
        generated: "counsel_retention_risk",
        reason: "Claimant is unrepresented with high attorney-retention risk. Timely resolution is recommended to avoid delay-driven retention. The case value assessment is not affected by representation status.",
      };
    }

    // Low-complexity direct resolution
    if ((vm.valuationRange.confidence ?? 0) >= 0.6 && vm.risks.length <= 1) {
      return {
        generated: "early_resolution_unrepresented",
        reason: "Unrepresented claimant with straightforward claim profile. Early resolution through clear, direct communication is appropriate. Value is based on the same fact-based assessment used for represented claimants.",
      };
    }

    // Needs documentation guidance
    if (vm.risks.some(r => r.category === "gap" || r.category === "treatment")) {
      return {
        generated: "documentation_guided_unrepresented",
        reason: "Unrepresented claimant with documentation gaps. Proactive guidance on needed records can facilitate fair resolution. Value is based on documented facts, not representation status.",
      };
    }

    return {
      generated: "direct_resolution_unrepresented",
      reason: "Claimant is unrepresented. Using direct-resolution workflow with clear, accessible language. Fact-based case value is unaffected by representation status.",
    };
  }

  // Represented
  if (rep.status === "represented") {
    // Defensive posture for litigation-prone profile
    if (vm.risks.length >= 3 || (vm.valuationRange.confidence ?? 0) < 0.4) {
      return {
        generated: "represented_defensive",
        reason: "Represented claimant with multiple risk factors. Defensive posture with tighter concession management is appropriate.",
      };
    }

    // Litigation prep indicator
    if (vm.risks.some(r => r.category === "liability") && vm.reducers.length >= 2) {
      return {
        generated: "litigation_prep",
        reason: "Represented claimant with significant liability risk and multiple reducers. Litigation preparation posture may be warranted.",
      };
    }

    return {
      generated: "represented_balanced",
      reason: "Represented claimant with balanced claim profile. Standard attorney-facing negotiation approach.",
    };
  }

  // Unknown — default
  return {
    generated: "represented_balanced",
    reason: "Representation status unknown. Defaulting to balanced posture.",
  };
}

// ─── Derivation Functions ──────────────────────────────────

function deriveConcessionPosture(
  confidence: number,
  netDriverBias: number,
  strongLiability: boolean,
  treatmentGaps: boolean
): StrategyRecommendation<ConcessionPosture> {
  let posture: ConcessionPosture = "standard";
  const reasons: string[] = [];

  if (confidence >= 0.7 && netDriverBias >= 2 && strongLiability) {
    posture = "conservative";
    reasons.push("High confidence with strong liability and multiple value expanders");
  } else if (confidence < 0.4 || netDriverBias <= -2 || treatmentGaps) {
    posture = "flexible";
    if (confidence < 0.4) reasons.push("Low valuation confidence");
    if (netDriverBias <= -2) reasons.push("Multiple value reducers present");
    if (treatmentGaps) reasons.push("Treatment gaps or compliance concerns");
  } else {
    reasons.push("Balanced driver profile with moderate confidence");
  }

  return { generated: posture, reason: reasons.join(". ") || "Standard negotiation posture." };
}

function deriveOpeningOffer(
  floor: number,
  likely: number,
  stretch: number,
  posture: ConcessionPosture,
  strongLiability: boolean,
  confidence: number
): StrategyRecommendation {
  const pctMap: Record<ConcessionPosture, number> = {
    conservative: 0.55,
    standard: 0.65,
    flexible: 0.75,
  };
  let opening = Math.round(floor * pctMap[posture]);
  const reasons: string[] = [];

  if (posture === "conservative") {
    reasons.push("Conservative opening anchors low given strong position");
  } else if (posture === "flexible") {
    reasons.push("Higher opening reflects need for credible engagement");
  } else {
    reasons.push("Standard opening at ~65% of evaluated floor");
  }

  if (!strongLiability) {
    opening = Math.round(opening * 0.9);
    reasons.push("Adjusted down for liability concerns");
  }

  return { generated: Math.max(opening, 0), reason: reasons.join(". ") + "." };
}

function deriveAuthorityCeiling(
  floor: number,
  likely: number,
  stretch: number,
  authority: number | null,
  confidence: number
): StrategyRecommendation {
  if (authority != null && authority > 0) {
    return {
      generated: authority,
      reason: "Based on authority recommendation set during evaluation.",
    };
  }

  const ceiling = Math.round(likely + (stretch - likely) * 0.3);
  return {
    generated: ceiling,
    reason: `Derived from evaluated likely value plus 30% of the likely-to-stretch spread. Confidence: ${Math.round(confidence * 100)}%.`,
  };
}

function deriveTargetZone(
  floor: number,
  likely: number,
  stretch: number,
  posture: ConcessionPosture
): StrategyRecommendation<{ low: number; high: number }> {
  const spreadMap: Record<ConcessionPosture, { lowPct: number; highPct: number }> = {
    conservative: { lowPct: 0.7, highPct: 0.9 },
    standard: { lowPct: 0.75, highPct: 0.95 },
    flexible: { lowPct: 0.8, highPct: 1.0 },
  };
  const s = spreadMap[posture];
  const low = Math.round(floor + (likely - floor) * s.lowPct);
  const high = Math.round(floor + (likely - floor) * s.highPct);

  return {
    generated: { low, high },
    reason: `Target zone spans ${Math.round(s.lowPct * 100)}–${Math.round(s.highPct * 100)}% of the floor-to-likely range under ${posture} posture.`,
  };
}

function deriveWalkAway(
  floor: number,
  likely: number,
  posture: ConcessionPosture,
  significantReduction: boolean
): StrategyRecommendation {
  const pctMap: Record<ConcessionPosture, number> = {
    conservative: 0.85,
    standard: 0.9,
    flexible: 0.95,
  };
  let walkAway = Math.round(floor * pctMap[posture]);
  const reasons: string[] = [`Walk-away at ${Math.round(pctMap[posture] * 100)}% of evaluated floor under ${posture} posture`];

  if (significantReduction) {
    walkAway = Math.round(walkAway * 0.95);
    reasons.push("Further reduced due to significant medical review reductions (>25%)");
  }

  return { generated: Math.max(walkAway, 0), reason: reasons.join(". ") + "." };
}

function deriveMovementPlan(
  floor: number,
  likely: number,
  stretch: number,
  posture: ConcessionPosture
): MovementPlan {
  const range = likely - floor;
  const moveMultiplier: Record<ConcessionPosture, { first: number; mid: number; end: number }> = {
    conservative: { first: 0.15, mid: 0.08, end: 0.03 },
    standard: { first: 0.20, mid: 0.12, end: 0.05 },
    flexible: { first: 0.25, mid: 0.15, end: 0.08 },
  };
  const m = moveMultiplier[posture];

  return {
    firstMove: {
      generated: Math.round(range * m.first),
      reason: `First concession of ~${Math.round(m.first * 100)}% of floor-to-likely range signals willingness to engage.`,
    },
    midRoundMove: {
      generated: Math.round(range * m.mid),
      reason: `Mid-round decrements of ~${Math.round(m.mid * 100)}% maintain momentum without conceding too rapidly.`,
    },
    endgameMove: {
      generated: Math.round(range * m.end),
      reason: `Endgame moves narrow to ~${Math.round(m.end * 100)}% signaling approaching final position.`,
    },
  };
}

function deriveTactical(
  floor: number, likely: number, stretch: number,
  strongLiability: boolean, venueRisk: boolean, causationIssues: boolean,
  credibilityIssues: boolean, significantReduction: boolean, confidence: number,
  representationStatus: "represented" | "unrepresented" | "unknown"
): TacticalRecommendation[] {
  const recs: TacticalRecommendation[] = [];

  // Bracket
  const bracketUseful = stretch > likely * 1.15;
  recs.push({
    type: "bracket",
    recommended: bracketUseful && representationStatus !== "unrepresented",
    reason: representationStatus === "unrepresented"
      ? "Bracket strategy is not recommended for unrepresented claimants. Direct, clear communication is more appropriate and avoids confusion."
      : bracketUseful
        ? "Stretch value is significantly above likely. A bracket offer may anchor the claimant within a more favorable range."
        : "Stretch-to-likely spread is narrow. Bracketing is unlikely to yield significant advantage.",
  });

  // Hold
  const holdStrong = strongLiability && !venueRisk && confidence >= 0.6;
  recs.push({
    type: "hold",
    recommended: holdStrong,
    reason: holdStrong
      ? "Strong liability posture and moderate-to-high confidence support holding position during early rounds."
      : "Position is not strong enough to justify a hold strategy without risking impasse.",
  });

  // Request support
  const needsSupport = (causationIssues && credibilityIssues) || significantReduction || confidence < 0.4;
  recs.push({
    type: "request_support",
    recommended: needsSupport,
    reason: needsSupport
      ? "Multiple risk factors present. Consider requesting additional documentation or expert support before further movement."
      : "Current evidence basis is adequate. No immediate support request needed.",
  });

  return recs;
}

function buildRationale(
  vm: NegotiationViewModel,
  posture: ConcessionPosture,
  repPosture: RepresentationPosture,
  confidence: number
): string {
  const parts: string[] = [];

  parts.push(`Strategy generated from EvaluatePackage v${vm.provenance.packageVersion} (engine ${vm.provenance.engineVersion}).`);
  parts.push(`Concession posture set to "${posture}" based on ${Math.round(confidence * 100)}% valuation confidence.`);
  parts.push(`Representation posture: "${repPosture}".`);

  // Core compliance statement
  parts.push("Representation status did not directly reduce fact-based case value.");

  if (vm.representation.status === "unrepresented") {
    parts.push("Communications will use plain, accessible language appropriate for direct claimant interaction.");
  }
  if (vm.representation.transitioned) {
    parts.push("Representation changed during this claim. Strategy has been adapted to current representation context.");
  }
  if (vm.representation.retentionRisk >= 70 && vm.representation.status === "unrepresented") {
    parts.push("High attorney-retention risk identified. Timely resolution is recommended.");
  }

  if (vm.expanders.length > 0) {
    parts.push(`Value supported by: ${vm.expanders.slice(0, 3).map((e) => e.label).join(", ")}.`);
  }
  if (vm.reducers.length > 0) {
    parts.push(`Value constrained by: ${vm.reducers.slice(0, 3).map((r) => r.label).join(", ")}.`);
  }
  if (vm.risks.length > 0) {
    parts.push(`${vm.risks.length} notable risk(s) identified including ${vm.risks.slice(0, 2).map((r) => r.label).join(", ")}.`);
  }
  if (vm.specials.reductionPercent != null && vm.specials.reductionPercent > 0) {
    parts.push(`Medical specials reduced ${vm.specials.reductionPercent}% from billed to reviewed.`);
  }

  return parts.join(" ");
}
