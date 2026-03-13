/**
 * EvaluateIQ — Documentation Sufficiency Engine
 *
 * Scores 8 documentation subcomponents to produce a first-class
 * Documentation Sufficiency Score that distinguishes weak claims
 * from weak documentation support.
 *
 * Subcomponents:
 *  1. Diagnosis Specificity
 *  2. Objective Support Sufficiency
 *  3. Chronology Completeness
 *  4. Treatment Gap Explanation
 *  5. Functional Limitation Specificity
 *  6. Work-Impact Support
 *  7. Permanency / Impairment Support
 *  8. Future Care Support
 *
 * Engine version: 1.0.0
 */

import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

export const DOC_SUFFICIENCY_ENGINE_VERSION = "1.0.0";

// ─── Types ─────────────────────────────────────────────

export type SufficiencyLabel = "strong" | "adequate" | "limited" | "insufficient";
export type SufficiencyImpact = "none" | "widens_range" | "suppresses_midpoint" | "reduces_confidence" | "excludes_component";

export interface DocSubcomponentScore {
  key: DocSubcomponentKey;
  label: string;
  score: number; // 0–100
  sufficiency: SufficiencyLabel;
  /** Plain-language finding for adjusters */
  finding: string;
  /** What is missing or weak */
  gaps: string[];
  /** How this affects the valuation */
  impact: SufficiencyImpact;
  impact_description: string;
  /** Evidence inputs considered */
  inputs: string[];
}

export type DocSubcomponentKey =
  | "diagnosis_specificity"
  | "objective_support"
  | "chronology_completeness"
  | "treatment_gap_explanation"
  | "functional_limitation"
  | "work_impact"
  | "permanency_impairment"
  | "future_care";

export interface DocumentSufficiencyResult {
  engine_version: string;
  computed_at: string;
  overall_score: number; // 0–100
  overall_label: SufficiencyLabel;
  subcomponents: DocSubcomponentScore[];
  /** Plain-language findings for adjuster coaching */
  findings: string[];
  /** Aggregated gaps across all subcomponents */
  all_gaps: string[];
  /** How documentation affects valuation outputs */
  valuation_effects: ValuationEffect[];
  /** Number of subcomponents scoring ≤40 */
  critical_weakness_count: number;
}

export interface ValuationEffect {
  effect: SufficiencyImpact;
  label: string;
  description: string;
  triggered_by: DocSubcomponentKey[];
}

// ─── Scoring Weights ───────────────────────────────────
// Weights sum to 100 for easy normalization.

const SUBCOMPONENT_WEIGHTS: Record<DocSubcomponentKey, number> = {
  diagnosis_specificity: 18,
  objective_support: 18,
  chronology_completeness: 14,
  treatment_gap_explanation: 10,
  functional_limitation: 14,
  work_impact: 8,
  permanency_impairment: 10,
  future_care: 8,
};

// ─── Entry Point ───────────────────────────────────────

export function computeDocumentSufficiency(
  snapshot: EvaluateIntakeSnapshot,
): DocumentSufficiencyResult {
  const subs: DocSubcomponentScore[] = [
    scoreDiagnosisSpecificity(snapshot),
    scoreObjectiveSupport(snapshot),
    scoreChronologyCompleteness(snapshot),
    scoreTreatmentGapExplanation(snapshot),
    scoreFunctionalLimitation(snapshot),
    scoreWorkImpact(snapshot),
    scorePermanencyImpairment(snapshot),
    scoreFutureCare(snapshot),
  ];

  // Weighted average
  let weightedSum = 0;
  let weightTotal = 0;
  for (const sub of subs) {
    const w = SUBCOMPONENT_WEIGHTS[sub.key];
    weightedSum += sub.score * w;
    weightTotal += w;
  }
  const overall = Math.round(weightedSum / weightTotal);

  const findings = subs.filter(s => s.finding).map(s => s.finding);
  const all_gaps = subs.flatMap(s => s.gaps);
  const critical_weakness_count = subs.filter(s => s.score <= 40).length;

  const valuation_effects = deriveValuationEffects(subs);

  return {
    engine_version: DOC_SUFFICIENCY_ENGINE_VERSION,
    computed_at: new Date().toISOString(),
    overall_score: overall,
    overall_label: labelFromScore(overall),
    subcomponents: subs,
    findings,
    all_gaps,
    valuation_effects,
    critical_weakness_count,
  };
}

// ─── Subcomponent Scorers ──────────────────────────────

