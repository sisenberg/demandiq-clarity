/**
 * NegotiateIQ — Closed-Claim Calibration Engine
 *
 * Produces advisory signals from historical_claims data.
 * Transparent, heuristic, honest about sparse data.
 * This is an overlay — not a replacement for EvaluatePackage.
 */

// ─── Types ──────────────────────────────────────────────

export interface CalibrationQuery {
  jurisdictionState: string;
  injuryCategories: string[];
  bodyParts: string[];
  hasSurgery: boolean;
  hasInjections: boolean;
  attorneyName: string | null;
  attorneyFirm: string | null;
  liabilityPosture: string;
  totalBilled: number;
  totalReviewed: number | null;
  evalFloor: number | null;
  evalLikely: number | null;
  evalStretch: number | null;
  currentCounteroffer: number | null;
}

export type SignalConfidence = "high" | "moderate" | "low" | "insufficient";

export interface CalibrationSignal {
  key: string;
  label: string;
  description: string;
  value: string;
  confidence: SignalConfidence;
  sampleSize: number;
  basis: string;
}

export interface CalibrationResult {
  signals: CalibrationSignal[];
  totalMatchedClaims: number;
  matchCriteria: string[];
  sparseWarnings: string[];
}

// ─── Historical Claim Shape (from DB) ───────────────────

export interface HistoricalClaimForCalibration {
  final_settlement_amount: number | null;
  billed_specials: number | null;
  reviewed_specials: number | null;
  attorney_name: string;
  attorney_firm: string;
  jurisdiction: string;
  venue_state: string;
  injury_categories: string[];
  primary_body_parts: string[];
  has_surgery: boolean;
  has_injections: boolean;
  has_permanency: boolean;
  liability_posture: string;
  treatment_duration_days: number | null;
}

// ─── Confidence Thresholds ──────────────────────────────

const HIGH_THRESHOLD = 20;
const MODERATE_THRESHOLD = 8;
const LOW_THRESHOLD = 3;

function deriveConfidence(n: number): SignalConfidence {
  if (n >= HIGH_THRESHOLD) return "high";
  if (n >= MODERATE_THRESHOLD) return "moderate";
  if (n >= LOW_THRESHOLD) return "low";
  return "insufficient";
}

// ─── Engine ─────────────────────────────────────────────

