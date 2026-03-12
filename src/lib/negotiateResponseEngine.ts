/**
 * NegotiateIQ — Response Recommendation Engine v1
 *
 * After each counteroffer, generates ranked next-action recommendations
 * based on active strategy, valuation range, round history, risk profile,
 * and authority remaining.
 */

import type { NegotiationRoundRow } from "@/types/negotiate-persistence";
import type { GeneratedStrategy, ConcessionPosture } from "@/types/negotiate-strategy";
import type { NegotiationViewModel, NegotiateRisk } from "@/lib/negotiateViewModel";
import { computeCounterofferDeltas, type CounterofferDeltas } from "@/lib/negotiateDeltaEngine";

// ─── Types ──────────────────────────────────────────────

export type ResponseActionType =
  | "hold"
  | "small_move"
  | "standard_move"
  | "aggressive_move"
  | "bracket"
  | "request_support"
  | "request_authority_review"
  | "recommend_settlement"
  | "recommend_impasse";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface ResponseWarning {
  code: string;
  message: string;
  severity: "info" | "caution" | "critical";
}

export interface ResponseRecommendation {
  action: ResponseActionType;
  /** Proposed next offer amount, if applicable */
  proposedOffer: number | null;
  /** Recommended movement amount */
  movementAmount: number | null;
  /** Movement as percentage of last offer */
  movementPct: number | null;
  /** Short one-line explanation */
  shortExplanation: string;
  /** Longer claim-note rationale */
  rationale: string;
  /** Engine confidence in this recommendation */
  confidence: ConfidenceLevel;
  /** Warning flags */
  warnings: ResponseWarning[];
  /** Rank (1 = top recommendation) */
  rank: number;
}

export interface NegotiationPostureZone =
  | "within_target"
  | "above_likely_moving"
  | "outside_not_moving"
  | "near_ceiling"
  | "beyond_ceiling"
  | "endgame_behavior";

export interface ResponseEngineOutput {
  engineVersion: string;
  generatedAt: string;
  /** The detected negotiation posture zone */
  postureZone: NegotiationPostureZone;
  postureZoneReason: string;
  /** All recommendations ranked by suitability */
  recommendations: ResponseRecommendation[];
  /** Deltas used as input */
  deltas: CounterofferDeltas;
}

// ─── Engine ─────────────────────────────────────────────

const ENGINE_VERSION = "1.0.0";

export function generateResponseRecommendations({
  strategy,
  vm,
  rounds,
  currentCeiling,
  openingDemand,
  latestCounteroffer,
  lastDefenseOffer,
}: {
  strategy: GeneratedStrategy;
  vm: NegotiationViewModel;
  rounds: NegotiationRoundRow[];
  currentCeiling: number | null;
  openingDemand: number | null;
  latestCounteroffer: number;
  lastDefenseOffer: number | null;
}): ResponseEngineOutput {
  const deltas = computeCounterofferDeltas({
    counterofferAmount: latestCounteroffer,
    lastDefenseOffer,
    openingDemand,
    strategy,
    currentCeiling,
    rounds,
  });

  const postureZone = classifyPostureZone(deltas, strategy, rounds, latestCounteroffer);
  const recs = scoreAndRank(strategy, vm, rounds, deltas, postureZone, lastDefenseOffer, currentCeiling);

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    postureZone: postureZone.zone,
    postureZoneReason: postureZone.reason,
    recommendations: recs,
    deltas,
  };
}

// ─── Posture Zone Classification ────────────────────────

interface PostureResult {
  zone: NegotiationPostureZone;
  reason: string;
}

