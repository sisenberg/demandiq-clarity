/**
 * NegotiateIQ — Delta Computation Engine
 *
 * Computes movement metrics for counteroffers relative to
 * defense offers, target zone, ceiling, and movement plan.
 */

import type { NegotiationRoundRow } from "@/types/negotiate-persistence";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";

export interface CounterofferDeltas {
  /** Delta from last defense offer (positive = above our offer) */
  deltaFromLastOffer: number | null;
  deltaFromLastOfferPct: number | null;

  /** Delta from opening demand if known */
  deltaFromOpeningDemand: number | null;
  deltaFromOpeningDemandPct: number | null;

  /** Distance to evaluated target zone */
  distanceToTargetLow: number | null;
  distanceToTargetHigh: number | null;
  isWithinTargetZone: boolean | null;

  /** Delta from current authority ceiling */
  deltaFromCeiling: number | null;
  isAboveCeiling: boolean | null;

  /** Distance to recommended settlement zone */
  distanceToSettlementZone: number | null;

  /** Movement pace assessment */
  movementPace: "faster" | "on_track" | "slower" | "unknown";
  movementPaceReason: string;
}

export interface RoundMovementMetrics {
  roundNumber: number;
  ourOffer: number | null;
  theirCounter: number | null;
  ourMovementPct: number | null;
  theirMovementPct: number | null;
  gap: number | null;
  gapReductionPct: number | null;
}

export function computeCounterofferDeltas({
  counterofferAmount,
  lastDefenseOffer,
  openingDemand,
  strategy,
  currentCeiling,
  rounds,
}: {
  counterofferAmount: number;
  lastDefenseOffer: number | null;
  openingDemand: number | null;
  strategy: GeneratedStrategy | null;
  currentCeiling: number | null;
  rounds: NegotiationRoundRow[];
}): CounterofferDeltas {
  // Delta from last defense offer
  const deltaFromLastOffer = lastDefenseOffer != null ? counterofferAmount - lastDefenseOffer : null;
  const deltaFromLastOfferPct =
    lastDefenseOffer != null && lastDefenseOffer > 0
      ? Math.round((deltaFromLastOffer! / lastDefenseOffer) * 100)
      : null;

  // Delta from opening demand
  const deltaFromOpeningDemand = openingDemand != null ? counterofferAmount - openingDemand : null;
  const deltaFromOpeningDemandPct =
    openingDemand != null && openingDemand > 0
      ? Math.round((deltaFromOpeningDemand! / openingDemand) * 100)
      : null;

  // Target zone
  const targetLow = strategy?.targetSettlementZone.generated.low ?? null;
  const targetHigh = strategy?.targetSettlementZone.generated.high ?? null;
  const distanceToTargetLow = targetLow != null ? counterofferAmount - targetLow : null;
  const distanceToTargetHigh = targetHigh != null ? counterofferAmount - targetHigh : null;
  const isWithinTargetZone =
    targetLow != null && targetHigh != null
      ? counterofferAmount >= targetLow && counterofferAmount <= targetHigh
      : null;

  // Ceiling
  const ceiling = currentCeiling ?? strategy?.authorityCeiling.generated ?? null;
  const deltaFromCeiling = ceiling != null ? counterofferAmount - ceiling : null;
  const isAboveCeiling = ceiling != null ? counterofferAmount > ceiling : null;

  // Settlement zone distance (use target zone midpoint)
  const distanceToSettlementZone =
    targetLow != null && targetHigh != null
      ? counterofferAmount - Math.round((targetLow + targetHigh) / 2)
      : null;

  // Movement pace
  const { movementPace, movementPaceReason } = assessMovementPace(
    counterofferAmount,
    rounds,
    strategy
  );

  return {
    deltaFromLastOffer,
    deltaFromLastOfferPct,
    deltaFromOpeningDemand,
    deltaFromOpeningDemandPct,
    distanceToTargetLow,
    distanceToTargetHigh,
    isWithinTargetZone,
    deltaFromCeiling,
    isAboveCeiling,
    distanceToSettlementZone,
    movementPace,
    movementPaceReason,
  };
}

function assessMovementPace(
  counterofferAmount: number,
  rounds: NegotiationRoundRow[],
  strategy: GeneratedStrategy | null
): { movementPace: CounterofferDeltas["movementPace"]; movementPaceReason: string } {
  if (!strategy || rounds.length < 2) {
    return { movementPace: "unknown", movementPaceReason: "Insufficient rounds to assess pace." };
  }

  // Compare their movement to expected mid-round concession
  const lastTwo = rounds.slice(-2);
  const prevCounter = lastTwo[0].their_counteroffer;
  const currCounter = lastTwo[1]?.their_counteroffer ?? counterofferAmount;

  if (prevCounter == null || currCounter == null) {
    return { movementPace: "unknown", movementPaceReason: "Missing counteroffer data for pace assessment." };
  }

  const theirDrop = prevCounter - currCounter;
  const expectedDrop = strategy.movementPlan.midRoundMove.generated;

  if (theirDrop > expectedDrop * 1.3) {
    return {
      movementPace: "faster",
      movementPaceReason: `Claimant dropped ${fmtCurrency(theirDrop)} — faster than planned mid-round pace of ${fmtCurrency(expectedDrop)}.`,
    };
  } else if (theirDrop < expectedDrop * 0.7) {
    return {
      movementPace: "slower",
      movementPaceReason: `Claimant dropped ${fmtCurrency(theirDrop)} — slower than planned mid-round pace of ${fmtCurrency(expectedDrop)}.`,
    };
  }
  return {
    movementPace: "on_track",
    movementPaceReason: `Movement of ${fmtCurrency(theirDrop)} is within expected mid-round range.`,
  };
}

export function computeRoundMetrics(rounds: NegotiationRoundRow[]): RoundMovementMetrics[] {
  return rounds.map((round, i) => {
    const prev = i > 0 ? rounds[i - 1] : null;

    const ourOffer = round.our_offer;
    const theirCounter = round.their_counteroffer;

    let ourMovementPct: number | null = null;
    if (prev?.our_offer != null && ourOffer != null && prev.our_offer > 0) {
      ourMovementPct = Math.round(((ourOffer - prev.our_offer) / prev.our_offer) * 100);
    }

    let theirMovementPct: number | null = null;
    if (prev?.their_counteroffer != null && theirCounter != null && prev.their_counteroffer > 0) {
      theirMovementPct = Math.round(
        ((prev.their_counteroffer - theirCounter) / prev.their_counteroffer) * 100
      );
    }

    const gap = ourOffer != null && theirCounter != null ? theirCounter - ourOffer : null;
    let gapReductionPct: number | null = null;
    if (prev) {
      const prevGap =
        prev.our_offer != null && prev.their_counteroffer != null
          ? prev.their_counteroffer - prev.our_offer
          : null;
      if (prevGap != null && prevGap > 0 && gap != null) {
        gapReductionPct = Math.round(((prevGap - gap) / prevGap) * 100);
      }
    }

    return {
      roundNumber: round.round_number,
      ourOffer,
      theirCounter,
      ourMovementPct,
      theirMovementPct,
      gap,
      gapReductionPct,
    };
  });
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}
