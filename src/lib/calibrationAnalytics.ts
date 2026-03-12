/**
 * EvaluateIQ — Calibration Analytics Engine
 *
 * Computes drift analysis comparing predicted ranges vs actual
 * settlement outcomes. Slices by venue, attorney, injury, specials band.
 * Also previews impact of calibration config changes.
 */

import type { HistoricalClaim } from "@/types/calibration";
import type {
  DriftDataPoint, DriftSlice, DriftSummary,
  ConfigImpactPreview,
  SeverityMultiplierConfig,
} from "@/types/calibration-config";

// ─── Simplified range prediction for historical claims ────

interface SimplifiedRangeInput {
  medicalBase: number;
  wageLoss: number;
  hasSurgery: boolean;
  hasPermanency: boolean;
  hasInjections: boolean;
  hasImaging: boolean;
  liabilityPosture: string;
  comparativeNeg: number | null;
}

function estimateSeverityTier(claim: HistoricalClaim): "baseline" | "moderate" | "severe" | "catastrophic" {
  const injuries = claim.injury_categories.map(c => c.toLowerCase());
  if (injuries.some(i => i.includes("catastroph") || i.includes("tbi") || i.includes("spinal cord"))) return "catastrophic";
  if (injuries.some(i => i.includes("severe") || i.includes("fracture") || i.includes("herniat"))) return "severe";
  if (claim.has_surgery || claim.has_permanency) return "moderate";
  return "baseline";
}

function predictRange(
  claim: HistoricalClaim,
  severityMults: SeverityMultiplierConfig,
  reliabilityReductions?: ReliabilityReductionConfig,
): { floor: number; likely: number; stretch: number } {
  const medicalBase = claim.reviewed_specials ?? claim.billed_specials ?? 0;
  const wageLoss = claim.wage_loss ?? 0;
  const economicBase = medicalBase + wageLoss;

  if (economicBase === 0) return { floor: 0, likely: 0, stretch: 0 };

  const tier = estimateSeverityTier(claim);
  const mult = severityMults[tier];

  let floorM = mult.floor;
  let likelyM = mult.likely;
  let stretchM = mult.stretch;

  // Clinical adjustments (simplified)
  if (claim.has_surgery) { floorM += 0.5; likelyM += 1.0; stretchM += 1.5; }
  if (claim.has_permanency) { floorM += 0.5; likelyM += 1.0; stretchM += 2.0; }
  if (claim.has_injections) { floorM += 0.2; likelyM += 0.4; stretchM += 0.6; }
  if (claim.has_imaging) { floorM += 0.1; likelyM += 0.2; stretchM += 0.3; }

  // Liability
  let liabFactor = 1.0;
  if (claim.liability_posture === "disputed") liabFactor = 0.65;
  else if (claim.liability_posture === "comparative") liabFactor = 0.75;
  else if (claim.liability_posture === "denied") liabFactor = 0.30;

  if (claim.comparative_negligence_pct && claim.comparative_negligence_pct > 0) {
    liabFactor *= (1 - claim.comparative_negligence_pct / 100);
  }

  // Policy cap
  const cap = claim.policy_limits ?? Infinity;

  const floor = Math.min(Math.round(economicBase * floorM * liabFactor), cap);
  const likely = Math.min(Math.round(economicBase * likelyM * liabFactor), cap);
  const stretch = Math.min(Math.round(economicBase * stretchM * liabFactor), cap);

  return { floor, likely, stretch };
}

// ─── Drift Analysis ──────────────────────────────────────

export function computeDriftAnalysis(
  claims: HistoricalClaim[],
  severityMults: SeverityMultiplierConfig,
): DriftSummary {
  const eligible = claims.filter(c => c.final_settlement_amount != null && (c.billed_specials != null || c.reviewed_specials != null));

  const dataPoints: DriftDataPoint[] = eligible.map(c => {
    const range = predictRange(c, severityMults);
    const actual = c.final_settlement_amount!;
    let accuracy_label: DriftDataPoint["accuracy_label"] = "within_range";
    if (actual < range.floor) accuracy_label = "below_floor";
    else if (actual > range.stretch) accuracy_label = "above_stretch";

    return {
      claim_id: c.id,
      predicted_floor: range.floor,
      predicted_likely: range.likely,
      predicted_stretch: range.stretch,
      actual_settlement: actual,
      accuracy_label,
      venue_state: c.venue_state,
      attorney_name: c.attorney_name,
      injury_categories: c.injury_categories,
      provider_names: c.provider_names,
      billed_specials: c.billed_specials,
    };
  });

  const within = dataPoints.filter(d => d.accuracy_label === "within_range").length;
  const below = dataPoints.filter(d => d.accuracy_label === "below_floor").length;
  const above = dataPoints.filter(d => d.accuracy_label === "above_stretch").length;

  const errors = dataPoints.map(d => {
    const midpoint = (d.predicted_floor + d.predicted_stretch) / 2;
    return midpoint > 0 ? Math.abs(d.actual_settlement - midpoint) / midpoint * 100 : 0;
  });
  const meanError = errors.length > 0 ? errors.reduce((s, e) => s + e, 0) / errors.length : 0;

  return {
    total_claims: dataPoints.length,
    within_range_count: within,
    below_floor_count: below,
    above_stretch_count: above,
    overall_accuracy_pct: dataPoints.length > 0 ? Math.round(within / dataPoints.length * 100) : 0,
    mean_absolute_error_pct: Math.round(meanError * 10) / 10,
    slices_by_venue: computeSlices(dataPoints, "venue_state", d => d.venue_state),
    slices_by_attorney: computeSlices(dataPoints, "attorney", d => d.attorney_name),
    slices_by_injury: computeSlicesFlatArray(dataPoints, "injury_type", d => d.injury_categories),
    slices_by_specials_band: computeSlices(dataPoints, "specials_band", d => getSpecialsBand(d.billed_specials)),
  };
}

