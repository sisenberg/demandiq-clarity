/**
 * EvaluateIQ — Post-Merit Adjustment Engine
 *
 * Applies separate, explainable adjustments AFTER the merits corridor
 * is computed. Each adjustment is independent, auditable, and transparent.
 *
 * Adjustment categories:
 *  1. Causation & Apportionment
 *  2. Comparative Negligence
 *  3. Venue / Jurisdiction Effect
 *  4. Documentation Confidence Effect
 *  5. Coverage / Collectible Realities (config-gated)
 *
 * DESIGN:
 *  - Adjustments modify the corridor bands independently.
 *  - The merits corridor is preserved as-is; adjustments layer on top.
 *  - Each adjustment has direction, magnitude, explanation, and audit entry.
 *  - Documentation weakness widens the range and may suppress midpoint.
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { MeritsCorridor } from "@/lib/meritsCorridorEngine";

// ─── Engine Version ────────────────────────────────────

export const ADJUSTMENT_ENGINE_VERSION = "1.0.0";

// ─── Adjustment Types ──────────────────────────────────

export type AdjustmentCategory =
  | "causation_apportionment"
  | "comparative_negligence"
  | "venue_jurisdiction"
  | "documentation_confidence"
  | "coverage_collectibility";

export type AdjustmentDirection = "positive" | "negative" | "neutral" | "widening";

export interface PostMeritAdjustment {
  id: string;
  category: AdjustmentCategory;
  label: string;
  direction: AdjustmentDirection;
  /** Effect on each band (additive points, e.g. -5 means subtract 5 from that band) */
  effect: {
    low_delta: number;
    mid_delta: number;
    high_delta: number;
  };
  /** Human-readable explanation */
  explanation: string;
  /** Data inputs that drove this adjustment */
  inputs: string[];
  /** Whether this adjustment was applied (vs skipped due to config) */
  applied: boolean;
  /** Reason if not applied */
  skip_reason: string | null;
  /** Confidence in this adjustment */
  confidence: "high" | "moderate" | "low";
}

export interface AdjustmentAuditEntry {
  category: AdjustmentCategory;
  applied: boolean;
  direction: AdjustmentDirection;
  effect_summary: string;
  inputs_summary: string;
  timestamp: string;
}

// ─── Adjusted Corridor Output ──────────────────────────

export interface AdjustedSettlementCorridor {
  engine_version: string;
  computed_at: string;

  /** The input merits corridor (preserved, not mutated) */
  merits_corridor: {
    low: number;
    mid: number;
    high: number;
  };

  /** The adjusted corridor after all post-merit adjustments */
  adjusted: {
    low: number;
    mid: number;
    high: number;
  };

  /** Net change from merits to adjusted */
  net_delta: {
    low_delta: number;
    mid_delta: number;
    high_delta: number;
  };

  /** All adjustments (applied and skipped) */
  adjustments: PostMeritAdjustment[];

  /** Only the applied adjustments */
  applied_adjustments: PostMeritAdjustment[];

  /** Audit trail */
  audit_trail: AdjustmentAuditEntry[];

  /** Overall adjustment direction */
  net_direction: AdjustmentDirection;

  /** Summary explanation */
  summary: string;
}

// ─── Configuration ─────────────────────────────────────

export interface AdjustmentConfig {
  /** Whether coverage/collectibility adjustment is enabled */
  coverage_enabled: boolean;
}

const DEFAULT_CONFIG: AdjustmentConfig = {
  coverage_enabled: true,
};

// ─── Venue Multiplier Table (v1 Seeded) ────────────────
// Transparent, inspectable venue effects.