function scoreDiagnosisSpecificity(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const injuries = snap.injuries;
  if (injuries.length === 0) {
    return makeSub("diagnosis_specificity", "Diagnosis Specificity", 0,
      "No injuries documented. Valuation cannot proceed without diagnosis data.",
      ["No injury records in case file"],
      "excludes_component", "No diagnosis available to score.");
  }

  let total = 0;
  const gaps: string[] = [];
  const inputs: string[] = [];

  for (const inj of injuries) {
    let s = 0;
    inputs.push(`${inj.body_part}: ${inj.diagnosis_description}`);

    // Has ICD code
    if (inj.diagnosis_code && inj.diagnosis_code.length > 3) s += 35;
    else if (inj.diagnosis_code) { s += 15; gaps.push(`${inj.body_part}: ICD code lacks specificity (${inj.diagnosis_code})`); }
    else gaps.push(`${inj.body_part}: Missing diagnosis code`);

    // Has description
    if (inj.diagnosis_description && inj.diagnosis_description.length > 10) s += 30;
    else if (inj.diagnosis_description) s += 15;
    else gaps.push(`${inj.body_part}: Missing diagnosis description`);

    // Severity rated
    if (inj.severity && inj.severity !== "unknown") s += 20;
    else gaps.push(`${inj.body_part}: Severity not rated`);

    // Body region mapped
    if (inj.body_region) s += 15;

    total += Math.min(100, s);
  }

  const avg = Math.round(total / injuries.length);
  const finding = avg < 50
    ? "Valuation suppressed by imprecise or missing diagnosis documentation."
    : avg < 75
      ? "Diagnosis documentation is adequate but lacks full specificity on some injuries."
      : "Diagnosis documentation is well-supported with specific codes and descriptions.";

  return makeSub("diagnosis_specificity", "Diagnosis Specificity", avg, finding, gaps,
    avg < 50 ? "reduces_confidence" : "none",
    avg < 50 ? "Weak diagnosis specificity reduces confidence in injury valuation." : "No material impact.",
    inputs);
}

function scoreObjectiveSupport(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const flags = snap.clinical_flags;
  const gaps: string[] = [];
  const inputs: string[] = [];
  let score = 30; // Base for having any treatment

  if (flags.has_advanced_imaging) { score += 25; inputs.push("Advanced imaging present"); }
  else gaps.push("No advanced imaging studies documented");

  if (flags.has_surgery) { score += 20; inputs.push("Surgical intervention documented"); }
  if (flags.has_injections) { score += 10; inputs.push("Injection therapy documented"); }
  if (flags.has_impairment_rating) { score += 15; inputs.push("Impairment rating on file"); }
  else gaps.push("No impairment rating documented");

  // Provider confirmation via treatment count
  const treatmentCount = snap.treatment_timeline.length;
  if (treatmentCount >= 10) { score += 10; inputs.push(`${treatmentCount} treatment entries`); }
  else if (treatmentCount < 3) { score -= 10; gaps.push("Fewer than 3 treatment entries — thin record"); }

  score = clamp(score);

  const finding = score < 40
    ? "Objective support is insufficient. Valuation confidence reduced significantly."
    : score < 65
      ? "Objective support is limited; corridor widened to reflect uncertainty."
      : "Objective findings adequately support the claimed injuries.";

  return makeSub("objective_support", "Objective Support Sufficiency", score, finding, gaps,
    score < 40 ? "reduces_confidence" : score < 65 ? "widens_range" : "none",
    score < 65 ? "Limited objective support widens the settlement corridor." : "No material impact.",
    inputs);
}

