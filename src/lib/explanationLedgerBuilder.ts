/**
 * EvaluateIQ — Explanation Ledger Builder
 *
 * Composes a structured, traceable explanation ledger from:
 *  - Range engine output (composition breakdown, rationale)
 *  - Valuation drivers (from driver engine)
 *  - Human assumption overrides
 *
 * PRINCIPLES:
 *  - No unsupported filler — every entry traces to engine data
 *  - Machine vs human entries are clearly separated
 *  - Professional, concise, claims-friendly language
 */

import { RANGE_ENGINE_VERSION, type RangeEngineOutput } from "@/lib/settlementRangeEngine";
import type { ExtractedDriver, DriverExtractionResult } from "@/lib/valuationDriverEngine";
import type { HumanAssumptionOverrides, AssumptionChangeEntry } from "@/hooks/useAssumptionOverrides";
import type {
  ExplanationLedger, LedgerEntry, LedgerCategory,
  LedgerEffectDirection, LedgerEntrySource, LedgerMagnitude,
  LedgerLineage, LedgerSummary,
} from "@/types/explanation-ledger";

// ─── Builder ─────────────────────────────────────────────

export function buildExplanationLedger(
  rangeOutput: RangeEngineOutput,
  driverResult: DriverExtractionResult,
  overrides: HumanAssumptionOverrides | null,
  changeLog: AssumptionChangeEntry[],
  sourceModule: "demandiq" | "revieweriq" = "demandiq",
  snapshotVersion: number = 1,
): ExplanationLedger {
  const now = new Date().toISOString();
  const lineage: LedgerLineage = {
    source_module: sourceModule,
    snapshot_version: snapshotVersion,
    engine_version: RANGE_ENGINE_VERSION,
    computed_at: now,
  };

  const entries: LedgerEntry[] = [];

  // 1. Economic base entries
  entries.push(...buildEconomicEntries(rangeOutput, lineage));

  // 2. Severity multiplier entries
  entries.push(...buildSeverityEntries(rangeOutput, lineage));

  // 3. Driver-derived entries
  entries.push(...buildDriverEntries(driverResult, lineage));

  // 4. Liability entries
  entries.push(...buildLiabilityEntries(rangeOutput, lineage));

  // 5. Treatment reliability entries
  entries.push(...buildReliabilityEntries(rangeOutput, lineage));

  // 6. Policy constraint entries
  entries.push(...buildPolicyEntries(rangeOutput, lineage));

  // 7. Human override entries
  if (overrides) {
    entries.push(...buildHumanOverrideEntries(overrides, changeLog, lineage));
  }

  // Deduplicate by entry_key (keep first occurrence)
  const seen = new Set<string>();
  const deduped = entries.filter(e => {
    if (seen.has(e.entry_key)) return false;
    seen.add(e.entry_key);
    return true;
  });

  // Sort: increases first (by magnitude desc), then decreases, then neutral
  const dirOrder: Record<LedgerEffectDirection, number> = {
    increase: 0, decrease: 1, constraint: 2, neutral: 3,
  };
  deduped.sort((a, b) => {
    const dOrd = dirOrder[a.direction] - dirOrder[b.direction];
    if (dOrd !== 0) return dOrd;
    return Math.abs(b.magnitude.value ?? 0) - Math.abs(a.magnitude.value ?? 0);
  });

  const summary = buildSummary(deduped);

  return {
    engine_version: RANGE_ENGINE_VERSION,
    built_at: now,
    entries: deduped,
    summary,
  };
}

// ─── Economic Base ───────────────────────────────────────

function buildEconomicEntries(r: RangeEngineOutput, lineage: LedgerLineage): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const comp = r.composition.economic_base;

  entries.push({
    entry_key: "econ_medical_base",
    title: "Medical economic base",
    category: "economic_base",
    direction: "increase",
    magnitude: mag(comp.likely, "dollars"),
    narrative: comp.details[0] || `Economic base of ${fmt(comp.likely)} used for range calculation.`,
    source: "engine",
    evidence_ref_ids: [],
    driver_key: null,
    lineage,
  });

  if (r.inputs_summary.wage_loss > 0) {
    entries.push({
      entry_key: "econ_wage_loss",
      title: "Wage loss included",
      category: "wage_loss",
      direction: "increase",
      magnitude: mag(r.inputs_summary.wage_loss, "dollars"),
      narrative: `Wage loss of ${fmt(r.inputs_summary.wage_loss)} added to the economic base, increasing the foundation for non-economic multipliers.`,
      source: "engine",
      evidence_ref_ids: [],
      driver_key: "wage_loss",
      lineage,
    });
  }

  if (r.inputs_summary.future_medical > 0) {
    entries.push({
      entry_key: "econ_future_medical",
      title: "Future medical estimate",
      category: "future_medical",
      direction: "increase",
      magnitude: mag(r.inputs_summary.future_medical, "dollars"),
      narrative: `Future medical estimate of ${fmt(r.inputs_summary.future_medical)} included in the economic base.`,
      source: "engine",
      evidence_ref_ids: [],
      driver_key: "future_treatment",
      lineage,
    });
  }

  return entries;
}