const VENUE_MULTIPLIERS: Record<string, { factor: number; label: string }> = {
  FL: { factor: 1.10, label: "Florida — plaintiff-favorable venue" },
  CA: { factor: 1.15, label: "California — high general damages" },
  NY: { factor: 1.12, label: "New York — elevated verdicts" },
  TX: { factor: 0.92, label: "Texas — conservative venue" },
  GA: { factor: 0.95, label: "Georgia — moderate-conservative" },
  IL: { factor: 1.05, label: "Illinois — moderate-plaintiff" },
  PA: { factor: 1.00, label: "Pennsylvania — neutral venue" },
  NJ: { factor: 1.08, label: "New Jersey — moderate-plaintiff" },
  OH: { factor: 0.95, label: "Ohio — moderate-conservative" },
};

const NEUTRAL_VENUE = { factor: 1.00, label: "Neutral venue — no adjustment" };

// ─── Engine Entry Point ────────────────────────────────

export function computePostMeritAdjustments(
  corridor: MeritsCorridor,
  snapshot: EvaluateIntakeSnapshot,
  config: AdjustmentConfig = DEFAULT_CONFIG,
): AdjustedSettlementCorridor {
  const adjustments: PostMeritAdjustment[] = [];
  const now = new Date().toISOString();

  // 1. Causation & Apportionment
  adjustments.push(computeCausationAdjustment(snapshot));

  // 2. Comparative Negligence
  adjustments.push(computeComparativeNegligenceAdjustment(snapshot));

  // 3. Venue / Jurisdiction
  adjustments.push(computeVenueAdjustment(snapshot));

  // 4. Documentation Confidence
  adjustments.push(computeDocumentationAdjustment(snapshot, corridor));

  // 5. Coverage / Collectibility (config-gated)
  adjustments.push(computeCoverageAdjustment(snapshot, corridor, config));

  // Apply adjustments to corridor
  const applied = adjustments.filter(a => a.applied);
  let adjLow = corridor.low;
  let adjMid = corridor.mid;
  let adjHigh = corridor.high;

  for (const adj of applied) {
    adjLow += adj.effect.low_delta;
    adjMid += adj.effect.mid_delta;
    adjHigh += adj.effect.high_delta;
  }

  // Clamp and enforce ordering
  adjLow = Math.max(0, Math.min(100, Math.round(adjLow)));
  adjMid = Math.max(0, Math.min(100, Math.round(adjMid)));
  adjHigh = Math.max(0, Math.min(100, Math.round(adjHigh)));
  if (adjMid < adjLow) adjMid = adjLow;
  if (adjHigh < adjMid) adjHigh = adjMid;

  const netDelta = {
    low_delta: adjLow - corridor.low,
    mid_delta: adjMid - corridor.mid,
    high_delta: adjHigh - corridor.high,
  };

  const netDir = determineNetDirection(netDelta);

  // Audit trail
  const audit_trail: AdjustmentAuditEntry[] = adjustments.map(a => ({
    category: a.category,
    applied: a.applied,
    direction: a.direction,
    effect_summary: a.applied
      ? `Low ${fmtDelta(a.effect.low_delta)}, Mid ${fmtDelta(a.effect.mid_delta)}, High ${fmtDelta(a.effect.high_delta)}`
      : "Not applied",
    inputs_summary: a.inputs.join("; "),
    timestamp: now,
  }));

  const summary = buildSummary(corridor, { low: adjLow, mid: adjMid, high: adjHigh }, applied);

  return {
    engine_version: ADJUSTMENT_ENGINE_VERSION,
    computed_at: now,
    merits_corridor: { low: corridor.low, mid: corridor.mid, high: corridor.high },
    adjusted: { low: adjLow, mid: adjMid, high: adjHigh },
    net_delta: netDelta,
    adjustments,
    applied_adjustments: applied,
    audit_trail,
    net_direction: netDir,
    summary,
  };
}

// ─── Adjustment Computations ───────────────────────────