function classifyPostureZone(
  deltas: CounterofferDeltas,
  strategy: GeneratedStrategy,
  rounds: NegotiationRoundRow[],
  latestCounteroffer: number
): PostureResult {
  const ceiling = strategy.authorityCeiling.generated;
  const targetHigh = strategy.targetSettlementZone.generated.high;
  const targetLow = strategy.targetSettlementZone.generated.low;

  // Beyond ceiling
  if (deltas.isAboveCeiling) {
    return { zone: "beyond_ceiling", reason: `Counteroffer of ${fmt(latestCounteroffer)} exceeds authority ceiling of ${fmt(ceiling)}.` };
  }

  // Near ceiling (within 10%)
  if (deltas.deltaFromCeiling != null && Math.abs(deltas.deltaFromCeiling) <= ceiling * 0.1) {
    return { zone: "near_ceiling", reason: `Counteroffer is within 10% of authority ceiling.` };
  }

  // Within target zone
  if (deltas.isWithinTargetZone) {
    return { zone: "within_target", reason: `Counteroffer falls within the target settlement zone (${fmt(targetLow)}–${fmt(targetHigh)}).` };
  }

  // Endgame behavior: small decrements in last 2+ rounds
  if (rounds.length >= 3) {
    const lastThree = rounds.slice(-3);
    const counters = lastThree.map((r) => r.their_counteroffer).filter((c): c is number => c != null);
    if (counters.length >= 2) {
      const drops = counters.slice(1).map((c, i) => counters[i] - c);
      const avgDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
      const smallMoveThreshold = strategy.movementPlan.endgameMove.generated * 1.5;
      if (avgDrop > 0 && avgDrop <= smallMoveThreshold) {
        return { zone: "endgame_behavior", reason: `Claimant's recent concessions average ${fmt(avgDrop)}, suggesting endgame positioning.` };
      }
    }
  }

  // Above likely but moving
  if (deltas.movementPace === "faster" || deltas.movementPace === "on_track") {
    return { zone: "above_likely_moving", reason: `Counteroffer is above target zone but claimant is making credible movement.` };
  }

  // Outside and not moving credibly
  return { zone: "outside_not_moving", reason: `Counteroffer remains well above target zone with insufficient movement.` };
}

// ─── Recommendation Scoring ─────────────────────────────