// ─── Severity Multiplier ─────────────────────────────────

function buildSeverityEntries(r: RangeEngineOutput, lineage: LedgerLineage): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const sev = r.composition.severity_multiplier;

  entries.push({
    entry_key: "severity_base_tier",
    title: "Non-economic severity tier",
    category: "severity_multiplier",
    direction: "increase",
    magnitude: { value: sev.likely_mult, unit: "multiplier", display: `${sev.likely_mult.toFixed(1)}x likely` },
    narrative: sev.reasons[0] || `Severity multiplier of ${sev.floor_mult.toFixed(1)}x – ${sev.stretch_mult.toFixed(1)}x applied to economic base.`,
    source: "engine",
    evidence_ref_ids: [],
    driver_key: null,
    lineage,
  });

  // Clinical adjustments from reasons (skip first which is base tier)
  for (let i = 1; i < sev.reasons.length; i++) {
    const reason = sev.reasons[i];
    const match = reason.match(/\+([0-9.]+)\/([0-9.]+)\/([0-9.]+)\s*—\s*(.+)/);
    if (match) {
      const likelyAdj = parseFloat(match[2]);
      entries.push({
        entry_key: `clinical_adj_${i}`,
        title: match[4],
        category: "clinical_adjustment",
        direction: "increase",
        magnitude: { value: likelyAdj, unit: "multiplier", display: `+${likelyAdj.toFixed(1)}x` },
        narrative: `${match[4]} adds ${match[1]}x/${match[2]}x/${match[3]}x to the floor/likely/stretch severity multipliers.`,
        source: "engine",
        evidence_ref_ids: [],
        driver_key: null,
        lineage,
      });
    }
  }

  return entries;
}

// ─── Driver-derived ──────────────────────────────────────

function buildDriverEntries(dr: DriverExtractionResult, lineage: LedgerLineage): LedgerEntry[] {
  // Only include high-impact drivers not already covered by composition entries
  const coveredKeys = new Set([
    "wage_loss", "future_treatment", "surgery", "permanency",
    "injections", "advanced_imaging", "scarring", "impairment_rating",
  ]);

  return dr.drivers
    .filter(d => d.score >= 40 && !coveredKeys.has(d.driver_key))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(d => ({
      entry_key: `driver_${d.driver_key}`,
      title: d.title,
      category: mapDriverFamily(d.family),
      direction: mapDriverDirection(d.direction),
      magnitude: { value: d.score, unit: "count" as const, display: `Score: ${d.score}/100` },
      narrative: d.narrative,
      source: "engine" as const,
      evidence_ref_ids: d.evidence_ref_ids,
      driver_key: d.driver_key,
      lineage,
    }));
}

function mapDriverFamily(family: string): LedgerCategory {
  const map: Record<string, LedgerCategory> = {
    injury_severity: "severity_multiplier",
    treatment_intensity: "treatment_reliability",
    liability: "liability",
    credibility: "credibility",
    venue: "venue",
    policy_limits: "policy_constraint",
    wage_loss: "wage_loss",
    future_treatment: "future_medical",
    permanency: "clinical_adjustment",
    surgery: "clinical_adjustment",
    imaging: "clinical_adjustment",
    pre_existing: "prior_conditions",
  };
  return map[family] || "economic_base";
}

function mapDriverDirection(dir: string): LedgerEffectDirection {
  if (dir === "expander") return "increase";
  if (dir === "reducer") return "decrease";
  return "neutral";
}

// ─── Liability ───────────────────────────────────────────