function computeCausationAdjustment(snapshot: EvaluateIntakeSnapshot): PostMeritAdjustment {
  const preExisting = snapshot.injuries.filter(i => i.is_pre_existing);
  const causationConcerns = snapshot.upstream_concerns.filter(c => c.category === "causation");
  const hasIssues = preExisting.length > 0 || causationConcerns.length > 0;

  if (!hasIssues) {
    return makeAdjustment("causation_apportionment", "Causation & Apportionment", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      "No pre-existing conditions or causation concerns identified.",
      ["No pre-existing injuries", "No upstream causation flags"], true, "high");
  }

  const preExPct = preExisting.length / Math.max(1, snapshot.injuries.length);
  const severity = causationConcerns.some(c => c.severity === "critical") ? "critical"
    : causationConcerns.some(c => c.severity === "warning") ? "warning" : "info";

  // Larger pre-existing ratio → larger reduction
  let midReduction = -Math.round(preExPct * 12);
  let lowReduction = -Math.round(preExPct * 8);
  let highReduction = -Math.round(preExPct * 15);

  if (severity === "critical") {
    midReduction -= 5;
    lowReduction -= 3;
    highReduction -= 7;
  } else if (severity === "warning") {
    midReduction -= 2;
    highReduction -= 3;
  }

  const inputs = [
    `${preExisting.length}/${snapshot.injuries.length} injuries pre-existing`,
    `${causationConcerns.length} causation concerns (${severity})`,
  ];

  return makeAdjustment("causation_apportionment", "Causation & Apportionment", "negative",
    { low_delta: lowReduction, mid_delta: midReduction, high_delta: highReduction },
    `Pre-existing conditions affect ${preExisting.length} of ${snapshot.injuries.length} injuries. ${severity === "critical" ? "Critical causation concerns flagged upstream." : severity === "warning" ? "Moderate causation concerns present." : "Minor apportionment considerations."}`,
    inputs, true, severity === "critical" ? "low" : "moderate");
}

function computeComparativeNegligenceAdjustment(snapshot: EvaluateIntakeSnapshot): PostMeritAdjustment {
  const negligencePct = snapshot.comparative_negligence.claimant_negligence_percentage.value;

  if (negligencePct === null || negligencePct === 0) {
    return makeAdjustment("comparative_negligence", "Comparative Negligence", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      "No comparative negligence assigned to claimant.",
      ["Claimant negligence: 0% or not assessed"], true, "high");
  }

  // Direct proportional reduction
  const factor = negligencePct / 100;
  // Apply as percentage reduction of current bands (approximate via points)
  const midDelta = -Math.round(factor * 30); // up to -30 for 100% negligence
  const lowDelta = -Math.round(factor * 20);
  const highDelta = -Math.round(factor * 35);

  return makeAdjustment("comparative_negligence", "Comparative Negligence", "negative",
    { low_delta: lowDelta, mid_delta: midDelta, high_delta: highDelta },
    `Claimant bears ${negligencePct}% comparative negligence, reducing the corridor proportionally. In a pure comparative fault jurisdiction, this directly reduces recoverable value.`,
    [`Claimant negligence: ${negligencePct}%`, snapshot.comparative_negligence.notes.value || "No additional notes"],
    true, negligencePct > 50 ? "moderate" : "high");
}

function computeVenueAdjustment(snapshot: EvaluateIntakeSnapshot): PostMeritAdjustment {
  const state = snapshot.venue_jurisdiction.jurisdiction_state.value;
  const county = snapshot.venue_jurisdiction.venue_county.value;
  const venue = VENUE_MULTIPLIERS[state] ?? NEUTRAL_VENUE;

  if (venue.factor === 1.0) {
    return makeAdjustment("venue_jurisdiction", "Venue / Jurisdiction", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      `${venue.label}. No venue adjustment applied.`,
      [`State: ${state}`, county ? `County: ${county}` : "County: not specified", `Multiplier: ${venue.factor}x`],
      true, "moderate");
  }

  // Venue effect is symmetric but scaled
  const delta = Math.round((venue.factor - 1.0) * 50); // ±5 per 0.1 deviation
  const direction: AdjustmentDirection = delta > 0 ? "positive" : "negative";

  return makeAdjustment("venue_jurisdiction", "Venue / Jurisdiction", direction,
    { low_delta: Math.round(delta * 0.7), mid_delta: delta, high_delta: Math.round(delta * 1.2) },
    `${venue.label}. Venue multiplier of ${venue.factor}x applied to corridor.`,
    [`State: ${state}`, county ? `County: ${county}` : "County: not specified", `Multiplier: ${venue.factor}x`],
    true, "moderate");
}