export function computeCalibrationSignals(
  query: CalibrationQuery,
  claims: HistoricalClaimForCalibration[]
): CalibrationResult {
  const signals: CalibrationSignal[] = [];
  const sparseWarnings: string[] = [];
  const matchCriteria: string[] = [];

  // Filter to settled claims only
  const settled = claims.filter((c) => c.final_settlement_amount != null && c.final_settlement_amount > 0);

  if (settled.length === 0) {
    sparseWarnings.push("No closed claims with settlement data found in the calibration corpus.");
    return { signals, totalMatchedClaims: 0, matchCriteria, sparseWarnings };
  }

  // ── 1. Jurisdiction match ─────────────────────────────
  const jurisdictionMatches = settled.filter(
    (c) => c.venue_state.toLowerCase() === query.jurisdictionState.toLowerCase()
  );
  if (jurisdictionMatches.length > 0) {
    matchCriteria.push(`jurisdiction: ${query.jurisdictionState}`);
    const settlements = jurisdictionMatches.map((c) => c.final_settlement_amount!);
    const median = computeMedian(settlements);
    const p25 = computePercentile(settlements, 25);
    const p75 = computePercentile(settlements, 75);
    signals.push({
      key: "jurisdiction_band",
      label: "Jurisdiction Settlement Band",
      description: `Cases in ${query.jurisdictionState} settled in a band of ${fmt(p25)} – ${fmt(p75)} (median ${fmt(median)}).`,
      value: `${fmt(p25)} – ${fmt(p75)}`,
      confidence: deriveConfidence(jurisdictionMatches.length),
      sampleSize: jurisdictionMatches.length,
      basis: `${jurisdictionMatches.length} closed claims in ${query.jurisdictionState}`,
    });
  } else {
    sparseWarnings.push(`No historical claims found for jurisdiction: ${query.jurisdictionState}.`);
  }

  // ── 2. Injury pattern match ───────────────────────────
  const injuryMatches = settled.filter((c) =>
    query.injuryCategories.some((cat) =>
      c.injury_categories.some((ic) => ic.toLowerCase() === cat.toLowerCase())
    )
  );
  if (injuryMatches.length >= LOW_THRESHOLD) {
    matchCriteria.push(`injury categories: ${query.injuryCategories.join(", ")}`);
    const settlements = injuryMatches.map((c) => c.final_settlement_amount!);
    const median = computeMedian(settlements);
    const p25 = computePercentile(settlements, 25);
    const p75 = computePercentile(settlements, 75);
    signals.push({
      key: "injury_pattern_band",
      label: "Injury Pattern Settlement Band",
      description: `Cases with similar injury patterns settled between ${fmt(p25)} and ${fmt(p75)} (median ${fmt(median)}).`,
      value: `${fmt(p25)} – ${fmt(p75)}`,
      confidence: deriveConfidence(injuryMatches.length),
      sampleSize: injuryMatches.length,
      basis: `${injuryMatches.length} claims with overlapping injury categories`,
    });
  } else if (injuryMatches.length > 0) {
    sparseWarnings.push(`Only ${injuryMatches.length} claim(s) match the injury pattern — too few for reliable signal.`);
  }

  // ── 3. Surgery / treatment intensity ──────────────────
  if (query.hasSurgery) {
    const surgeryMatches = settled.filter((c) => c.has_surgery);
    if (surgeryMatches.length >= LOW_THRESHOLD) {
      matchCriteria.push("has surgery");
      const settlements = surgeryMatches.map((c) => c.final_settlement_amount!);
      const median = computeMedian(settlements);
      signals.push({
        key: "surgery_cases_median",
        label: "Surgery Cases Median",
        description: `Cases involving surgery settled at a median of ${fmt(median)}.`,
        value: fmt(median),
        confidence: deriveConfidence(surgeryMatches.length),
        sampleSize: surgeryMatches.length,
        basis: `${surgeryMatches.length} closed surgical claims`,
      });
    }
  }

  // ── 4. Attorney historical settlement ratio ───────────
  if (query.attorneyName) {
    const attorneyMatches = settled.filter(
      (c) => c.attorney_name.toLowerCase() === query.attorneyName!.toLowerCase()
    );
    if (attorneyMatches.length >= LOW_THRESHOLD) {
      matchCriteria.push(`attorney: ${query.attorneyName}`);
      const ratios = attorneyMatches
        .filter((c) => c.billed_specials != null && c.billed_specials > 0)
        .map((c) => c.final_settlement_amount! / c.billed_specials!);

      if (ratios.length >= LOW_THRESHOLD) {
        const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        signals.push({
          key: "attorney_settlement_ratio",
          label: "Attorney Settlement Ratio",
          description: `${query.attorneyName} historically closed at approximately ${(avgRatio * 100).toFixed(0)}% of billed specials.`,
          value: `${(avgRatio * 100).toFixed(0)}%`,
          confidence: deriveConfidence(ratios.length),
          sampleSize: ratios.length,
          basis: `${ratios.length} claims with this attorney that had specials data`,
        });
      }

      // Attorney's typical settlement zone relative to eval midpoint
      if (query.evalLikely != null) {
        const settlements = attorneyMatches.map((c) => c.final_settlement_amount!);
        const median = computeMedian(settlements);
        const relativeToLikely = ((median / query.evalLikely) * 100).toFixed(0);
        signals.push({
          key: "attorney_vs_eval_midpoint",
          label: "Attorney vs. Evaluated Midpoint",
          description: `This attorney's historical median settlement (${fmt(median)}) is approximately ${relativeToLikely}% of the current evaluated likely value.`,
          value: `${relativeToLikely}% of likely`,
          confidence: deriveConfidence(attorneyMatches.length),
          sampleSize: attorneyMatches.length,
          basis: `${attorneyMatches.length} closed claims by this attorney`,
        });
      }
    } else if (attorneyMatches.length > 0) {
      sparseWarnings.push(`Only ${attorneyMatches.length} claim(s) found for ${query.attorneyName} — insufficient for calibration.`);
    } else {
      sparseWarnings.push(`No historical claims found for attorney: ${query.attorneyName}.`);
    }
  }

  // ── 5. Specials-to-settlement multiplier ──────────────
  const withSpecials = settled.filter(
    (c) => c.billed_specials != null && c.billed_specials > 0
  );
  if (withSpecials.length >= LOW_THRESHOLD && query.totalBilled > 0) {
    const multipliers = withSpecials.map(
      (c) => c.final_settlement_amount! / c.billed_specials!
    );
    const medianMult = computeMedian(multipliers);
    const impliedSettlement = query.totalBilled * medianMult;
    const reviewedMult = query.totalReviewed && query.totalReviewed > 0
      ? withSpecials
          .filter((c) => c.reviewed_specials != null && c.reviewed_specials > 0)
          .map((c) => c.final_settlement_amount! / c.reviewed_specials!)
      : null;

    signals.push({
      key: "specials_multiplier",
      label: "Specials-to-Settlement Multiplier",
      description: `Historical median multiplier is ${medianMult.toFixed(2)}×. Applied to current billed specials (${fmt(query.totalBilled)}), this implies approximately ${fmt(impliedSettlement)}.`,
      value: `${medianMult.toFixed(2)}× → ${fmt(impliedSettlement)}`,
      confidence: deriveConfidence(withSpecials.length),
      sampleSize: withSpecials.length,
      basis: `${withSpecials.length} claims with specials data`,
    });

    if (reviewedMult && reviewedMult.length >= LOW_THRESHOLD && query.totalReviewed) {
      const medReviewedMult = computeMedian(reviewedMult);
      const impliedFromReviewed = query.totalReviewed * medReviewedMult;
      signals.push({
        key: "reviewed_specials_multiplier",
        label: "Reviewed Specials Multiplier",
        description: `Based on reviewed specials (${fmt(query.totalReviewed)}), the historical multiplier of ${medReviewedMult.toFixed(2)}× implies approximately ${fmt(impliedFromReviewed)}.`,
        value: `${medReviewedMult.toFixed(2)}× → ${fmt(impliedFromReviewed)}`,
        confidence: deriveConfidence(reviewedMult.length),
        sampleSize: reviewedMult.length,
        basis: `${reviewedMult.length} claims with reviewed specials`,
      });
    }
  }

  // ── 6. Counteroffer position relative to historical outcomes
  if (query.currentCounteroffer != null && settled.length >= LOW_THRESHOLD) {
    const settlements = settled.map((c) => c.final_settlement_amount!).sort((a, b) => a - b);
    const belowCount = settlements.filter((s) => s <= query.currentCounteroffer!).length;
    const percentile = Math.round((belowCount / settlements.length) * 100);
    signals.push({
      key: "counteroffer_percentile",
      label: "Counteroffer vs. Historical Outcomes",
      description: `The current counteroffer of ${fmt(query.currentCounteroffer)} sits at the ${percentile}th percentile of historical settlement outcomes.`,
      value: `${percentile}th percentile`,
      confidence: deriveConfidence(settled.length),
      sampleSize: settled.length,
      basis: `${settled.length} closed claims in matched set`,
    });
  }

  // ── Combined similarity match ─────────────────────────
  const tightMatches = settled.filter((c) => {
    const jurisdictionOk = c.venue_state.toLowerCase() === query.jurisdictionState.toLowerCase();
    const injuryOk = query.injuryCategories.some((cat) =>
      c.injury_categories.some((ic) => ic.toLowerCase() === cat.toLowerCase())
    );
    return jurisdictionOk && injuryOk;
  });

  if (tightMatches.length >= LOW_THRESHOLD) {
    const settlements = tightMatches.map((c) => c.final_settlement_amount!);
    const median = computeMedian(settlements);
    const p25 = computePercentile(settlements, 25);
    const p75 = computePercentile(settlements, 75);
    signals.push({
      key: "combined_similar_band",
      label: "Similar Cases Settlement Zone",
      description: `Cases matching both jurisdiction and injury pattern settled between ${fmt(p25)} and ${fmt(p75)} (median ${fmt(median)}).`,
      value: `${fmt(p25)} – ${fmt(p75)}`,
      confidence: deriveConfidence(tightMatches.length),
      sampleSize: tightMatches.length,
      basis: `${tightMatches.length} claims matching jurisdiction + injury pattern`,
    });
  }

  return {
    signals,
    totalMatchedClaims: settled.length,
    matchCriteria,
    sparseWarnings,
  };
}

// ─── Helpers ────────────────────────────────────────────

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computePercentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