function buildLiabilityEntries(r: RangeEngineOutput, lineage: LedgerLineage): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  const liab = r.composition.liability_factor;

  if (liab.factor < 1.0) {
    entries.push({
      entry_key: "liability_factor",
      title: "Liability adjustment",
      category: "liability",
      direction: "decrease",
      magnitude: { value: liab.factor, unit: "factor", display: `${Math.round(liab.factor * 100)}% factor` },
      narrative: liab.reasons.join(". ") + ".",
      source: liab.reasons.some(r => r.includes("Human-adopted")) ? "human_override" : "engine",
      evidence_ref_ids: [],
      driver_key: "liability",
      lineage,
    });
  }

  // Separate comparative fault entry
  const compReason = liab.reasons.find(r => r.toLowerCase().includes("comparative"));
  if (compReason) {
    const pctMatch = compReason.match(/(\d+)%/);
    entries.push({
      entry_key: "comparative_fault",
      title: "Comparative fault reduction",
      category: "comparative_fault",
      direction: "decrease",
      magnitude: { value: pctMatch ? parseInt(pctMatch[1]) : null, unit: "percentage", display: pctMatch ? `${pctMatch[1]}%` : "Applied" },
      narrative: compReason.endsWith(".") ? compReason : compReason + ".",
      source: compReason.includes("human-adopted") ? "human_override" : "engine",
      evidence_ref_ids: [],
      driver_key: "comparative_fault",
      lineage,
    });
  }

  return entries;
}

// ─── Treatment Reliability ───────────────────────────────

function buildReliabilityEntries(r: RangeEngineOutput, lineage: LedgerLineage): LedgerEntry[] {
  const rel = r.composition.treatment_reliability;
  if (rel.factor >= 1.0) return [];

  return [{
    entry_key: "treatment_reliability",
    title: "Treatment reliability adjustment",
    category: "treatment_reliability",
    direction: "decrease",
    magnitude: { value: rel.factor, unit: "factor", display: `${Math.round(rel.factor * 100)}% factor` },
    narrative: rel.reasons.filter(r => r !== "No treatment reliability concerns identified").join(". ") + ".",
    source: "engine",
    evidence_ref_ids: [],
    driver_key: "treatment_reliability",
    lineage,
  }];
}

// ─── Policy Constraints ──────────────────────────────────

function buildPolicyEntries(r: RangeEngineOutput, lineage: LedgerLineage): LedgerEntry[] {
  const cap = r.composition.policy_cap;
  if (!cap.applied) return [];

  return [{
    entry_key: "policy_cap",
    title: "Policy limits cap",
    category: "policy_constraint",
    direction: "constraint",
    magnitude: mag(cap.max_coverage ?? 0, "dollars"),
    narrative: `${cap.detail}. The recoverable amount is constrained regardless of calculated damages.`,
    source: "system_constraint",
    evidence_ref_ids: [],
    driver_key: "policy_limits",
    lineage,
  }];
}

// ─── Human Overrides ─────────────────────────────────────