function computeDocumentationAdjustment(
  snapshot: EvaluateIntakeSnapshot,
  corridor: MeritsCorridor,
): PostMeritAdjustment {
  const completeness = snapshot.overall_completeness_score;
  const docConcerns = snapshot.upstream_concerns.filter(c => c.category === "documentation");
  const criticalDocs = docConcerns.filter(c => c.severity === "critical");

  // High completeness = no effect
  if (completeness >= 80 && criticalDocs.length === 0) {
    return makeAdjustment("documentation_confidence", "Documentation Confidence", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      `Documentation completeness is ${completeness}% with no critical gaps. No adjustment needed.`,
      [`Completeness: ${completeness}%`, `Documentation concerns: ${docConcerns.length}`],
      true, "high");
  }

  // Documentation weakness: WIDEN the range and may suppress midpoint
  // Low band drops more, high band expands slightly (more uncertainty)
  const weaknessFactor = (100 - completeness) / 100; // 0.0–1.0

  let lowDelta = -Math.round(weaknessFactor * 10);
  let highDelta = Math.round(weaknessFactor * 5);
  let midDelta = 0;

  // Suppress midpoint only when critical documentation gaps exist
  if (criticalDocs.length > 0) {
    midDelta = -Math.round(criticalDocs.length * 2);
  }

  // Additional penalty for very low completeness
  if (completeness < 50) {
    lowDelta -= 3;
    midDelta -= 2;
  }

  const explanation = criticalDocs.length > 0
    ? `Documentation completeness is ${completeness}% with ${criticalDocs.length} critical gap(s). Range widened to reflect uncertainty; midpoint suppressed due to critical gaps.`
    : `Documentation completeness is ${completeness}%. Range widened to reflect moderate uncertainty in underlying data.`;

  return makeAdjustment("documentation_confidence", "Documentation Confidence", "widening",
    { low_delta: lowDelta, mid_delta: midDelta, high_delta: highDelta },
    explanation,
    [`Completeness: ${completeness}%`, `Doc concerns: ${docConcerns.length}`, `Critical gaps: ${criticalDocs.length}`],
    true, completeness < 50 ? "low" : "moderate");
}