function computeSlices(
  data: DriftDataPoint[],
  dimension: string,
  keyFn: (d: DriftDataPoint) => string,
): DriftSlice[] {
  const groups = new Map<string, DriftDataPoint[]>();
  for (const d of data) {
    const k = keyFn(d) || "(unknown)";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(d);
  }

  return Array.from(groups.entries())
    .filter(([, pts]) => pts.length >= 2)
    .map(([value, pts]) => buildSlice(dimension, value, pts))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function computeSlicesFlatArray(
  data: DriftDataPoint[],
  dimension: string,
  keyFn: (d: DriftDataPoint) => string[],
): DriftSlice[] {
  const groups = new Map<string, DriftDataPoint[]>();
  for (const d of data) {
    const keys = keyFn(d);
    if (keys.length === 0) {
      const k = "(unknown)";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(d);
    }
    for (const k of keys) {
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(d);
    }
  }

  return Array.from(groups.entries())
    .filter(([, pts]) => pts.length >= 2)
    .map(([value, pts]) => buildSlice(dimension, value, pts))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function buildSlice(dimension: string, value: string, pts: DriftDataPoint[]): DriftSlice {
  const n = pts.length;
  const within = pts.filter(p => p.accuracy_label === "within_range").length;
  const below = pts.filter(p => p.accuracy_label === "below_floor").length;
  const above = pts.filter(p => p.accuracy_label === "above_stretch").length;
  const settlements = pts.map(p => p.actual_settlement).sort((a, b) => a - b);
  const median = settlements[Math.floor(n / 2)] ?? 0;
  const errors = pts.map(p => {
    const mid = (p.predicted_floor + p.predicted_stretch) / 2;
    return mid > 0 ? Math.abs(p.actual_settlement - mid) / mid * 100 : 0;
  });
  const meanErr = errors.reduce((s, e) => s + e, 0) / n;

  return {
    dimension,
    value,
    count: n,
    within_range_pct: Math.round(within / n * 100),
    below_floor_pct: Math.round(below / n * 100),
    above_stretch_pct: Math.round(above / n * 100),
    mean_error_pct: Math.round(meanErr * 10) / 10,
    median_settlement: median,
  };
}

function getSpecialsBand(specials: number | null): string {
  if (specials == null) return "(unknown)";
  if (specials < 5000) return "$0–$5K";
  if (specials < 15000) return "$5K–$15K";
  if (specials < 50000) return "$15K–$50K";
  if (specials < 100000) return "$50K–$100K";
  return "$100K+";
}

// ─── Impact Preview ──────────────────────────────────────

const MATERIAL_SHIFT_THRESHOLD = 15; // percent

export function previewConfigImpact(
  claims: HistoricalClaim[],
  currentMults: SeverityMultiplierConfig,
  proposedMults: SeverityMultiplierConfig,
): ConfigImpactPreview {
  const eligible = claims.filter(c => c.billed_specials != null || c.reviewed_specials != null);

  const impacts: Array<{ claim_id: string; before_likely: number; after_likely: number; delta_pct: number }> = [];
  let totalFloorDelta = 0;
  let totalLikelyDelta = 0;
  let totalStretchDelta = 0;
  let materialCount = 0;

  for (const c of eligible) {
    const before = predictRange(c, currentMults);
    const after = predictRange(c, proposedMults);

    const floorDelta = before.floor > 0 ? (after.floor - before.floor) / before.floor * 100 : 0;
    const likelyDelta = before.likely > 0 ? (after.likely - before.likely) / before.likely * 100 : 0;
    const stretchDelta = before.stretch > 0 ? (after.stretch - before.stretch) / before.stretch * 100 : 0;

    totalFloorDelta += floorDelta;
    totalLikelyDelta += likelyDelta;
    totalStretchDelta += stretchDelta;

    if (Math.abs(likelyDelta) >= MATERIAL_SHIFT_THRESHOLD) materialCount++;

    impacts.push({ claim_id: c.id, before_likely: before.likely, after_likely: after.likely, delta_pct: Math.round(likelyDelta * 10) / 10 });
  }

  const n = eligible.length || 1;
  const materialPct = eligible.length > 0 ? Math.round(materialCount / eligible.length * 100) : 0;

  return {
    cases_affected: eligible.length,
    total_cases: claims.length,
    avg_floor_delta_pct: Math.round(totalFloorDelta / n * 10) / 10,
    avg_likely_delta_pct: Math.round(totalLikelyDelta / n * 10) / 10,
    avg_stretch_delta_pct: Math.round(totalStretchDelta / n * 10) / 10,
    material_shift_count: materialCount,
    material_shift_threshold_pct: MATERIAL_SHIFT_THRESHOLD,
    warning: materialPct > 30
      ? `⚠️ This change would materially shift ${materialPct}% of cases (${materialCount}/${eligible.length}). Review before applying.`
      : materialCount > 0
        ? `${materialCount} case(s) would shift ≥${MATERIAL_SHIFT_THRESHOLD}%.`
        : null,
    sample_impacts: impacts
      .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
      .slice(0, 10),
  };
}
