/**
 * EvaluateIQ — Modifier Layer Engine
 *
 * Computes defensibility and settlement posture modifiers that adjust
 * the valuation range outside pure medical damages.
 *
 * Modifier groups:
 *  1. Liability — accepted/disputed, comparative negligence, witness/report support
 *  2. Causation — treatment timing, prior injury, degenerative, gaps, mechanism mismatch
 *  3. Claim Posture — representation, attorney intel, policy sensitivity, credibility
 *  4. Venue/Forum — severity tier, plaintiff/defense environment
 *
 * DESIGN:
 *  - Every modifier is traceable: what applied, why, evidence, source
 *  - System-derived vs user-entered is explicit per modifier
 *  - Missing major fields degrade overall confidence
 *  - Supervisor overrides replace magnitude/direction with audit trail
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  ModifierRecord,
  ModifierGroup,
  ModifierDirection,
  ModifierSource,
  ModifierConfidence,
  ModifierGroupSummary,
  ModifierLayerResult,
  ModifierOverride,
  ConfidenceDegradation,
  RepresentationContext,
  ModifierDefinition,
} from "@/types/modifier-layer";

// ─── Engine Version ────────────────────────────────────

export const MODIFIER_ENGINE_VERSION = "1.0.0";

// ─── Modifier Definitions (Registry) ───────────────────

export const MODIFIER_DEFINITIONS: ModifierDefinition[] = [
  // ── Liability ──
  { id: "liability_posture", label: "Liability Posture", group: "liability", description: "Whether liability is accepted, disputed, or unclear.", input_fields: ["liability_facts"], default_direction: "neutral", max_magnitude: 15, degrades_confidence_if_missing: true, missing_confidence_penalty: 10 },
  { id: "comparative_negligence_mod", label: "Comparative Negligence", group: "liability", description: "Claimant's percentage of fault.", input_fields: ["comparative_negligence"], default_direction: "negative", max_magnitude: 25, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "witness_support", label: "Witness / Corroboration Support", group: "liability", description: "Presence and quality of witness statements or corroborating evidence.", input_fields: ["liability_facts"], default_direction: "positive", max_magnitude: 8, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "police_report_support", label: "Police Report / Adverse Statement Support", group: "liability", description: "Police report or official documentation supporting liability position.", input_fields: ["liability_facts"], default_direction: "positive", max_magnitude: 8, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },

  // ── Causation ──
  { id: "treatment_timing", label: "Treatment Timing", group: "causation", description: "Whether treatment was prompt or significantly delayed after loss.", input_fields: ["treatment_timeline"], default_direction: "negative", max_magnitude: 10, degrades_confidence_if_missing: true, missing_confidence_penalty: 5 },
  { id: "prior_similar_injury", label: "Prior Similar Injury", group: "causation", description: "Evidence of prior injury to the same body region.", input_fields: ["injuries"], default_direction: "negative", max_magnitude: 12, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "degenerative_findings", label: "Degenerative Findings", group: "causation", description: "Pre-existing degenerative conditions complicating causation.", input_fields: ["injuries", "upstream_concerns"], default_direction: "negative", max_magnitude: 10, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "treatment_gaps", label: "Treatment Gaps", group: "causation", description: "Unexplained gaps in treatment continuity.", input_fields: ["upstream_concerns"], default_direction: "negative", max_magnitude: 8, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "mechanism_mismatch", label: "Mechanism–Complaint Mismatch", group: "causation", description: "Inconsistency between accident mechanism and claimed injuries.", input_fields: ["upstream_concerns", "injuries"], default_direction: "negative", max_magnitude: 12, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "limited_objective_support", label: "Limited Objective Support", group: "causation", description: "Lack of objective diagnostic findings supporting claimed injuries.", input_fields: ["clinical_flags", "injuries"], default_direction: "negative", max_magnitude: 10, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },

  // ── Claim Posture ──
  { id: "representation_status", label: "Represented vs Unrepresented", group: "claim_posture", description: "Whether the claimant has legal representation.", input_fields: ["upstream_concerns"], default_direction: "neutral", max_magnitude: 10, degrades_confidence_if_missing: true, missing_confidence_penalty: 5 },
  { id: "attorney_known", label: "Attorney Known / Unknown", group: "claim_posture", description: "Whether the representing attorney is identified and has known patterns.", input_fields: [], default_direction: "neutral", max_magnitude: 5, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "policy_limits_sensitivity", label: "Policy Limits Sensitivity", group: "claim_posture", description: "Whether claim value approaches or exceeds policy limits.", input_fields: ["policy_coverage"], default_direction: "negative", max_magnitude: 12, degrades_confidence_if_missing: true, missing_confidence_penalty: 8 },
  { id: "excess_exposure", label: "Excess Exposure Indicator", group: "claim_posture", description: "Risk of excess judgment beyond policy limits.", input_fields: ["policy_coverage", "injuries"], default_direction: "negative", max_magnitude: 10, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "credibility_concerns", label: "Claimant Credibility Concerns", group: "claim_posture", description: "Documented credibility issues affecting claim posture.", input_fields: ["upstream_concerns"], default_direction: "negative", max_magnitude: 10, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },

  // ── Venue / Forum ──
  { id: "venue_severity_tier", label: "Venue Severity Tier", group: "venue_forum", description: "Historical settlement/verdict environment for the jurisdiction.", input_fields: ["venue_jurisdiction"], default_direction: "neutral", max_magnitude: 12, degrades_confidence_if_missing: true, missing_confidence_penalty: 5 },
  { id: "venue_environment", label: "Plaintiff-Friendly vs Defense-Friendly", group: "venue_forum", description: "General plaintiff/defense orientation of the venue.", input_fields: ["venue_jurisdiction"], default_direction: "neutral", max_magnitude: 8, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
  { id: "venue_notes", label: "Internal Venue Notes", group: "venue_forum", description: "Internal adjuster notes or historical observations about this venue.", input_fields: [], default_direction: "neutral", max_magnitude: 5, degrades_confidence_if_missing: false, missing_confidence_penalty: 0 },
];

// ─── Venue Classification ──────────────────────────────

const VENUE_TIERS: Record<string, { tier: "plaintiff_friendly" | "neutral" | "defense_friendly"; magnitude: number; label: string }> = {
  FL: { tier: "plaintiff_friendly", magnitude: 8, label: "Florida — plaintiff-favorable venue" },
  CA: { tier: "plaintiff_friendly", magnitude: 10, label: "California — high general damages" },
  NY: { tier: "plaintiff_friendly", magnitude: 9, label: "New York — elevated verdicts" },
  TX: { tier: "defense_friendly", magnitude: -6, label: "Texas — conservative venue" },
  GA: { tier: "defense_friendly", magnitude: -4, label: "Georgia — moderate-conservative" },
  IL: { tier: "plaintiff_friendly", magnitude: 4, label: "Illinois — moderate-plaintiff" },
  PA: { tier: "neutral", magnitude: 0, label: "Pennsylvania — neutral venue" },
  NJ: { tier: "plaintiff_friendly", magnitude: 5, label: "New Jersey — moderate-plaintiff" },
  OH: { tier: "defense_friendly", magnitude: -4, label: "Ohio — moderate-conservative" },
  MI: { tier: "defense_friendly", magnitude: -3, label: "Michigan — no-fault / conservative" },
  WA: { tier: "plaintiff_friendly", magnitude: 3, label: "Washington — moderate-plaintiff" },
};

const NEUTRAL_VENUE = { tier: "neutral" as const, magnitude: 0, label: "Neutral venue — no data" };

// ─── Engine Entry Point ────────────────────────────────

export function computeModifierLayer(
  snapshot: EvaluateIntakeSnapshot,
  overrides?: ModifierOverride[],
): ModifierLayerResult {
  const now = new Date().toISOString();
  const activeOverrides = overrides ?? [];

  // Compute each modifier
  const modifiers: ModifierRecord[] = [
    ...computeLiabilityModifiers(snapshot),
    ...computeCausationModifiers(snapshot),
    ...computeClaimPostureModifiers(snapshot),
    ...computeVenueModifiers(snapshot),
  ];

  // Apply overrides
  for (const ov of activeOverrides) {
    const mod = modifiers.find(m => m.id === ov.modifier_id);
    if (mod) {
      mod.current_value = ov.override_value;
      mod.direction = ov.override_direction;
      mod.effect_magnitude = ov.override_magnitude;
      mod.source = "supervisor_override";
      mod.explanation = `Supervisor override: ${ov.override_reason}`;
    }
  }

  const applied = modifiers.filter(m => m.applied);

  // Group summaries
  const groups: ModifierGroup[] = ["liability", "causation", "claim_posture", "venue_forum"];
  const group_summaries: ModifierGroupSummary[] = groups.map(g => {
    const gMods = modifiers.filter(m => m.group === g);
    const gApplied = gMods.filter(m => m.applied);
    const net = gApplied.reduce((s, m) => s + m.effect_magnitude, 0);
    const hasOverride = gMods.some(m => m.source === "supervisor_override");
    const worstConf = gMods.reduce<ModifierConfidence>((worst, m) => {
      const order: ModifierConfidence[] = ["missing", "low", "moderate", "high"];
      return order.indexOf(m.confidence) < order.indexOf(worst) ? m.confidence : worst;
    }, "high");

    return {
      group: g,
      label: GROUP_LABELS[g],
      modifier_count: gMods.length,
      applied_count: gApplied.length,
      net_effect: net,
      net_direction: net > 0 ? "positive" : net < 0 ? "negative" : "neutral",
      confidence: worstConf,
      has_overrides: hasOverride,
    };
  });

  // Net effect
  const netMid = applied.reduce((s, m) => s + m.effect_magnitude, 0);
  const netLow = Math.round(netMid * 0.7);
  const netHigh = Math.round(netMid * 1.3);

  // Confidence degradations
  const degradations: ConfidenceDegradation[] = [];
  for (const def of MODIFIER_DEFINITIONS) {
    if (!def.degrades_confidence_if_missing) continue;
    const mod = modifiers.find(m => m.id === def.id);
    if (mod && mod.confidence === "missing") {
      degradations.push({
        modifier_id: def.id,
        label: def.label,
        penalty: def.missing_confidence_penalty,
        impact_description: `Missing ${def.label.toLowerCase()} data reduces overall confidence by ${def.missing_confidence_penalty} points.`,
      });
    }
  }

  // Representation context
  const representation = extractRepresentationContext(snapshot);

  const totalPenalty = degradations.reduce((s, d) => s + d.penalty, 0);
  const netDir: ModifierDirection = netMid > 2 ? "positive" : netMid < -2 ? "negative" : "neutral";

  const appliedCount = applied.length;
  const overrideCount = activeOverrides.length;
  const audit_summary = `${appliedCount} modifier(s) applied across ${groups.length} groups. Net corridor effect: ${fmtDelta(netMid)} mid-point. ${overrideCount} supervisor override(s). ${degradations.length} confidence degradation(s) totaling -${totalPenalty} points. Representation: ${representation.status}.`;

  return {
    engine_version: MODIFIER_ENGINE_VERSION,
    computed_at: now,
    modifiers,
    applied_modifiers: applied,
    group_summaries,
    net_effect: { low_delta: netLow, mid_delta: netMid, high_delta: netHigh },
    net_direction: netDir,
    representation,
    confidence_degradations: degradations,
    total_confidence_penalty: totalPenalty,
    overrides: activeOverrides,
    audit_summary,
  };
}

// ─── Group Labels ──────────────────────────────────────

const GROUP_LABELS: Record<ModifierGroup, string> = {
  liability: "Liability",
  causation: "Causation",
  claim_posture: "Claim Posture",
  venue_forum: "Venue / Forum",
};

// ─── Liability Modifiers ───────────────────────────────

function computeLiabilityModifiers(snap: EvaluateIntakeSnapshot): ModifierRecord[] {
  const results: ModifierRecord[] = [];
  const facts = snap.liability_facts;

  // 1. Liability Posture
  if (facts.length === 0) {
    results.push(makeMod("liability_posture", "Liability Posture", "liability", "neutral", 0, "Unknown", "No liability facts available in intake snapshot.", [], "No liability data on file", "system_derived", "missing", true, null));
  } else {
    const supporting = facts.filter(f => f.supports_liability).length;
    const adverse = facts.filter(f => !f.supports_liability).length;
    const ratio = supporting / facts.length;
    if (ratio >= 0.8) {
      results.push(makeMod("liability_posture", "Liability Posture", "liability", "positive", 5, "Accepted", `${supporting}/${facts.length} liability facts support the claim. Clear liability posture.`, facts.map(f => f.id), `${supporting} supporting, ${adverse} adverse facts`, "system_derived", "high", true, null));
    } else if (ratio >= 0.5) {
      results.push(makeMod("liability_posture", "Liability Posture", "liability", "neutral", 0, "Mixed", `Mixed liability evidence: ${supporting} supporting, ${adverse} adverse. Liability partially disputed.`, facts.map(f => f.id), `${supporting} supporting, ${adverse} adverse facts`, "system_derived", "moderate", true, null));
    } else {
      results.push(makeMod("liability_posture", "Liability Posture", "liability", "negative", -Math.min(15, Math.round((1 - ratio) * 15)), "Disputed", `Liability disputed: only ${supporting}/${facts.length} facts support the claim.`, facts.map(f => f.id), `${supporting} supporting, ${adverse} adverse facts`, "system_derived", "moderate", true, null));
    }
  }

  // 2. Comparative Negligence
  const negPct = snap.comparative_negligence.claimant_negligence_percentage.value;
  if (negPct === null || negPct === 0) {
    results.push(makeMod("comparative_negligence_mod", "Comparative Negligence", "liability", "neutral", 0, `${negPct ?? 0}%`, "No comparative negligence assigned.", [], "Claimant: 0%", "system_derived", negPct === null ? "missing" : "high", true, null));
  } else {
    const delta = -Math.round((negPct / 100) * 25);
    results.push(makeMod("comparative_negligence_mod", "Comparative Negligence", "liability", "negative", delta, `${negPct}%`, `Claimant bears ${negPct}% comparative negligence. Corridor reduced proportionally.`, [], `Claimant: ${negPct}%`, "system_derived", "high", true, null));
  }

  // 3. Witness Support
  const witnessRefs = facts.filter(f => /witness|statement|deposition|testimony/i.test(f.fact_text));
  if (witnessRefs.length > 0) {
    results.push(makeMod("witness_support", "Witness / Corroboration", "liability", "positive", Math.min(8, witnessRefs.length * 3), `${witnessRefs.length} refs`, `${witnessRefs.length} witness/corroboration reference(s) found in liability facts.`, witnessRefs.map(w => w.id), `${witnessRefs.length} witness references`, "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("witness_support", "Witness / Corroboration", "liability", "neutral", 0, "None", "No witness statements or corroborating evidence identified.", [], "No witness data", "system_derived", "low", true, null));
  }

  // 4. Police Report Support
  const policeRefs = facts.filter(f => /police|report|citation|accident report|adverse/i.test(f.fact_text));
  if (policeRefs.length > 0) {
    const favorable = policeRefs.filter(f => f.supports_liability);
    const delta = favorable.length > 0 ? Math.min(8, favorable.length * 4) : -Math.min(5, policeRefs.length * 2);
    const dir: ModifierDirection = favorable.length > 0 ? "positive" : "negative";
    results.push(makeMod("police_report_support", "Police Report / Adverse Statement", "liability", dir, delta, favorable.length > 0 ? "Favorable" : "Adverse", favorable.length > 0 ? `${favorable.length} favorable police/report reference(s).` : `${policeRefs.length} adverse report reference(s) identified.`, policeRefs.map(p => p.id), `${policeRefs.length} report refs`, "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("police_report_support", "Police Report / Adverse Statement", "liability", "neutral", 0, "None", "No police report or adverse statement references found.", [], "No report data", "system_derived", "low", false, "No report references in liability facts"));
  }

  return results;
}

// ─── Causation Modifiers ───────────────────────────────

function computeCausationModifiers(snap: EvaluateIntakeSnapshot): ModifierRecord[] {
  const results: ModifierRecord[] = [];
  const concerns = snap.upstream_concerns;

  // 1. Treatment Timing
  const timeline = snap.treatment_timeline;
  if (timeline.length === 0) {
    results.push(makeMod("treatment_timing", "Treatment Timing", "causation", "neutral", 0, "Unknown", "No treatment timeline data.", [], "No treatment data", "system_derived", "missing", true, null));
  } else {
    const lossDate = new Date(snap.accident.date_of_loss.value).getTime();
    const firstDates = timeline.map(t => t.treatment_date).filter((d): d is string => d != null).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    if (firstDates.length > 0) {
      const firstVisit = Math.min(...firstDates);
      const delayDays = Math.round((firstVisit - lossDate) / 86400000);
      if (delayDays <= 3) {
        results.push(makeMod("treatment_timing", "Treatment Timing", "causation", "positive", 3, `${delayDays}d delay`, `Prompt treatment: first visit ${delayDays} day(s) after loss. Supports causation.`, [], `${delayDays} day delay`, "system_derived", "high", true, null));
      } else if (delayDays <= 14) {
        results.push(makeMod("treatment_timing", "Treatment Timing", "causation", "neutral", 0, `${delayDays}d delay`, `Treatment began ${delayDays} days after loss. Within reasonable window.`, [], `${delayDays} day delay`, "system_derived", "high", true, null));
      } else {
        const penalty = -Math.min(10, Math.round(delayDays / 7));
        results.push(makeMod("treatment_timing", "Treatment Timing", "causation", "negative", penalty, `${delayDays}d delay`, `Delayed treatment: ${delayDays} days after loss. Weakens causation argument.`, [], `${delayDays} day delay`, "system_derived", "moderate", true, null));
      }
    } else {
      results.push(makeMod("treatment_timing", "Treatment Timing", "causation", "neutral", 0, "No dates", "Treatment dates unavailable for timing analysis.", [], "No dates", "system_derived", "low", true, null));
    }
  }

  // 2. Prior Similar Injury
  const preExisting = snap.injuries.filter(i => i.is_pre_existing);
  if (preExisting.length > 0) {
    const pct = Math.round((preExisting.length / snap.injuries.length) * 100);
    const delta = -Math.min(12, Math.round(pct / 10));
    results.push(makeMod("prior_similar_injury", "Prior Similar Injury", "causation", "negative", delta, `${preExisting.length} pre-existing`, `${preExisting.length} of ${snap.injuries.length} injuries are pre-existing (${pct}%). Complicates causation.`, preExisting.map(i => i.id), `${pct}% pre-existing`, "system_derived", "high", true, null));
  } else {
    results.push(makeMod("prior_similar_injury", "Prior Similar Injury", "causation", "neutral", 0, "None", "No prior similar injuries identified.", [], "No pre-existing injuries", "system_derived", "high", true, null));
  }

  // 3. Degenerative Findings
  const degenConcerns = concerns.filter(c => /degener|arthrit|spondyl|stenosis|disc.?disease/i.test(c.description));
  if (degenConcerns.length > 0) {
    const delta = -Math.min(10, degenConcerns.length * 4);
    results.push(makeMod("degenerative_findings", "Degenerative Findings", "causation", "negative", delta, `${degenConcerns.length} findings`, `${degenConcerns.length} degenerative finding(s) identified in upstream review. May weaken causation.`, degenConcerns.map(c => c.id), `${degenConcerns.length} degenerative concerns`, "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("degenerative_findings", "Degenerative Findings", "causation", "neutral", 0, "None", "No degenerative findings flagged.", [], "No degenerative concerns", "system_derived", "high", true, null));
  }

  // 4. Treatment Gaps
  const gapConcerns = concerns.filter(c => c.category === "gap");
  if (gapConcerns.length > 0) {
    const criticalGaps = gapConcerns.filter(c => c.severity === "critical").length;
    const delta = -Math.min(8, gapConcerns.length * 2 + criticalGaps * 2);
    results.push(makeMod("treatment_gaps", "Treatment Gaps", "causation", "negative", delta, `${gapConcerns.length} gap(s)`, `${gapConcerns.length} treatment gap(s) identified (${criticalGaps} critical). Weakens continuity argument.`, gapConcerns.map(c => c.id), `${gapConcerns.length} gaps, ${criticalGaps} critical`, "system_derived", criticalGaps > 0 ? "moderate" : "high", true, null));
  } else {
    results.push(makeMod("treatment_gaps", "Treatment Gaps", "causation", "positive", 2, "None", "No treatment gaps identified. Continuous care supports causation.", [], "No gaps", "system_derived", "high", true, null));
  }

  // 5. Mechanism–Complaint Mismatch
  const mismatchConcerns = concerns.filter(c => /mismatch|inconsisten|mechanism|complaint|disproportion/i.test(c.description));
  if (mismatchConcerns.length > 0) {
    const delta = -Math.min(12, mismatchConcerns.length * 5);
    results.push(makeMod("mechanism_mismatch", "Mechanism–Complaint Mismatch", "causation", "negative", delta, `${mismatchConcerns.length} issue(s)`, `${mismatchConcerns.length} mechanism–complaint inconsistency(ies) flagged.`, mismatchConcerns.map(c => c.id), `${mismatchConcerns.length} mismatches`, "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("mechanism_mismatch", "Mechanism–Complaint Mismatch", "causation", "neutral", 0, "None", "No mechanism–complaint mismatches identified.", [], "No mismatches", "system_derived", "high", true, null));
  }

  // 6. Limited Objective Support
  const flags = snap.clinical_flags;
  const objectiveScore = (flags.has_advanced_imaging ? 2 : 0) + (flags.has_surgery ? 2 : 0) + (flags.has_impairment_rating ? 1 : 0);
  if (objectiveScore === 0) {
    results.push(makeMod("limited_objective_support", "Limited Objective Support", "causation", "negative", -8, "No objective findings", "No advanced imaging, surgery, or impairment rating documented. Injuries supported only by subjective complaints.", [], "Symptoms only", "system_derived", "moderate", true, null));
  } else if (objectiveScore <= 2) {
    results.push(makeMod("limited_objective_support", "Limited Objective Support", "causation", "negative", -3, "Minimal", "Limited objective findings. Some diagnostic support present.", [], `Objective score: ${objectiveScore}/5`, "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("limited_objective_support", "Limited Objective Support", "causation", "positive", Math.min(5, objectiveScore), "Strong", `Strong objective support: imaging, procedures, and/or impairment rating documented.`, [], `Objective score: ${objectiveScore}/5`, "system_derived", "high", true, null));
  }

  return results;
}

// ─── Claim Posture Modifiers ───────────────────────────

function computeClaimPostureModifiers(snap: EvaluateIntakeSnapshot): ModifierRecord[] {
  const results: ModifierRecord[] = [];
  const concerns = snap.upstream_concerns;

  // 1. Representation Status (reporting-ready)
  const repContext = extractRepresentationContext(snap);
  if (repContext.status === "represented") {
    results.push(makeMod("representation_status", "Represented vs Unrepresented", "claim_posture", "positive", 5, "Represented", `Claimant is represented${repContext.attorney_name ? ` by ${repContext.attorney_name}` : ""}${repContext.firm_name ? ` (${repContext.firm_name})` : ""}. Expected resolution range adjusts for negotiation posture.`, [], `Represented${repContext.attorney_name ? ` — ${repContext.attorney_name}` : ""}`, repContext.source, "high", true, null));
  } else if (repContext.status === "unrepresented") {
    results.push(makeMod("representation_status", "Represented vs Unrepresented", "claim_posture", "negative", -5, "Unrepresented", "Claimant is unrepresented. Expected resolution range typically lower due to reduced negotiation leverage.", [], "Unrepresented", repContext.source, "high", true, null));
  } else {
    results.push(makeMod("representation_status", "Represented vs Unrepresented", "claim_posture", "neutral", 0, "Unknown", "Representation status unknown. Cannot adjust for negotiation posture.", [], "Unknown representation", repContext.source, "missing", true, null));
  }

  // 2. Attorney Known
  if (repContext.is_known_attorney && repContext.attorney_name) {
    results.push(makeMod("attorney_known", "Attorney Known / Unknown", "claim_posture", "neutral", 0, repContext.attorney_name, `Attorney identified: ${repContext.attorney_name}. Pattern analysis available for calibration.`, [], repContext.attorney_name, "system_derived", "high", true, null));
  } else if (repContext.status === "represented") {
    results.push(makeMod("attorney_known", "Attorney Known / Unknown", "claim_posture", "neutral", 0, "Unknown attorney", "Claimant is represented but attorney is not identified.", [], "Unknown attorney", "system_derived", "low", true, null));
  } else {
    results.push(makeMod("attorney_known", "Attorney Known / Unknown", "claim_posture", "neutral", 0, "N/A", "Not applicable — claimant not represented.", [], "N/A", "system_derived", "high", false, "Claimant not represented"));
  }

  // 3. Policy Limits Sensitivity
  const maxCoverage = snap.policy_coverage.reduce((m, p) => Math.max(m, p.coverage_limit ?? 0), 0);
  if (maxCoverage === 0) {
    results.push(makeMod("policy_limits_sensitivity", "Policy Limits Sensitivity", "claim_posture", "neutral", 0, "Unknown", "No policy limits on file. Cannot assess limits sensitivity.", [], "No policy data", "system_derived", "missing", true, null));
  } else {
    const totalBilled = snap.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
    const ratio = totalBilled / maxCoverage;
    if (ratio > 0.75) {
      results.push(makeMod("policy_limits_sensitivity", "Policy Limits Sensitivity", "claim_posture", "negative", -8, `${Math.round(ratio * 100)}% of limits`, `Medical specials ($${totalBilled.toLocaleString()}) represent ${Math.round(ratio * 100)}% of policy limits ($${maxCoverage.toLocaleString()}). High limits sensitivity.`, [], `$${totalBilled.toLocaleString()} / $${maxCoverage.toLocaleString()}`, "system_derived", "high", true, null));
    } else {
      results.push(makeMod("policy_limits_sensitivity", "Policy Limits Sensitivity", "claim_posture", "neutral", 0, `${Math.round(ratio * 100)}% of limits`, `Medical specials at ${Math.round(ratio * 100)}% of limits. Adequate coverage headroom.`, [], `$${totalBilled.toLocaleString()} / $${maxCoverage.toLocaleString()}`, "system_derived", "high", true, null));
    }
  }

  // 4. Excess Exposure
  const hasSurgery = snap.clinical_flags.has_surgery;
  const hasPermanency = snap.clinical_flags.has_permanency_indicators;
  if (maxCoverage > 0 && (hasSurgery || hasPermanency)) {
    const totalBilled = snap.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
    if (totalBilled > maxCoverage * 0.6) {
      results.push(makeMod("excess_exposure", "Excess Exposure Indicator", "claim_posture", "negative", -6, "Elevated risk", `High-severity injuries (${hasSurgery ? "surgery" : "permanency"}) combined with specials near limits creates excess exposure risk.`, [], `Severity + ${Math.round((totalBilled / maxCoverage) * 100)}% limits utilization`, "system_derived", "moderate", true, null));
    } else {
      results.push(makeMod("excess_exposure", "Excess Exposure Indicator", "claim_posture", "neutral", 0, "Low risk", "Injury severity and specials do not suggest excess exposure.", [], "Adequate coverage", "system_derived", "high", true, null));
    }
  } else {
    results.push(makeMod("excess_exposure", "Excess Exposure Indicator", "claim_posture", "neutral", 0, "N/A", maxCoverage === 0 ? "No policy data available." : "Injury profile does not suggest excess exposure risk.", [], "N/A", "system_derived", maxCoverage === 0 ? "low" : "high", false, maxCoverage === 0 ? "No policy data" : "Low severity profile"));
  }

  // 5. Credibility Concerns
  const credConcerns = concerns.filter(c => c.category === "credibility");
  if (credConcerns.length > 0) {
    const critical = credConcerns.filter(c => c.severity === "critical").length;
    const delta = -Math.min(10, credConcerns.length * 3 + critical * 3);
    results.push(makeMod("credibility_concerns", "Claimant Credibility Concerns", "claim_posture", "negative", delta, `${credConcerns.length} concern(s)`, `${credConcerns.length} credibility concern(s) flagged (${critical} critical). ${critical > 0 ? "Significant credibility risk." : "Moderate credibility considerations."}`, credConcerns.map(c => c.id), `${credConcerns.length} credibility issues`, "system_derived", critical > 0 ? "moderate" : "high", true, null));
  } else {
    results.push(makeMod("credibility_concerns", "Claimant Credibility Concerns", "claim_posture", "neutral", 0, "None", "No claimant credibility concerns flagged.", [], "No credibility issues", "system_derived", "high", true, null));
  }

  return results;
}

// ─── Venue Modifiers ───────────────────────────────────

function computeVenueModifiers(snap: EvaluateIntakeSnapshot): ModifierRecord[] {
  const results: ModifierRecord[] = [];
  const state = snap.venue_jurisdiction.jurisdiction_state.value;
  const county = snap.venue_jurisdiction.venue_county.value;

  // 1. Venue Severity Tier
  if (!state) {
    results.push(makeMod("venue_severity_tier", "Venue Severity Tier", "venue_forum", "neutral", 0, "Unknown", "Jurisdiction state not specified. Cannot determine venue tier.", [], "No jurisdiction data", "system_derived", "missing", true, null));
  } else {
    const venue = VENUE_TIERS[state] ?? NEUTRAL_VENUE;
    const dir: ModifierDirection = venue.magnitude > 0 ? "positive" : venue.magnitude < 0 ? "negative" : "neutral";
    results.push(makeMod("venue_severity_tier", "Venue Severity Tier", "venue_forum", dir, venue.magnitude, venue.tier.replace(/_/g, " "), `${venue.label}.${county ? ` County: ${county}.` : ""}`, [], `${state}${county ? ` / ${county}` : ""}`, "system_derived", "moderate", true, null));
  }

  // 2. Venue Environment
  if (state) {
    const venue = VENUE_TIERS[state] ?? NEUTRAL_VENUE;
    const envDir: ModifierDirection = venue.tier === "plaintiff_friendly" ? "positive" : venue.tier === "defense_friendly" ? "negative" : "neutral";
    const envMag = venue.tier === "plaintiff_friendly" ? Math.min(8, Math.abs(venue.magnitude)) : venue.tier === "defense_friendly" ? -Math.min(8, Math.abs(venue.magnitude)) : 0;
    results.push(makeMod("venue_environment", "Plaintiff-Friendly vs Defense-Friendly", "venue_forum", envDir, envMag, venue.tier.replace(/_/g, " "), `${state} is classified as a ${venue.tier.replace(/_/g, " ")} environment for personal injury claims.`, [], venue.tier.replace(/_/g, " "), "system_derived", "moderate", true, null));
  } else {
    results.push(makeMod("venue_environment", "Plaintiff-Friendly vs Defense-Friendly", "venue_forum", "neutral", 0, "Unknown", "Venue environment cannot be determined without jurisdiction.", [], "Unknown", "system_derived", "missing", true, null));
  }

  // 3. Internal Venue Notes
  results.push(makeMod("venue_notes", "Internal Venue Notes", "venue_forum", "neutral", 0, "None", "No internal venue notes available. This field supports manual adjuster observations.", [], "No notes", "system_derived", "low", false, "No internal venue notes on file"));

  return results;
}

// ─── Representation Context Extraction ─────────────────

function extractRepresentationContext(snap: EvaluateIntakeSnapshot): RepresentationContext {
  // Look for representation signals in upstream concerns
  const repConcerns = snap.upstream_concerns.filter(c =>
    /represent|attorney|counsel|lawyer|firm|retained|pro.?se|unrepresent/i.test(c.description)
  );

  let status: RepresentationContext["status"] = "unknown";
  let attorneyName: string | null = null;
  let firmName: string | null = null;

  for (const c of repConcerns) {
    if (/unrepresent|pro.?se|no.?attorney|no.?counsel/i.test(c.description)) {
      status = "unrepresented";
    } else if (/represent|attorney|counsel|retained|lawyer/i.test(c.description)) {
      status = "represented";
      // Try to extract attorney name
      const nameMatch = c.description.match(/(?:attorney|counsel|lawyer)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i);
      if (nameMatch) attorneyName = nameMatch[1];
      const firmMatch = c.description.match(/(?:firm|office)[:\s]+([A-Z][A-Za-z &,]+)/i);
      if (firmMatch) firmName = firmMatch[1];
    }
  }

  // Also check liability facts for attorney references
  if (status === "unknown") {
    const attFacts = snap.liability_facts.filter(f => /attorney|counsel|represent/i.test(f.fact_text));
    if (attFacts.length > 0) status = "represented";
  }

  return {
    status,
    attorney_name: attorneyName,
    firm_name: firmName,
    is_known_attorney: attorneyName !== null,
    retention_date: null,
    transitioned: false,
    source: "system_derived",
  };
}

// ─── Helpers ───────────────────────────────────────────

function makeMod(
  id: string,
  label: string,
  group: ModifierGroup,
  direction: ModifierDirection,
  effect_magnitude: number,
  current_value: string,
  explanation: string,
  evidence_refs: string[],
  evidence_summary: string,
  source: ModifierSource,
  confidence: ModifierConfidence,
  applied: boolean,
  skip_reason: string | null,
): ModifierRecord {
  return { id, label, group, direction, effect_magnitude, current_value, explanation, evidence_refs, evidence_summary, source, confidence, applied, skip_reason };
}

function fmtDelta(d: number): string {
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

// ─── Exports for testing ───────────────────────────────

export { extractRepresentationContext };