function computeCoverageAdjustment(
  snapshot: EvaluateIntakeSnapshot,
  corridor: MeritsCorridor,
  config: AdjustmentConfig,
): PostMeritAdjustment {
  if (!config.coverage_enabled) {
    return makeAdjustment("coverage_collectibility", "Coverage / Collectibility", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      "Coverage adjustment disabled in configuration.",
      ["Config: coverage_enabled = false"],
      false, "Coverage adjustment is disabled in tenant configuration", "high");
  }

  const maxCoverage = snapshot.policy_coverage.reduce((m, p) => Math.max(m, p.coverage_limit ?? 0), 0);

  if (maxCoverage === 0 || maxCoverage === null) {
    return makeAdjustment("coverage_collectibility", "Coverage / Collectibility", "neutral",
      { low_delta: 0, mid_delta: 0, high_delta: 0 },
      "No coverage limits available. Cannot assess collectibility impact.",
      ["No policy limits on file"],
      true, "low");
  }

  // Coverage doesn't directly map to 0–100 corridor scores, but
  // very low coverage relative to injury severity signals a cap concern.
  // This is a qualitative signal, not a numeric corridor shift.
  const hasSurgery = snapshot.clinical_flags.has_surgery;
  const hasPermanency = snapshot.clinical_flags.has_permanency_indicators;
  const highSeverity = hasSurgery || hasPermanency;

  // Low limits + high severity = constrained recovery
  if (highSeverity && maxCoverage < 50000) {
    return makeAdjustment("coverage_collectibility", "Coverage / Collectibility", "negative",
      { low_delta: 0, mid_delta: -3, high_delta: -5 },
      `Policy limits of $${maxCoverage.toLocaleString()} are low relative to the severity of injuries (${hasSurgery ? "surgery" : "permanency"} present). High band constrained.`,
      [`Max coverage: $${maxCoverage.toLocaleString()}`, `High severity: ${highSeverity}`],
      true, "moderate");
  }

  return makeAdjustment("coverage_collectibility", "Coverage / Collectibility", "neutral",
    { low_delta: 0, mid_delta: 0, high_delta: 0 },
    `Policy limits of $${maxCoverage.toLocaleString()} appear adequate for the injury profile. No collectibility constraint applied.`,
    [`Max coverage: $${maxCoverage.toLocaleString()}`, `High severity: ${highSeverity}`],
    true, "moderate");
}

// ─── Helpers ───────────────────────────────────────────

function makeAdjustment(
  category: AdjustmentCategory,
  label: string,
  direction: AdjustmentDirection,
  effect: PostMeritAdjustment["effect"],
  explanation: string,
  inputs: string[],
  applied: boolean,
  confidenceOrSkipReason: "high" | "moderate" | "low" | string,
  confidenceIfSkipped?: "high" | "moderate" | "low",
): PostMeritAdjustment {
  const isConfidence = ["high", "moderate", "low"].includes(confidenceOrSkipReason);
  return {
    id: `adj-${category}`,
    category,
    label,
    direction,
    effect,
    explanation,
    inputs,
    applied,
    skip_reason: isConfidence ? null : confidenceOrSkipReason,
    confidence: isConfidence ? (confidenceOrSkipReason as "high" | "moderate" | "low") : (confidenceIfSkipped ?? "moderate"),
  };
}

function fmtDelta(d: number): string {
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

function determineNetDirection(delta: { low_delta: number; mid_delta: number; high_delta: number }): AdjustmentDirection {
  const sum = delta.low_delta + delta.mid_delta + delta.high_delta;
  if (sum > 2) return "positive";
  if (sum < -2) return "negative";
  // If low dropped but high rose → widening
  if (delta.low_delta < 0 && delta.high_delta > 0) return "widening";
  return "neutral";
}

function buildSummary(
  merits: { low: number; mid: number; high: number },
  adjusted: { low: number; mid: number; high: number },
  applied: PostMeritAdjustment[],
): string {
  if (applied.length === 0 || applied.every(a => a.direction === "neutral")) {
    return `Merits corridor (${merits.low}–${merits.mid}–${merits.high}) unchanged after post-merit review. No material adjustments applied.`;
  }

  const negatives = applied.filter(a => a.direction === "negative");
  const positives = applied.filter(a => a.direction === "positive");
  const widening = applied.filter(a => a.direction === "widening");

  const parts: string[] = [
    `Merits corridor adjusted from ${merits.low}–${merits.mid}–${merits.high} to ${adjusted.low}–${adjusted.mid}–${adjusted.high}.`,
  ];

  if (negatives.length > 0) parts.push(`${negatives.length} reducing adjustment(s): ${negatives.map(n => n.label).join(", ")}.`);
  if (positives.length > 0) parts.push(`${positives.length} expanding adjustment(s): ${positives.map(p => p.label).join(", ")}.`);
  if (widening.length > 0) parts.push(`${widening.length} widening adjustment(s): ${widening.map(w => w.label).join(", ")}.`);

  return parts.join(" ");
}