function buildHumanOverrideEntries(
  ov: HumanAssumptionOverrides,
  changeLog: AssumptionChangeEntry[],
  lineage: LedgerLineage,
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  if (ov.liability_percentage !== null) {
    const log = changeLog.find(l => l.field === "liability_percentage");
    entries.push({
      entry_key: "human_liability",
      title: "Adopted liability percentage",
      category: "human_assumption",
      direction: ov.liability_percentage < 100 ? "decrease" : "neutral",
      magnitude: { value: ov.liability_percentage, unit: "percentage", display: `${ov.liability_percentage}%` },
      narrative: `Reviewer adopted ${ov.liability_percentage}% liability, overriding the system-derived calculation.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "liability",
      lineage,
    });
  }

  if (ov.comparative_negligence_percentage !== null) {
    const log = changeLog.find(l => l.field === "comparative_negligence_percentage");
    entries.push({
      entry_key: "human_comp_neg",
      title: "Adopted comparative negligence",
      category: "human_assumption",
      direction: "decrease",
      magnitude: { value: ov.comparative_negligence_percentage, unit: "percentage", display: `${ov.comparative_negligence_percentage}%` },
      narrative: `Reviewer adopted ${ov.comparative_negligence_percentage}% comparative negligence.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "comparative_fault",
      lineage,
    });
  }

  if (ov.medical_base_preference) {
    const log = changeLog.find(l => l.field === "medical_base_preference");
    entries.push({
      entry_key: "human_medical_base",
      title: `Medical base: ${ov.medical_base_preference}`,
      category: "human_assumption",
      direction: "neutral",
      magnitude: { value: null, unit: "dollars", display: ov.medical_base_preference === "billed" ? "Billed totals" : "Reviewed amounts" },
      narrative: `Reviewer selected ${ov.medical_base_preference} medical amounts as the economic base.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "medical_base",
      lineage,
    });
  }

  if (ov.venue_severity) {
    const log = changeLog.find(l => l.field === "venue_severity");
    const dir: LedgerEffectDirection = ov.venue_severity === "plaintiff_friendly" ? "increase" : ov.venue_severity === "defense_friendly" ? "decrease" : "neutral";
    entries.push({
      entry_key: "human_venue",
      title: `Venue: ${ov.venue_severity.replace(/_/g, " ")}`,
      category: "human_assumption",
      direction: dir,
      magnitude: { value: null, unit: "factor", display: ov.venue_severity.replace(/_/g, " ") },
      narrative: `Reviewer characterized venue as ${ov.venue_severity.replace(/_/g, " ")}.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "venue",
      lineage,
    });
  }

  if (ov.credibility_impact && ov.credibility_impact !== "none") {
    const log = changeLog.find(l => l.field === "credibility_impact");
    entries.push({
      entry_key: "human_credibility",
      title: `Credibility: ${ov.credibility_impact} impact`,
      category: "human_assumption",
      direction: "decrease",
      magnitude: { value: null, unit: "factor", display: ov.credibility_impact },
      narrative: `Reviewer identified ${ov.credibility_impact} credibility concerns.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "credibility",
      lineage,
    });
  }

  if (ov.prior_condition_impact && ov.prior_condition_impact !== "none") {
    const log = changeLog.find(l => l.field === "prior_condition_impact");
    entries.push({
      entry_key: "human_prior_conditions",
      title: `Prior conditions: ${ov.prior_condition_impact} impact`,
      category: "human_assumption",
      direction: "decrease",
      magnitude: { value: null, unit: "factor", display: ov.prior_condition_impact },
      narrative: `Reviewer assessed ${ov.prior_condition_impact} impact from prior conditions.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "prior_conditions",
      lineage,
    });
  }

  if (ov.wage_loss_override !== null) {
    const log = changeLog.find(l => l.field === "wage_loss_override");
    entries.push({
      entry_key: "human_wage_loss",
      title: "Adopted wage loss",
      category: "human_assumption",
      direction: "neutral",
      magnitude: mag(ov.wage_loss_override, "dollars"),
      narrative: `Reviewer set wage loss to ${fmt(ov.wage_loss_override)}.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "wage_loss",
      lineage,
    });
  }

  if (ov.future_medical_override !== null) {
    const log = changeLog.find(l => l.field === "future_medical_override");
    entries.push({
      entry_key: "human_future_medical",
      title: "Adopted future medical",
      category: "human_assumption",
      direction: "neutral",
      magnitude: mag(ov.future_medical_override, "dollars"),
      narrative: `Reviewer set future medical estimate to ${fmt(ov.future_medical_override)}.${log?.reason ? ` Reason: ${log.reason}` : ""}`,
      source: "human_override",
      evidence_ref_ids: [],
      driver_key: "future_treatment",
      lineage,
    });
  }

  return entries;
}

// ─── Summary ─────────────────────────────────────────────

function buildSummary(entries: LedgerEntry[]): LedgerSummary {
  const cats = new Set<LedgerCategory>();
  entries.forEach(e => cats.add(e.category));

  return {
    total_entries: entries.length,
    increase_count: entries.filter(e => e.direction === "increase").length,
    decrease_count: entries.filter(e => e.direction === "decrease").length,
    neutral_count: entries.filter(e => e.direction === "neutral").length,
    constraint_count: entries.filter(e => e.direction === "constraint").length,
    human_override_count: entries.filter(e => e.source === "human_override").length,
    evidence_linked_count: entries.filter(e => e.evidence_ref_ids.length > 0).length,
    categories_covered: Array.from(cats),
  };
}

// ─── Helpers ─────────────────────────────────────────────

function fmt(n: number): string {
  return `$${n.toLocaleString()}`;
}

function mag(value: number, unit: "dollars" | "multiplier" | "percentage" | "factor" | "count"): LedgerMagnitude {
  const display = unit === "dollars" ? fmt(value)
    : unit === "multiplier" ? `${value.toFixed(1)}x`
    : unit === "percentage" ? `${value}%`
    : String(value);
  return { value, unit, display };
}