function scoreAndRank(
  strategy: GeneratedStrategy,
  vm: NegotiationViewModel,
  rounds: NegotiationRoundRow[],
  deltas: CounterofferDeltas,
  posture: PostureResult,
  lastDefenseOffer: number | null,
  currentCeiling: number | null,
): ResponseRecommendation[] {
  const allRecs: ResponseRecommendation[] = [];
  const base = lastDefenseOffer ?? strategy.openingOffer.generated;
  const postureName = strategy.concessionPosture.generated;
  const ceiling = currentCeiling ?? strategy.authorityCeiling.generated;
  const roundCount = rounds.length;

  const movePhase = roundCount <= 1 ? "first" : roundCount <= 3 ? "mid" : "endgame";
  const plannedMove = movePhase === "first"
    ? strategy.movementPlan.firstMove.generated
    : movePhase === "mid"
      ? strategy.movementPlan.midRoundMove.generated
      : strategy.movementPlan.endgameMove.generated;

  // Helper to create rec
  const rec = (
    action: ResponseActionType,
    offer: number | null,
    move: number | null,
    short: string,
    rationale: string,
    confidence: ConfidenceLevel,
    warnings: ResponseWarning[] = []
  ): ResponseRecommendation => {
    const movePct = (move != null && base > 0) ? Math.round((move / base) * 100) : null;
    // Check if proposed offer exceeds ceiling
    if (offer != null && offer > ceiling) {
      warnings.push({
        code: "EXCEEDS_CEILING",
        message: `Proposed offer of ${fmt(offer)} exceeds authority ceiling of ${fmt(ceiling)}.`,
        severity: "critical",
      });
    }
    // Check if proposed offer exceeds planned movement
    if (move != null && move > plannedMove * 1.5) {
      warnings.push({
        code: "EXCEEDS_PLAN",
        message: `Movement of ${fmt(move)} exceeds planned ${movePhase}-round move of ${fmt(plannedMove)} by >50%.`,
        severity: "caution",
      });
    }
    return { action, proposedOffer: offer, movementAmount: move, movementPct: movePct, shortExplanation: short, rationale, confidence, warnings, rank: 0 };
  };

  // ── Generate candidates by zone ───────────────────────

  const hasLiabilityRisk = vm.risks.some((r) => r.category === "liability");
  const hasCausation = vm.risks.some((r) => r.category === "causation");
  const hasCredibility = vm.risks.some((r) => r.category === "credibility");
  const lowConfidence = (vm.valuationRange.confidence ?? 0.5) < 0.4;

  switch (posture.zone) {
    case "within_target": {
      const settleOffer = Math.round((strategy.targetSettlementZone.generated.low + strategy.targetSettlementZone.generated.high) / 2);
      allRecs.push(rec(
        "recommend_settlement", clamp(settleOffer, base, ceiling), settleOffer - base,
        "Counteroffer is within target zone — settlement recommended.",
        `The claimant's current position falls within the evaluated target settlement zone. Given the ${postureName} posture and ${roundCount} round(s) of negotiation, this represents a favorable resolution point that aligns with the evaluated range. Recommend presenting a final offer near the target zone midpoint.`,
        "high"
      ));
      allRecs.push(rec(
        "small_move", clamp(base + Math.round(plannedMove * 0.5), base, ceiling), Math.round(plannedMove * 0.5),
        "Small move to signal final positioning.",
        `A reduced concession signals approaching final position while maintaining slight flexibility. This preserves negotiating room while acknowledging the favorable gap.`,
        "medium"
      ));
      allRecs.push(rec(
        "hold", base, 0,
        "Hold current position — let claimant close remaining gap.",
        `With the counteroffer already within target zone, holding firm may prompt the claimant to make the final concession. This is appropriate if authority is limited or if the current offer is already at a fair point.`,
        "medium"
      ));
      break;
    }

    case "above_likely_moving": {
      const standardOffer = clamp(base + plannedMove, base, ceiling);
      allRecs.push(rec(
        "standard_move", standardOffer, plannedMove,
        `Standard ${movePhase}-round move to maintain momentum.`,
        `The claimant is making credible movement, though still above the target zone. A standard concession of ${fmt(plannedMove)} maintains reciprocal engagement and signals willingness to negotiate in good faith. This keeps the negotiation on the planned ${postureName} trajectory.`,
        "high"
      ));
      const smallMove = Math.round(plannedMove * 0.6);
      allRecs.push(rec(
        "small_move", clamp(base + smallMove, base, ceiling), smallMove,
        "Reduced move to slow momentum and test claimant's resolve.",
        `A below-plan move tests whether the claimant will continue making concessions. Appropriate when their movement, while positive, hasn't been substantial enough to warrant full reciprocity.`,
        "medium"
      ));
      if (strategy.tacticalRecommendations.find((t) => t.type === "bracket" && t.recommended)) {
        const bracketTarget = clamp(Math.round((base + strategy.targetSettlementZone.generated.high) / 2), base, ceiling);
        allRecs.push(rec(
          "bracket", bracketTarget, bracketTarget - base,
          "Bracket response to anchor claimant toward target zone.",
          `A bracket offer reframes the negotiation range by establishing a new anchor. Effective when the claimant is moving but anchored above the evaluated range.`,
          "medium"
        ));
      }
      break;
    }

    case "outside_not_moving": {
      allRecs.push(rec(
        "hold", base, 0,
        "Hold position — claimant's movement is insufficient.",
        `The counteroffer remains well above the target zone and the claimant is not demonstrating credible movement. Holding communicates that further concessions from the defense require reciprocal engagement. ${hasLiabilityRisk ? "Liability concerns further support a firm posture." : ""}`,
        "high"
      ));
      if (hasCausation || hasCredibility || lowConfidence) {
        allRecs.push(rec(
          "request_support", null, null,
          "Request additional documentation or expert review before moving.",
          `Multiple risk factors (${[hasCausation && "causation concerns", hasCredibility && "credibility issues", lowConfidence && "low valuation confidence"].filter(Boolean).join(", ")}) suggest strengthening the defense position before further concessions.`,
          "medium"
        ));
      }
      const smallMove = Math.round(plannedMove * 0.3);
      allRecs.push(rec(
        "small_move", clamp(base + smallMove, base, ceiling), smallMove,
        "Token move to avoid impasse while signaling dissatisfaction.",
        `A minimal concession keeps the negotiation alive without signaling willingness to move substantially. This is a tactical choice to prevent an impasse declaration while maintaining a strong posture.`,
        "low"
      ));
      allRecs.push(rec(
        "recommend_impasse", null, null,
        "Consider impasse posture if claimant continues without credible movement.",
        `If the claimant's next response does not show meaningful movement, transitioning to a formal impasse posture may be appropriate. This signals that the defense has reached its position and further negotiation requires substantive engagement.`,
        "low"
      ));
      break;
    }

    case "near_ceiling": {
      allRecs.push(rec(
        "request_authority_review", null, null,
        "Near authority ceiling — request authority review before further movement.",
        `The counteroffer is within 10% of the current authority ceiling. Any further movement risks exceeding approved authority. Recommend pausing to reassess authority or obtain additional approval before the next response.`,
        "high",
        [{ code: "NEAR_CEILING", message: `Current counteroffer is near the ${fmt(ceiling)} ceiling.`, severity: "caution" }]
      ));
      const endgameMove = Math.round(strategy.movementPlan.endgameMove.generated * 0.5);
      allRecs.push(rec(
        "small_move", clamp(base + endgameMove, base, ceiling), endgameMove,
        "Minimal move signaling final position.",
        `A very small concession communicates that the defense is at or near its final position. This is appropriate only if the current offer is close to the target zone and additional authority is not forthcoming.`,
        "medium",
        [{ code: "NEAR_CEILING", message: `Limited room remaining before ceiling.`, severity: "caution" }]
      ));
      allRecs.push(rec(
        "recommend_settlement", clamp(Math.round(ceiling * 0.95), base, ceiling), Math.round(ceiling * 0.95) - base,
        "Present near-ceiling offer as final settlement position.",
        `With limited authority remaining, presenting a near-final offer may close the negotiation. This is appropriate when the gap is small and the claimant appears ready to settle.`,
        "medium"
      ));
      break;
    }

    case "beyond_ceiling": {
      allRecs.push(rec(
        "request_authority_review", null, null,
        "Counteroffer exceeds authority — authority review required.",
        `The claimant's counteroffer exceeds the approved authority ceiling of ${fmt(ceiling)}. No further movement should be made without obtaining additional authority. Recommend escalating for authority review and communicating the timeline to claimant counsel.`,
        "high",
        [{ code: "BEYOND_CEILING", message: `Counteroffer exceeds authority ceiling by ${fmt(Math.abs(deltas.deltaFromCeiling ?? 0))}.`, severity: "critical" }]
      ));
      allRecs.push(rec(
        "hold", base, 0,
        "Hold current position pending authority review.",
        `Maintain the current offer while authority review is underway. Communicate to claimant counsel that the defense is evaluating its position and will respond within a reasonable timeframe.`,
        "high"
      ));
      allRecs.push(rec(
        "recommend_impasse", null, null,
        "Declare impasse if authority increase is not available.",
        `If additional authority cannot be obtained and the gap remains substantial, a formal impasse posture may be the appropriate next step.`,
        "low"
      ));
      break;
    }

    case "endgame_behavior": {
      const endgameMove = strategy.movementPlan.endgameMove.generated;
      allRecs.push(rec(
        "small_move", clamp(base + endgameMove, base, ceiling), endgameMove,
        "Match endgame pace with planned final-phase move.",
        `Claimant movement has slowed to endgame levels, suggesting they are approaching their floor. A reciprocal endgame concession maintains momentum toward settlement. The planned endgame increment of ${fmt(endgameMove)} is appropriate.`,
        "high"
      ));
      const settleTarget = strategy.targetSettlementZone.generated.high;
      if (deltas.distanceToSettlementZone != null && Math.abs(deltas.distanceToSettlementZone) <= settleTarget * 0.05) {
        allRecs.push(rec(
          "recommend_settlement", clamp(settleTarget, base, ceiling), settleTarget - base,
          "Gap is minimal — recommend closing at target zone ceiling.",
          `With both parties showing endgame behavior and a small remaining gap, presenting a final settlement offer at the top of the target zone is likely to close the negotiation efficiently.`,
          "high"
        ));
      }
      allRecs.push(rec(
        "hold", base, 0,
        "Hold to test if claimant will close remaining gap.",
        `In endgame, holding can prompt the final concession from the claimant. This carries some impasse risk but may yield a better outcome.`,
        "medium"
      ));
      break;
    }
  }

  // Sort by confidence then specificity
  const confScore: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };
  allRecs.sort((a, b) => confScore[b.confidence] - confScore[a.confidence]);
  allRecs.forEach((r, i) => { r.rank = i + 1; });

  return allRecs;
}

// ─── Helpers ────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function fmt(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
