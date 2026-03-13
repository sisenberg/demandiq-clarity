/**
 * EvaluateIQ — Factor Scoring Engine
 *
 * Scores all active factors from the registry against an intake snapshot.
 * Produces a FactorScoringResult with per-factor scores, layer summaries,
 * ranked driver/suppressor/uncertainty lists, and gate pass/fail status.
 *
 * Each scored factor includes:
 *  - structured evidence citations
 *  - reviewer confirmation state (ai_scored by default)
 *  - extraction confidence metadata
 *  - unresolved issue flags
 *  - suppression state for missing prerequisites
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type {
  FactorDefinition,
  FactorDirection,
  FactorLayer,
  FactorScoringResult,
  ScoredFactor,
  LayerSummary,
  RankedFactorSummary,
  FactorCitation,
  FactorConfirmation,
  FactorExtractionConfidence,
  FactorIssueFlag,
} from "@/types/factor-taxonomy";
import { FACTOR_LAYER_META } from "@/types/factor-taxonomy";
import { getActiveFactors } from "./factorRegistry";

// ─── Default metadata factories ───────────────────────

const DEFAULT_CONFIRMATION: FactorConfirmation = {
  state: "ai_scored",
  reviewed_by: null,
  reviewed_at: null,
  adjustment_notes: null,
};

function makeExtractionConfidence(
  snap: EvaluateIntakeSnapshot,
  field: string
): FactorExtractionConfidence | null {
  // Derive confidence from completeness score as a proxy
  const score = snap.overall_completeness_score;
  const label = score >= 80 ? "high" as const : score >= 50 ? "medium" as const : score > 0 ? "low" as const : "unknown" as const;
  return { score, label, source_field: field };
}

function buildIssueFlags(
  def: FactorDefinition,
  snap: EvaluateIntakeSnapshot,
  applicable: boolean,
  suppressed: boolean,
): FactorIssueFlag[] {
  const flags: FactorIssueFlag[] = [];
  let counter = 0;

  if (suppressed) {
    flags.push({
      id: `${def.id}_suppressed_${counter++}`,
      issue_type: "suppressed_prerequisite",
      description: `Factor "${def.name}" suppressed: prerequisite data unavailable.`,
      severity: "medium",
    });
  }

  // Check for missing required evidence
  if (def.evidence_requirement === "required" && applicable) {
    const missingDeps = def.input_dependencies.filter(dep => {
      const val = (snap as any)[dep];
      if (val === undefined || val === null) return true;
      if (Array.isArray(val) && val.length === 0) return true;
      return false;
    });
    for (const dep of missingDeps) {
      flags.push({
        id: `${def.id}_gap_${counter++}`,
        issue_type: "data_gap",
        description: `Required input "${dep}" is missing or empty for factor "${def.name}".`,
        severity: "high",
      });
    }
  }

  // Check for upstream conflicts relevant to this factor
  const relevantConcerns = snap.upstream_concerns.filter(c =>
    c.severity === "critical" &&
    def.input_dependencies.some(dep =>
      c.category === dep || c.description.toLowerCase().includes(dep.replace(/_/g, " "))
    )
  );
  for (const concern of relevantConcerns) {
    flags.push({
      id: `${def.id}_conflict_${counter++}`,
      issue_type: "conflict",
      description: concern.description,
      severity: concern.severity === "critical" ? "critical" : "high",
    });
  }

  return flags;
}

// ─── Main Entry Point ──────────────────────────────────

export function scoreAllFactors(snapshot: EvaluateIntakeSnapshot): FactorScoringResult {
  const definitions = getActiveFactors();

  // ── Governance enforcement: validate no forbidden factors leak through ──
  // Import is lazy to avoid circular deps in test environments
  const { enforceGovernancePolicy } = require("./evaluateGovernanceEngine");
  enforceGovernancePolicy(definitions);

  const scored: ScoredFactor[] = definitions.map(def => scoreFactor(def, snapshot));

  // Layer summaries
  const layers: FactorLayer[] = [0, 1, 2, 3, 4, 5];
  const layerSummaries: LayerSummary[] = layers.map(layer => {
    const layerFactors = scored.filter(f => f.definition.layer === layer);
    const applicable = layerFactors.filter(f => f.applicable && !f.suppressed);
    const scores = applicable.map(f => f.score);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

    // Gate status for layer 0
    let gatePassed: boolean | null = null;
    if (layer === 0) {
      const hardGates = ["gate_liability_posture", "gate_medical_review_complete", "gate_chronology_available"];
      gatePassed = hardGates.every(gateId => {
        const gate = scored.find(f => f.factor_id === gateId);
        return gate ? gate.score >= 1 : false;
      });
    }

    // Net direction
    const expanders = applicable.filter(f => f.direction === "expander").length;
    const reducers = applicable.filter(f => f.direction === "reducer").length;
    const netDir: FactorDirection = expanders > reducers ? "expander" : reducers > expanders ? "reducer" : "neutral";

    const suppressedCount = layerFactors.filter(f => f.suppressed).length;
    const issueCount = layerFactors.reduce((sum, f) => sum + f.issue_flags.length, 0);

    return {
      layer,
      label: FACTOR_LAYER_META[layer].label,
      factor_count: layerFactors.length,
      scored_count: applicable.length,
      suppressed_count: suppressedCount,
      gate_passed: gatePassed,
      avg_score: avgScore,
      net_direction: netDir,
      issue_count: issueCount,
    };
  });

  const gateLayer = layerSummaries.find(l => l.layer === 0);
  const gateFailures = scored
    .filter(f => f.definition.layer === 0 && f.applicable && f.score < 1)
    .map(f => f.definition.name);

  // ── Ranked summaries ────────────────────────
  const applicableScored = scored.filter(f => f.applicable && !f.suppressed);

  const toRanked = (f: ScoredFactor): RankedFactorSummary => ({
    factor_id: f.factor_id,
    factor_name: f.definition.name,
    layer: f.definition.layer,
    score: f.score,
    direction: f.direction,
    narrative: f.narrative,
    confidence: f.confidence,
    issue_count: f.issue_flags.length,
  });

  // Top drivers: expanders sorted by score desc, top 5
  const topDrivers = applicableScored
    .filter(f => f.direction === "expander" && f.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(toRanked);

  // Top suppressors: reducers sorted by score asc (lowest = strongest reducer)
  const topSuppressors = applicableScored
    .filter(f => f.direction === "reducer" || f.direction === "constraint")
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map(toRanked);

  // Top uncertainty: low confidence or high issue count
  const topUncertainty = applicableScored
    .filter(f => f.confidence === "low" || f.issue_flags.length > 0)
    .sort((a, b) => {
      const aWeight = (a.confidence === "low" ? 3 : a.confidence === "moderate" ? 1 : 0) + a.issue_flags.length;
      const bWeight = (b.confidence === "low" ? 3 : b.confidence === "moderate" ? 1 : 0) + b.issue_flags.length;
      return bWeight - aWeight;
    })
    .slice(0, 5)
    .map(toRanked);

  const totalIssues = scored.reduce((sum, f) => sum + f.issue_flags.length, 0);

  return {
    scored_factors: scored,
    layer_summaries: layerSummaries,
    gates_passed: gateLayer?.gate_passed ?? false,
    gate_failures: gateFailures,
    applicable_count: scored.filter(f => f.applicable).length,
    evidenced_count: scored.filter(f => f.evidence_ref_ids.length > 0).length,
    suppressed_count: scored.filter(f => f.suppressed).length,
    total_issue_count: totalIssues,
    top_drivers: topDrivers,
    top_suppressors: topSuppressors,
    top_uncertainty_contributors: topUncertainty,
  };
}

// ─── Individual Factor Scoring ─────────────────────────

function scoreFactor(def: FactorDefinition, snap: EvaluateIntakeSnapshot): ScoredFactor {
  // Check prerequisite suppression
  const suppression = checkSuppression(def, snap);
  if (suppression) {
    const issueFlags = buildIssueFlags(def, snap, false, true);
    return {
      factor_id: def.id,
      definition: def,
      raw_input: "N/A (suppressed)",
      score: 0,
      direction: "neutral",
      narrative: `Factor "${def.name}" suppressed: ${suppression}`,
      evidence_ref_ids: [],
      citations: [],
      applicable: false,
      inapplicable_reason: suppression,
      confidence: "low",
      confirmation: { ...DEFAULT_CONFIRMATION },
      extraction_confidence: null,
      issue_flags: issueFlags,
      suppressed: true,
      suppression_reason: suppression,
    };
  }

  const scorer = FACTOR_SCORERS[def.id];
  if (!scorer) {
    return {
      factor_id: def.id,
      definition: def,
      raw_input: "N/A",
      score: 0,
      direction: "neutral",
      narrative: `Factor "${def.name}" has no scoring implementation.`,
      evidence_ref_ids: [],
      citations: [],
      applicable: false,
      inapplicable_reason: "No scoring function registered.",
      confidence: "low",
      confirmation: { ...DEFAULT_CONFIRMATION },
      extraction_confidence: null,
      issue_flags: [{
        id: `${def.id}_no_scorer`,
        issue_type: "data_gap",
        description: `No scoring function registered for "${def.name}".`,
        severity: "medium",
      }],
      suppressed: false,
      suppression_reason: null,
    };
  }
  return scorer(def, snap);
}

// ─── Suppression check ────────────────────────────────

function checkSuppression(def: FactorDefinition, snap: EvaluateIntakeSnapshot): string | null {
  // Layer 1+ factors suppressed if layer 0 gates have critical failures
  if (def.layer >= 1) {
    const criticalConcerns = snap.upstream_concerns.filter(c => c.severity === "critical").length;
    if (criticalConcerns >= 3) {
      return `${criticalConcerns} critical upstream concerns — factor scoring deferred.`;
    }
  }
  return null;
}

// ─── Scorer Type ───────────────────────────────────────

type FactorScorer = (def: FactorDefinition, snap: EvaluateIntakeSnapshot) => ScoredFactor;

function makeResult(
  def: FactorDefinition,
  snap: EvaluateIntakeSnapshot,
  overrides: Partial<ScoredFactor> & { raw_input: string; score: number; narrative: string },
): ScoredFactor {
  const applicable = overrides.applicable ?? true;
  const issueFlags = buildIssueFlags(def, snap, applicable, false);
  const primaryDep = def.input_dependencies[0] ?? null;

  return {
    factor_id: def.id,
    definition: def,
    raw_input: overrides.raw_input,
    score: overrides.score,
    direction: overrides.direction ?? def.default_direction,
    narrative: overrides.narrative,
    evidence_ref_ids: overrides.evidence_ref_ids ?? [],
    citations: overrides.citations ?? [],
    applicable,
    inapplicable_reason: overrides.inapplicable_reason ?? null,
    confidence: overrides.confidence ?? "moderate",
    confirmation: overrides.confirmation ?? { ...DEFAULT_CONFIRMATION },
    extraction_confidence: overrides.extraction_confidence ?? makeExtractionConfidence(snap, primaryDep),
    issue_flags: [...issueFlags, ...(overrides.issue_flags ?? [])],
    suppressed: false,
    suppression_reason: null,
  };
}

// ─── Citation helper ──────────────────────────────────

function citationsFromProvenance(
  items: Array<{ provenance: { evidence_ref_ids: string[]; completeness: string } }>,
  relevance: "direct" | "corroborating" | "contextual" = "direct",
): FactorCitation[] {
  return items
    .flatMap(item =>
      item.provenance.evidence_ref_ids.map(refId => ({
        source_document_id: null,
        source_page: null,
        quoted_text: refId, // ref ID as placeholder — real citations will be resolved downstream
        relevance_type: relevance,
      }))
    )
    .slice(0, 10); // cap to prevent bloat
}

// ─── Scorer Registry ───────────────────────────────────

const FACTOR_SCORERS: Record<string, FactorScorer> = {
  // ── Layer 0 ──────────────────────────────
  gate_liability_posture: (def, snap) => {
    const has = snap.liability_facts.length > 0;
    return makeResult(def, snap, {
      raw_input: `${snap.liability_facts.length} liability facts`,
      score: has ? 1 : 0,
      direction: "neutral",
      narrative: has
        ? `Liability posture available with ${snap.liability_facts.length} documented fact(s).`
        : "No liability facts present. Liability posture cannot be assessed.",
      citations: has ? snap.liability_facts.map(f => ({
        source_document_id: null,
        source_page: null,
        quoted_text: f.fact_text,
        relevance_type: "direct" as const,
      })).slice(0, 5) : [],
      confidence: has ? "high" : "low",
    });
  },

  gate_medical_review_complete: (def, snap) => {
    const score = snap.overall_completeness_score >= 70 ? 1 : 0;
    return makeResult(def, snap, {
      raw_input: `${snap.overall_completeness_score}%`,
      score,
      direction: "neutral",
      narrative: `Medical review completeness: ${snap.overall_completeness_score}%. ${score ? "Meets minimum threshold." : "Below 70% threshold for full evaluation."}`,
      confidence: snap.overall_completeness_score >= 80 ? "high" : "moderate",
    });
  },

  gate_chronology_available: (def, snap) => {
    const count = snap.treatment_timeline.length;
    return makeResult(def, snap, {
      raw_input: `${count} entries`,
      score: count >= 1 ? 1 : 0,
      direction: "neutral",
      narrative: count >= 1
        ? `Treatment chronology has ${count} entries.`
        : "No treatment chronology entries. Cannot assess treatment pattern.",
      confidence: count >= 3 ? "high" : count >= 1 ? "moderate" : "low",
    });
  },

  gate_bills_reviewed: (def, snap) => {
    const total = snap.medical_billing.length;
    const reviewed = snap.medical_billing.filter(b => b.reviewer_recommended_amount !== null).length;
    return makeResult(def, snap, {
      raw_input: `${reviewed}/${total}`,
      score: total > 0 ? 1 : 0,
      direction: "neutral",
      narrative: total > 0
        ? `${reviewed}/${total} bills have reviewer recommendations.`
        : "No medical billing entries present.",
      citations: citationsFromProvenance(snap.medical_billing),
      confidence: reviewed === total && total > 0 ? "high" : "moderate",
    });
  },

  gate_unresolved_conflicts: (def, snap) => {
    const critical = snap.upstream_concerns.filter(c => c.severity === "critical").length;
    return makeResult(def, snap, {
      raw_input: `${critical} critical, ${snap.upstream_concerns.length} total`,
      score: critical === 0 ? 1 : 0,
      direction: "neutral",
      narrative: critical === 0
        ? `No critical unresolved concerns. ${snap.upstream_concerns.length} total upstream concern(s).`
        : `${critical} critical unresolved concern(s) present. Resolution recommended before evaluation.`,
      confidence: critical === 0 ? "high" : "low",
      issue_flags: snap.upstream_concerns
        .filter(c => c.severity === "critical")
        .map((c, i) => ({
          id: `gate_conflicts_${i}`,
          issue_type: "conflict" as const,
          description: c.description,
          severity: "critical" as const,
        })),
    });
  },

  gate_benchmark_data: (def, snap) => {
    const hasInjury = snap.injuries.length > 0;
    const hasJurisdiction = !!snap.venue_jurisdiction.jurisdiction_state.value;
    const hasBilling = snap.medical_billing.length > 0;
    const met = hasInjury && hasJurisdiction && hasBilling;
    const missing = [!hasInjury && "injury data", !hasJurisdiction && "jurisdiction", !hasBilling && "billing data"].filter(Boolean);
    return makeResult(def, snap, {
      raw_input: `injury:${hasInjury}, jurisdiction:${hasJurisdiction}, billing:${hasBilling}`,
      score: met ? 1 : 0,
      direction: "neutral",
      narrative: met
        ? "Minimum benchmark data present (injury, jurisdiction, billing)."
        : `Missing benchmark prerequisites: ${missing.join(", ")}.`,
      confidence: met ? "high" : "low",
      issue_flags: missing.map((m, i) => ({
        id: `gate_benchmark_${i}`,
        issue_type: "data_gap" as const,
        description: `Missing: ${m}`,
        severity: "high" as const,
      })),
    });
  },

  // ── Layer 1 ──────────────────────────────
  injury_severity_class: (def, snap) => {
    if (snap.injuries.length === 0) {
      return makeResult(def, snap, {
        raw_input: "0 injuries",
        score: 0,
        applicable: false,
        inapplicable_reason: "No injuries",
        narrative: "No injuries documented.",
        confidence: "low",
      });
    }
    const severityMap: Record<string, number> = { mild: 1, moderate: 2, significant: 3, severe: 4, catastrophic: 5 };
    const maxSev = Math.max(...snap.injuries.map(i => severityMap[i.severity.toLowerCase()] ?? 2));
    const label = Object.entries(severityMap).find(([, v]) => v === maxSev)?.[0] ?? "moderate";
    return makeResult(def, snap, {
      raw_input: `${snap.injuries.length} injuries, max severity: ${label}`,
      score: maxSev,
      direction: maxSev >= 3 ? "expander" : "neutral",
      narrative: `Most severe injury classified as ${label} (${maxSev}/5). ${snap.injuries.length} total injuries documented.`,
      evidence_ref_ids: snap.injuries.flatMap(i => i.provenance.evidence_ref_ids),
      citations: citationsFromProvenance(snap.injuries),
      confidence: "high",
    });
  },

  objective_medical_support: (def, snap) => {
    let score = 0;
    const details: string[] = [];
    if (snap.clinical_flags.has_advanced_imaging) { score += 2; details.push("Advanced imaging documented"); }
    if (snap.injuries.some(i => /tear|rupture|herniat|stenosis|fractur/i.test(i.diagnosis_description))) { score += 2; details.push("Structural pathology in diagnoses"); }
    if (snap.clinical_flags.has_impairment_rating) { score += 1; details.push("Impairment rating present"); }
    score = Math.min(5, score);
    return makeResult(def, snap, {
      raw_input: details.join("; ") || "No objective findings",
      score,
      direction: score >= 3 ? "expander" : score >= 1 ? "neutral" : "reducer",
      narrative: `Objective medical support: ${score}/5. ${details.join(". ") || "No objective diagnostic findings documented."}`,
      evidence_ref_ids: snap.clinical_flags.provenance.evidence_ref_ids,
      citations: citationsFromProvenance(snap.injuries, "corroborating"),
      confidence: score >= 3 ? "high" : "moderate",
    });
  },

  treatment_invasiveness: (def, snap) => {
    let score = 1;
    if (snap.treatment_timeline.length === 0) score = 0;
    if (snap.clinical_flags.has_injections) score = Math.max(score, 3);
    if (snap.clinical_flags.has_surgery) score = 5;
    return makeResult(def, snap, {
      raw_input: `surgery:${snap.clinical_flags.has_surgery}, injections:${snap.clinical_flags.has_injections}`,
      score,
      direction: score >= 3 ? "expander" : "neutral",
      narrative: `Treatment invasiveness: ${score}/5. ${snap.clinical_flags.has_surgery ? "Surgical intervention documented." : snap.clinical_flags.has_injections ? "Injection-level treatment documented." : "Conservative treatment only."}`,
      confidence: "high",
    });
  },

  permanency_impairment: (def, snap) => {
    let score = 0;
    if (snap.clinical_flags.has_permanency_indicators) score = 2;
    if (snap.clinical_flags.has_impairment_rating) score = Math.max(score, 3);
    if (snap.clinical_flags.has_permanency_indicators && snap.clinical_flags.has_impairment_rating) score = 4;
    return makeResult(def, snap, {
      raw_input: `permanency:${snap.clinical_flags.has_permanency_indicators}, rating:${snap.clinical_flags.has_impairment_rating}`,
      score,
      direction: score >= 2 ? "expander" : "neutral",
      narrative: score > 0
        ? `Permanency score: ${score}/5. ${snap.clinical_flags.has_impairment_rating ? "Formal impairment rating present." : "Permanency indicators noted."}`
        : "No permanency indicators or impairment rating documented.",
      confidence: score >= 3 ? "high" : score >= 1 ? "moderate" : "high",
    });
  },

  // ── Layer 2 ──────────────────────────────
  treatment_duration: (def, snap) => {
    const dates = snap.treatment_timeline.map(t => t.treatment_date).filter((d): d is string => d != null).map(d => new Date(d).getTime()).filter(t => !isNaN(t));
    if (dates.length < 2) {
      return makeResult(def, snap, {
        raw_input: "Insufficient dates",
        score: dates.length === 1 ? 1 : 0,
        direction: "neutral",
        narrative: "Insufficient treatment dates to assess duration.",
        applicable: dates.length > 0,
        inapplicable_reason: dates.length === 0 ? "No treatment dates" : null,
        confidence: "low",
      });
    }
    const days = Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000);
    const score = days > 365 ? 5 : days > 180 ? 4 : days > 90 ? 3 : days > 30 ? 2 : 1;
    return makeResult(def, snap, {
      raw_input: `${days} days`,
      score,
      direction: score >= 4 ? "expander" : score <= 1 ? "reducer" : "neutral",
      narrative: `Treatment duration: ${days} days (${score}/5).`,
      confidence: "high",
    });
  },

  treatment_continuity: (def, snap) => {
    const gaps = snap.upstream_concerns.filter(c => c.category === "gap");
    const score = gaps.length === 0 ? 5 : gaps.length === 1 ? 3 : gaps.length <= 3 ? 2 : 1;
    return makeResult(def, snap, {
      raw_input: `${gaps.length} gaps`,
      score,
      direction: score >= 4 ? "expander" : score <= 2 ? "reducer" : "neutral",
      narrative: gaps.length === 0
        ? "Treatment continuity: 5/5. No treatment gaps identified."
        : `Treatment continuity: ${score}/5. ${gaps.length} gap(s) identified.`,
      confidence: "high",
    });
  },

  gap_quality: (def, snap) => {
    const gaps = snap.upstream_concerns.filter(c => c.category === "gap");
    if (gaps.length === 0) {
      return makeResult(def, snap, {
        raw_input: "No gaps",
        score: 5,
        direction: "neutral",
        narrative: "No treatment gaps to assess.",
        applicable: false,
        inapplicable_reason: "No gaps identified",
        confidence: "high",
      });
    }
    const explained = gaps.filter(g => g.description.length > 20).length;
    const ratio = explained / gaps.length;
    const score = Math.round(ratio * 5);
    return makeResult(def, snap, {
      raw_input: `${explained}/${gaps.length} explained`,
      score,
      direction: score <= 2 ? "reducer" : "neutral",
      narrative: `Gap quality: ${score}/5. ${explained}/${gaps.length} gaps have explanations.`,
      confidence: "moderate",
    });
  },

  referral_chain_coherence: (def, snap) => {
    const providers = snap.providers.length;
    const specialties = new Set(snap.providers.map(p => p.specialty).filter(Boolean)).size;
    const score = providers >= 2 && specialties >= 2 ? 4 : providers >= 2 ? 3 : providers === 1 ? 2 : 0;
    return makeResult(def, snap, {
      raw_input: `${providers} providers, ${specialties} specialties`,
      score,
      direction: score >= 4 ? "expander" : score <= 1 ? "reducer" : "neutral",
      narrative: `Referral chain: ${score}/5. ${providers} providers across ${specialties} specialties.`,
      citations: citationsFromProvenance(snap.providers, "contextual"),
      confidence: "moderate",
    });
  },

  reviewer_reasonableness_signal: (def, snap) => {
    const concerns = snap.upstream_concerns.filter(c => c.category === "credibility" || c.category === "compliance");
    const score = concerns.length === 0 ? 5 : concerns.length <= 2 ? 3 : 1;
    return makeResult(def, snap, {
      raw_input: `${concerns.length} reasonableness concerns`,
      score,
      direction: score <= 2 ? "reducer" : score >= 4 ? "expander" : "neutral",
      narrative: concerns.length === 0
        ? "Reviewer reasonableness: 5/5. No concerns flagged."
        : `Reviewer reasonableness: ${score}/5. ${concerns.length} concern(s) flagged.`,
      confidence: "moderate",
    });
  },

  // ── Layer 3 ──────────────────────────────
  work_impact: (def, snap) => {
    const wages = snap.wage_loss.total_lost_wages.value;
    const score = wages > 75000 ? 5 : wages > 30000 ? 4 : wages > 10000 ? 3 : wages > 2000 ? 2 : wages > 0 ? 1 : 0;
    return makeResult(def, snap, {
      raw_input: `$${wages.toLocaleString()}`,
      score,
      direction: score >= 2 ? "expander" : "neutral",
      narrative: wages > 0
        ? `Work impact: ${score}/5. $${wages.toLocaleString()} in documented wage loss.`
        : "Work impact: 0/5. No documented wage loss.",
      confidence: wages > 0 ? "high" : "moderate",
    });
  },

  adl_impact: (def, snap) => {
    const hasAdl = snap.upstream_concerns.some(c => /adl|daily.?living|functional/i.test(c.description));
    const score = hasAdl ? 3 : snap.clinical_flags.has_permanency_indicators ? 2 : 0;
    return makeResult(def, snap, {
      raw_input: hasAdl ? "ADL impact documented" : "No ADL documentation",
      score,
      direction: score >= 2 ? "expander" : "neutral",
      narrative: score > 0
        ? `ADL impact: ${score}/5. ${hasAdl ? "Activities of daily living impact documented." : "Inferred from permanency indicators."}`
        : "ADL impact: 0/5. No documented ADL restrictions.",
      confidence: hasAdl ? "moderate" : "low",
    });
  },

  loss_of_enjoyment: (def, snap) => {
    const hasLoe = snap.upstream_concerns.some(c => /enjoy|recreation|hobby|activit/i.test(c.description));
    const score = hasLoe ? 2 : 0;
    return makeResult(def, snap, {
      raw_input: hasLoe ? "Loss of enjoyment noted" : "Not documented",
      score,
      direction: score > 0 ? "expander" : "neutral",
      narrative: score > 0
        ? "Loss of enjoyment: 2/5. Activity restrictions noted in records."
        : "Loss of enjoyment: 0/5. No documented activity restrictions.",
      confidence: "low",
    });
  },

  symptom_persistence: (def, snap) => {
    const hasPermanency = snap.clinical_flags.has_permanency_indicators;
    const longTreatment = snap.treatment_timeline.length > 20;
    const score = hasPermanency ? 4 : longTreatment ? 3 : snap.treatment_timeline.length > 10 ? 2 : 1;
    return makeResult(def, snap, {
      raw_input: `permanency:${hasPermanency}, visits:${snap.treatment_timeline.length}`,
      score,
      direction: score >= 3 ? "expander" : "neutral",
      narrative: `Symptom persistence: ${score}/5. ${hasPermanency ? "Permanency indicators suggest ongoing symptoms." : `${snap.treatment_timeline.length} treatment visits documented.`}`,
      confidence: "moderate",
    });
  },

  // ── Layer 4 ──────────────────────────────
  past_medical_specials: (def, snap) => {
    const total = snap.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
    const score = total > 100000 ? 5 : total > 50000 ? 4 : total > 15000 ? 3 : total > 5000 ? 2 : total > 0 ? 1 : 0;
    return makeResult(def, snap, {
      raw_input: `$${total.toLocaleString()}`,
      score,
      direction: "expander",
      narrative: `Past medical specials: $${total.toLocaleString()} (${score}/5).`,
      evidence_ref_ids: snap.medical_billing.flatMap(b => b.provenance.evidence_ref_ids),
      citations: citationsFromProvenance(snap.medical_billing),
      confidence: "high",
    });
  },

  future_medical_exposure: (def, snap) => {
    const amt = snap.future_treatment.future_medical_estimate.value;
    const score = amt > 100000 ? 5 : amt > 50000 ? 4 : amt > 15000 ? 3 : amt > 5000 ? 2 : amt > 0 ? 1 : 0;
    return makeResult(def, snap, {
      raw_input: `$${amt.toLocaleString()}`,
      score,
      direction: score > 0 ? "expander" : "neutral",
      narrative: amt > 0
        ? `Future medical exposure: $${amt.toLocaleString()} (${score}/5).`
        : "No future medical exposure estimated.",
      confidence: amt > 0 ? "moderate" : "high",
    });
  },

  wage_loss_documented: (def, snap) => {
    const amt = snap.wage_loss.total_lost_wages.value;
    const score = amt > 75000 ? 5 : amt > 30000 ? 4 : amt > 10000 ? 3 : amt > 2000 ? 2 : amt > 0 ? 1 : 0;
    return makeResult(def, snap, {
      raw_input: `$${amt.toLocaleString()}`,
      score,
      direction: score > 0 ? "expander" : "neutral",
      narrative: amt > 0
        ? `Wage loss: $${amt.toLocaleString()} (${score}/5).`
        : "No documented wage loss.",
      confidence: amt > 0 ? "high" : "high",
    });
  },

  property_damage_context: (def, snap) => {
    return makeResult(def, snap, {
      raw_input: "Not available in current snapshot",
      score: 0,
      direction: "neutral",
      narrative: "Property damage context: not available in current intake snapshot. Contextual factor only — does not directly influence corridor.",
      applicable: false,
      inapplicable_reason: "Property damage data not included in intake snapshot.",
      confidence: "low",
    });
  },

  // ── Layer 5 ──────────────────────────────
  causation_apportionment: (def, snap) => {
    const preExisting = snap.injuries.filter(i => i.is_pre_existing).length;
    const total = snap.injuries.length;
    if (total === 0) return makeResult(def, snap, { raw_input: "No injuries", score: 5, direction: "neutral", narrative: "No injuries to assess causation.", applicable: false, inapplicable_reason: "No injuries", confidence: "low" });
    const ratio = preExisting / total;
    const score = ratio === 0 ? 5 : ratio < 0.25 ? 4 : ratio < 0.5 ? 3 : ratio < 0.75 ? 2 : 1;
    return makeResult(def, snap, {
      raw_input: `${preExisting}/${total} pre-existing`,
      score,
      direction: score <= 3 ? "reducer" : "neutral",
      narrative: preExisting === 0
        ? "Causation: 5/5. No pre-existing conditions complicate attribution."
        : `Causation: ${score}/5. ${preExisting}/${total} injuries are pre-existing, creating apportionment risk.`,
      citations: citationsFromProvenance(snap.injuries.filter(i => i.is_pre_existing)),
      confidence: "high",
    });
  },

  comparative_negligence: (def, snap) => {
    const pct = snap.comparative_negligence.claimant_negligence_percentage.value;
    if (pct === null) return makeResult(def, snap, { raw_input: "Not assessed", score: 0, direction: "neutral", narrative: "Comparative negligence not assessed.", applicable: false, inapplicable_reason: "No comparative negligence data", confidence: "high" });
    return makeResult(def, snap, {
      raw_input: `${pct}%`,
      score: pct,
      direction: pct > 0 ? "reducer" : "neutral",
      narrative: pct > 0
        ? `Comparative negligence: ${pct}%. Recovery reduced proportionally.`
        : "No comparative negligence assessed.",
      confidence: "high",
    });
  },

  coverage_collectibility: (def, snap) => {
    const limit = snap.policy_coverage.reduce((max, p) => Math.max(max, p.coverage_limit ?? 0), 0);
    return makeResult(def, snap, {
      raw_input: limit > 0 ? `$${limit.toLocaleString()}` : "Unknown",
      score: limit > 0 ? limit : 0,
      direction: "constraint",
      narrative: limit > 0
        ? `Policy limits: $${limit.toLocaleString()}. Corridor capped accordingly.`
        : "Policy limits unknown. No coverage constraint applied.",
      confidence: limit > 0 ? "high" : "low",
    });
  },

  venue_jurisdiction_adjustment: (def, snap) => {
    const state = snap.venue_jurisdiction.jurisdiction_state.value;
    return makeResult(def, snap, {
      raw_input: state || "Unknown",
      score: 1,
      direction: "neutral",
      narrative: state
        ? `Venue: ${state}. Default 1.0x multiplier applied (calibration data will refine).`
        : "Jurisdiction unknown. Default multiplier applied.",
      confidence: state ? "moderate" : "low",
    });
  },

  documentation_confidence: (def, snap) => {
    const pct = snap.overall_completeness_score;
    const score = pct >= 90 ? 5 : pct >= 75 ? 4 : pct >= 60 ? 3 : pct >= 40 ? 2 : 1;
    return makeResult(def, snap, {
      raw_input: `${pct}%`,
      score,
      direction: score <= 2 ? "reducer" : score >= 4 ? "expander" : "neutral",
      narrative: `Documentation confidence: ${score}/5. Overall completeness: ${pct}%.`,
      confidence: "high",
    });
  },
};