function scoreChronologyCompleteness(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const treatments = snap.treatment_timeline;
  const gaps: string[] = [];
  const inputs: string[] = [];

  if (treatments.length === 0) {
    return makeSub("chronology_completeness", "Chronology Completeness", 0,
      "No treatment timeline available. Chronology cannot be assessed.",
      ["No treatment records"], "excludes_component", "Missing timeline prevents chronology scoring.");
  }

  let score = 40; // Base for having timeline data
  inputs.push(`${treatments.length} treatment entries`);

  // Check for dated entries
  const dated = treatments.filter(t => t.treatment_date);
  const datedPct = dated.length / treatments.length;
  if (datedPct >= 0.9) { score += 25; }
  else if (datedPct >= 0.5) { score += 10; gaps.push(`${Math.round((1 - datedPct) * 100)}% of treatments lack dates`); }
  else { gaps.push("Majority of treatment entries lack dates"); }

  // Check for provider diversity (multiple providers = more complete picture)
  const uniqueProviders = new Set(treatments.map(t => t.provider_name)).size;
  if (uniqueProviders >= 3) { score += 15; inputs.push(`${uniqueProviders} distinct providers`); }
  else if (uniqueProviders >= 2) { score += 8; }
  else { gaps.push("Single provider — limited corroboration"); }

  // Duration coverage
  const sortedDates = dated.map(t => new Date(t.treatment_date!).getTime()).sort((a, b) => a - b);
  if (sortedDates.length >= 2) {
    const durationDays = (sortedDates[sortedDates.length - 1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
    if (durationDays >= 90) { score += 15; inputs.push(`${Math.round(durationDays)} days treatment span`); }
    else if (durationDays >= 30) { score += 8; }
    else { gaps.push("Treatment span under 30 days — may appear abbreviated"); }
  }

  // Completeness warnings from snapshot
  const chronoWarnings = snap.completeness_warnings.filter(w => w.field.includes("treatment") || w.field.includes("chronology"));
  if (chronoWarnings.length > 0) {
    score -= chronoWarnings.length * 5;
    gaps.push(...chronoWarnings.map(w => w.message));
  }

  score = clamp(score);

  const finding = score < 50
    ? "Chronology is fragmented — treatment timeline has significant gaps."
    : score < 75
      ? "Chronology is partially complete; some treatment dates or providers missing."
      : "Treatment chronology is well-documented and continuous.";

  return makeSub("chronology_completeness", "Chronology Completeness", score, finding, gaps,
    score < 50 ? "widens_range" : "none",
    score < 50 ? "Fragmented chronology widens the settlement corridor." : "No material impact.",
    inputs);
}

function scoreTreatmentGapExplanation(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const treatments = snap.treatment_timeline.filter(t => t.treatment_date);
  const gaps: string[] = [];
  const inputs: string[] = [];

  if (treatments.length < 2) {
    return makeSub("treatment_gap_explanation", "Treatment Gap Explanation", 50,
      "Insufficient treatment entries to assess gaps.",
      ["Fewer than 2 dated treatments"], "none", "Cannot assess treatment gaps.", inputs);
  }

  // Detect gaps > 30 days
  const dates = treatments
    .map(t => new Date(t.treatment_date!).getTime())
    .sort((a, b) => a - b);

  let gapCount = 0;
  let maxGapDays = 0;
  for (let i = 1; i < dates.length; i++) {
    const gapDays = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
    if (gapDays > 30) {
      gapCount++;
      maxGapDays = Math.max(maxGapDays, gapDays);
      gaps.push(`${Math.round(gapDays)}-day gap between treatments`);
    }
  }

  if (gapCount === 0) {
    return makeSub("treatment_gap_explanation", "Treatment Gap Explanation", 90,
      "No significant treatment gaps detected.",
      [], "none", "No material impact.", [`${treatments.length} treatments, no gaps >30 days`]);
  }

  // Gaps exist — check if upstream concerns explain them
  const gapConcerns = snap.upstream_concerns.filter(c =>
    c.description.toLowerCase().includes("gap") || c.description.toLowerCase().includes("discontinu"));

  inputs.push(`${gapCount} gap(s) detected`, `Max gap: ${Math.round(maxGapDays)} days`);

  let score = 70 - (gapCount * 15);
  if (gapConcerns.length > 0) {
    score -= gapConcerns.length * 5;
    inputs.push(`${gapConcerns.length} upstream gap concern(s)`);
  }

  score = clamp(score);

  const finding = score < 40
    ? `${gapCount} treatment gap(s) unexplained (max ${Math.round(maxGapDays)} days). Corridor may be widened.`
    : `${gapCount} treatment gap(s) detected but within tolerable range.`;

  return makeSub("treatment_gap_explanation", "Treatment Gap Explanation", score, finding, gaps,
    score < 40 ? "widens_range" : "none",
    score < 40 ? "Unexplained treatment gaps widen the settlement corridor." : "No material impact.",
    inputs);
}

function scoreFunctionalLimitation(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const gaps: string[] = [];
  const inputs: string[] = [];

  // Functional limitation evidence via clinical flags and injury severity
  const hasImpairment = snap.clinical_flags.has_impairment_rating;
  const hasPermanency = snap.clinical_flags.has_permanency_indicators;
  const hasScarring = snap.clinical_flags.has_scarring_disfigurement;

  let score = 25; // Base

  if (hasImpairment) { score += 30; inputs.push("Impairment rating documented"); }
  else gaps.push("No impairment rating — functional limitation unquantified");

  if (hasPermanency) { score += 20; inputs.push("Permanency indicators present"); }
  if (hasScarring) { score += 10; inputs.push("Scarring/disfigurement documented"); }

  // Check for severe injuries (proxy for functional impact documentation)
  const severeInjuries = snap.injuries.filter(i => i.severity === "severe" || i.severity === "critical");
  if (severeInjuries.length > 0) {
    score += 15;
    inputs.push(`${severeInjuries.length} severe/critical injuries`);
  } else {
    gaps.push("No severe injuries — functional limitation documentation less critical but still important");
  }

  // Upstream functional concerns
  const funcConcerns = snap.upstream_concerns.filter(c =>
    c.description.toLowerCase().includes("function") || c.description.toLowerCase().includes("limitation"));
  if (funcConcerns.length > 0) {
    score -= funcConcerns.length * 8;
    gaps.push(...funcConcerns.map(c => c.description));
  }

  score = clamp(score);

  const finding = score < 40
    ? "Valuation suppressed by weak functional limitation documentation."
    : score < 65
      ? "Functional limitation documentation is present but lacks specificity."
      : "Functional limitations are well-documented with supporting evidence.";

  return makeSub("functional_limitation", "Functional Limitation Specificity", score, finding, gaps,
    score < 40 ? "suppresses_midpoint" : score < 65 ? "reduces_confidence" : "none",
    score < 40 ? "Weak functional documentation suppresses the corridor midpoint." : "No material impact.",
    inputs);
}

function scoreWorkImpact(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const wageLoss = snap.wage_loss.total_lost_wages.value;
  const wageDuration = snap.wage_loss.duration_description.value;
  const occupation = snap.claimant.occupation.value;
  const gaps: string[] = [];
  const inputs: string[] = [];

  let score = 20; // Base

  if (wageLoss > 0) { score += 35; inputs.push(`Lost wages: $${wageLoss.toLocaleString()}`); }
  else { gaps.push("No lost wages documented"); score -= 10; }

  if (wageDuration) { score += 15; inputs.push(`Duration: ${wageDuration}`); }
  else if (wageLoss > 0) { gaps.push("Wage loss duration not specified"); }

  if (occupation) { score += 15; inputs.push(`Occupation: ${occupation}`); }
  else { gaps.push("Claimant occupation not documented"); }

  // Employer info
  if (snap.claimant.employer.value) { score += 15; inputs.push(`Employer: ${snap.claimant.employer.value}`); }
  else if (wageLoss > 0) { gaps.push("Employer not identified"); }

  score = clamp(score);

  const finding = score < 30
    ? "Work-impact documentation absent — wage loss component not creditable."
    : score < 60
      ? "Work-impact partially documented; wage loss may be discounted."
      : "Work-impact well-supported with wage loss documentation.";

  return makeSub("work_impact", "Work-Impact Support", score, finding, gaps,
    score < 30 ? "excludes_component" : score < 60 ? "reduces_confidence" : "none",
    score < 30 ? "Absent work-impact documentation excludes wage loss from valuation." : "No material impact.",
    inputs);
}

function scorePermanencyImpairment(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const flags = snap.clinical_flags;
  const gaps: string[] = [];
  const inputs: string[] = [];

  let score = 10; // Base

  if (flags.has_permanency_indicators) { score += 30; inputs.push("Permanency indicators present"); }
  else { gaps.push("No permanency indicators documented"); }

  if (flags.has_impairment_rating) { score += 35; inputs.push("Impairment rating on file"); }
  else { gaps.push("Missing MMI determination or physician residual language"); }

  if (flags.has_surgery) { score += 15; inputs.push("Surgical history supports permanency"); }
  if (flags.has_scarring_disfigurement) { score += 10; inputs.push("Scarring/disfigurement documented"); }

  // Check for pre-existing apportionment
  const preExisting = snap.injuries.filter(i => i.is_pre_existing);
  if (preExisting.length > 0 && !flags.has_impairment_rating) {
    score -= 10;
    gaps.push("Pre-existing conditions present without impairment apportionment");
  }

  score = clamp(score);

  const finding = score < 30
    ? "Permanency not credited due to missing MMI or physician residual language."
    : score < 60
      ? "Permanency documentation is partial — impairment rating or MMI may be missing."
      : "Permanency and impairment are well-documented with supporting clinical evidence.";

  return makeSub("permanency_impairment", "Permanency / Impairment Support", score, finding, gaps,
    score < 30 ? "excludes_component" : score < 60 ? "reduces_confidence" : "none",
    score < 30 ? "Permanency not included in valuation due to insufficient documentation." : "No material impact.",
    inputs);
}

function scoreFutureCare(snap: EvaluateIntakeSnapshot): DocSubcomponentScore {
  const futureEst = snap.future_treatment.future_medical_estimate.value;
  const indicators = snap.future_treatment.indicators.value;
  const gaps: string[] = [];
  const inputs: string[] = [];

  let score = 10; // Base

  if (futureEst > 0) { score += 35; inputs.push(`Future medical estimate: $${futureEst.toLocaleString()}`); }
  else { gaps.push("No future medical cost estimate documented"); }

  if (indicators.length > 0) {
    score += 20 + Math.min(15, indicators.length * 5);
    inputs.push(`${indicators.length} future care indicator(s): ${indicators.slice(0, 3).join(", ")}`);
  } else {
    gaps.push("No future care indicators identified");
  }

  // Surgery or permanency implies future care need
  if (snap.clinical_flags.has_surgery || snap.clinical_flags.has_permanency_indicators) {
    if (futureEst === 0 && indicators.length === 0) {
      score -= 10;
      gaps.push("Surgery/permanency present but no future care plan documented");
    } else {
      score += 10;
    }
  }

  score = clamp(score);

  const finding = score < 30
    ? "Future care not included due to unsupported recommendation."
    : score < 60
      ? "Future care documentation is partial — estimates may be discounted."
      : "Future care needs are well-documented with cost estimates and clinical support.";

  return makeSub("future_care", "Future Care Support", score, finding, gaps,
    score < 30 ? "excludes_component" : score < 60 ? "reduces_confidence" : "none",
    score < 30 ? "Future care excluded from valuation due to unsupported documentation." : "No material impact.",
    inputs);
}

// ─── Valuation Effects ─────────────────────────────────

function deriveValuationEffects(subs: DocSubcomponentScore[]): ValuationEffect[] {
  const effects: ValuationEffect[] = [];

  const widening = subs.filter(s => s.impact === "widens_range");
  if (widening.length > 0) {
    effects.push({
      effect: "widens_range",
      label: "Corridor Widened",
      description: `${widening.length} subcomponent(s) with limited documentation widen the settlement corridor to reflect uncertainty.`,
      triggered_by: widening.map(s => s.key),
    });
  }

  const suppressing = subs.filter(s => s.impact === "suppresses_midpoint");
  if (suppressing.length > 0) {
    effects.push({
      effect: "suppresses_midpoint",
      label: "Midpoint Suppressed",
      description: `Weak documentation in ${suppressing.map(s => s.label).join(", ")} suppresses the corridor midpoint.`,
      triggered_by: suppressing.map(s => s.key),
    });
  }

  const confidenceReduced = subs.filter(s => s.impact === "reduces_confidence");
  if (confidenceReduced.length > 0) {
    effects.push({
      effect: "reduces_confidence",
      label: "Confidence Reduced",
      description: `Documentation weakness in ${confidenceReduced.length} area(s) reduces overall valuation confidence.`,
      triggered_by: confidenceReduced.map(s => s.key),
    });
  }

  const excluded = subs.filter(s => s.impact === "excludes_component");
  if (excluded.length > 0) {
    effects.push({
      effect: "excludes_component",
      label: "Components Excluded",
      description: `${excluded.map(s => s.label).join(", ")} excluded from valuation due to insufficient documentation.`,
      triggered_by: excluded.map(s => s.key),
    });
  }

  return effects;
}

// ─── Helpers ───────────────────────────────────────────

function labelFromScore(score: number): SufficiencyLabel {
  if (score >= 75) return "strong";
  if (score >= 55) return "adequate";
  if (score >= 35) return "limited";
  return "insufficient";
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function makeSub(
  key: DocSubcomponentKey,
  label: string,
  score: number,
  finding: string,
  gaps: string[],
  impact: SufficiencyImpact,
  impact_description: string,
  inputs: string[] = [],
): DocSubcomponentScore {
  return {
    key,
    label,
    score: clamp(score),
    sufficiency: labelFromScore(clamp(score)),
    finding,
    gaps,
    impact,
    impact_description,
    inputs,
  };
}
