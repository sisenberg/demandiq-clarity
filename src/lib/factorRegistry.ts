/**
 * EvaluateIQ — Factor Registry
 *
 * The canonical registry of all factor definitions across layers 0–5.
 * This is the single source of truth for factor metadata, scoring rules,
 * and explanation templates.
 *
 * GOVERNANCE RULES:
 *  - No hidden factors
 *  - No plaintiff attorney identity factor
 *  - No provider blacklist logic
 *  - No demographic or proxy factors
 *  - Every factor must have an explanation template
 *  - Every factor must declare its input dependencies
 */

import type { FactorDefinition, FactorLayer } from "@/types/factor-taxonomy";

const V = "1.0.0";
const D = "2026-03-13";

// ─── Layer 0: Eligibility & Readiness Gates ────────────

const LAYER_0: FactorDefinition[] = [
  {
    id: "gate_liability_posture",
    name: "Liability Posture Available",
    layer: 0,
    family: "readiness",
    description: "Whether liability posture information is present in the intake snapshot.",
    input_dependencies: ["liability_facts"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "required",
    explanation_template: "Liability posture is {status}. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Blocks valuation if no liability facts at all.",
  },
  {
    id: "gate_medical_review_complete",
    name: "Medical Review Completeness",
    layer: 0,
    family: "readiness",
    description: "Whether the upstream medical review has reached a sufficient completion state.",
    input_dependencies: ["overall_completeness_score", "completeness_warnings"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "required",
    explanation_template: "Medical review completeness is {score}%. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Threshold: 40% minimum for provisional, 70% for full.",
  },
  {
    id: "gate_chronology_available",
    name: "Chronology Availability",
    layer: 0,
    family: "readiness",
    description: "Whether a treatment chronology with sufficient entries exists.",
    input_dependencies: ["treatment_timeline"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "required",
    explanation_template: "Treatment chronology has {count} entries. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Minimum 1 treatment entry required.",
  },
  {
    id: "gate_bills_reviewed",
    name: "Bills Reviewed State",
    layer: 0,
    family: "readiness",
    description: "Whether medical bills have been reviewed and have a settled state.",
    input_dependencies: ["medical_billing"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "recommended",
    explanation_template: "Bills review: {reviewed_count}/{total_count} reviewed. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Not a hard gate — provisional evaluation allowed without full bill review.",
  },
  {
    id: "gate_unresolved_conflicts",
    name: "Unresolved Conflicts Presence",
    layer: 0,
    family: "readiness",
    description: "Whether critical upstream concerns remain unresolved.",
    input_dependencies: ["upstream_concerns"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "optional",
    explanation_template: "{count} unresolved upstream concern(s). {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Critical concerns block; warnings allow provisional.",
  },
  {
    id: "gate_benchmark_data",
    name: "Benchmark Minimum Data",
    layer: 0,
    family: "readiness",
    description: "Whether minimum data is present for benchmark / calibration matching.",
    input_dependencies: ["injuries", "venue_jurisdiction", "medical_billing"],
    score_type: "binary",
    scale_min: 0, scale_max: 1,
    default_direction: "neutral",
    evidence_requirement: "recommended",
    explanation_template: "Benchmark data: {status}. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Needs at least 1 injury + jurisdiction + 1 billing entry.",
  },
];

// ─── Layer 1: Injury Merit Factors ─────────────────────

const LAYER_1: FactorDefinition[] = [
  {
    id: "injury_severity_class",
    name: "Injury Severity Class",
    layer: 1,
    family: "injury_severity",
    description: "Overall severity classification based on the most severe accepted injury.",
    input_dependencies: ["injuries"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "required",
    explanation_template: "Most severe injury classified as {severity_label} (score {score}/5). {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=none, 1=mild strain, 2=moderate, 3=significant, 4=severe, 5=catastrophic.",
  },
  {
    id: "objective_medical_support",
    name: "Objective Medical Support",
    layer: 1,
    family: "injury_severity",
    description: "Degree to which injuries are supported by objective diagnostic findings (imaging, EMG, labs).",
    input_dependencies: ["clinical_flags", "injuries"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "required",
    explanation_template: "Objective support score: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=no objective findings, 5=MRI/CT confirmed pathology with clinical correlation.",
  },
  {
    id: "treatment_invasiveness",
    name: "Treatment Intensity & Invasiveness",
    layer: 1,
    family: "treatment_intensity",
    description: "Level of treatment invasiveness from conservative care to surgical intervention.",
    input_dependencies: ["clinical_flags", "treatment_timeline"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "required",
    explanation_template: "Treatment invasiveness: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=no treatment, 1=OTC/self-care, 2=conservative, 3=injections, 4=minor surgery, 5=major surgery.",
  },
  {
    id: "permanency_impairment",
    name: "Permanency / Impairment",
    layer: 1,
    family: "permanency",
    description: "Evidence of permanent residual impairment or disability.",
    input_dependencies: ["clinical_flags"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "required",
    explanation_template: "Permanency score: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=no permanency, 1=subjective only, 2=clinical opinion, 3=rated impairment <10%, 4=rated 10-24%, 5=rated 25%+.",
  },
];

// ─── Layer 2: Treatment Pattern & Clinical Coherence ───

const LAYER_2: FactorDefinition[] = [
  {
    id: "treatment_duration",
    name: "Treatment Duration",
    layer: 2,
    family: "treatment_pattern",
    description: "Total duration of treatment from first visit to last visit or MMI.",
    input_dependencies: ["treatment_timeline"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "required",
    explanation_template: "Treatment duration: {days} days ({score}/5). {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=no treatment, 1=<30d, 2=30-90d, 3=90-180d, 4=180-365d, 5=>365d.",
  },
  {
    id: "treatment_continuity",
    name: "Treatment Continuity",
    layer: 2,
    family: "treatment_pattern",
    description: "Consistency of treatment without unexplained gaps.",
    input_dependencies: ["treatment_timeline", "upstream_concerns"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "required",
    explanation_template: "Treatment continuity: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "5=continuous, 4=minor gap explained, 3=gap with explanation, 2=significant gap, 1=major gap, 0=treatment abandoned.",
  },
  {
    id: "gap_quality",
    name: "Gap Quality",
    layer: 2,
    family: "treatment_pattern",
    description: "Quality of explanations for identified treatment gaps.",
    input_dependencies: ["upstream_concerns"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "reducer",
    evidence_requirement: "recommended",
    explanation_template: "Gap quality: {score}/5. {gap_count} gap(s) identified. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Only scored when gaps exist. 5=all gaps well explained, 0=unexplained abandonment.",
  },
  {
    id: "referral_chain_coherence",
    name: "Referral Chain & Treatment Coherence",
    layer: 2,
    family: "treatment_pattern",
    description: "Whether treatment progression follows a clinically coherent referral chain.",
    input_dependencies: ["providers", "treatment_timeline"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "recommended",
    explanation_template: "Referral chain coherence: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Evaluates PCP→specialist→surgery chain vs. direct-to-specialist patterns.",
  },
  {
    id: "reviewer_reasonableness_signal",
    name: "ReviewerIQ Reasonableness Signal",
    layer: 2,
    family: "credibility",
    description: "Aggregate signal from ReviewerIQ reasonableness and necessity findings.",
    input_dependencies: ["upstream_concerns", "medical_billing"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "recommended",
    explanation_template: "Reviewer reasonableness signal: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "5=fully reasonable, 0=significant reasonableness concerns flagged.",
  },
];

// ─── Layer 3: Functional & Life Impact ─────────────────

const LAYER_3: FactorDefinition[] = [
  {
    id: "work_impact",
    name: "Work Impact",
    layer: 3,
    family: "functional_impact",
    description: "Impact on ability to work — from no impact to complete disability.",
    input_dependencies: ["wage_loss", "upstream_concerns"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "recommended",
    explanation_template: "Work impact: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=no work impact, 1=minor restrictions, 2=modified duty, 3=temporary disability, 4=extended disability, 5=permanent disability.",
  },
  {
    id: "adl_impact",
    name: "ADL Impact",
    layer: 3,
    family: "functional_impact",
    description: "Impact on activities of daily living (ADLs).",
    input_dependencies: ["upstream_concerns", "injuries"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "recommended",
    explanation_template: "ADL impact: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Based on documented ADL restrictions in medical records.",
  },
  {
    id: "loss_of_enjoyment",
    name: "Loss of Enjoyment / Activity Restriction",
    layer: 3,
    family: "functional_impact",
    description: "Documented restrictions on recreational activities, hobbies, or quality of life.",
    input_dependencies: ["upstream_concerns"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "optional",
    explanation_template: "Loss of enjoyment: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Difficult to verify objectively. Score conservatively without documentation.",
  },
  {
    id: "symptom_persistence",
    name: "Symptom Persistence & Trajectory",
    layer: 3,
    family: "functional_impact",
    description: "Whether symptoms are resolving, stable, or worsening over treatment course.",
    input_dependencies: ["treatment_timeline", "clinical_flags"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "recommended",
    explanation_template: "Symptom trajectory: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=fully resolved, 5=worsening despite treatment.",
  },
];

// ─── Layer 4: Economic & Specials-Related ──────────────

const LAYER_4: FactorDefinition[] = [
  {
    id: "past_medical_specials",
    name: "Past Medical Specials",
    layer: 4,
    family: "economic",
    description: "Total documented past medical expenses (billed or reviewed).",
    input_dependencies: ["medical_billing"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "required",
    explanation_template: "Past medical specials: ${amount}. Score: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=$0, 1=<$5K, 2=$5K-$15K, 3=$15K-$50K, 4=$50K-$100K, 5=>$100K.",
  },
  {
    id: "future_medical_exposure",
    name: "Future Medical Exposure",
    layer: 4,
    family: "economic",
    description: "Estimated future medical costs based on clinical indicators.",
    input_dependencies: ["future_treatment", "clinical_flags"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "recommended",
    explanation_template: "Future medical exposure: ${amount}. Score: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Based on documented need for ongoing care, not speculative.",
  },
  {
    id: "wage_loss_documented",
    name: "Wage Loss / Earning Loss",
    layer: 4,
    family: "economic",
    description: "Documented wage or earning loss attributable to the injury.",
    input_dependencies: ["wage_loss"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "expander",
    evidence_requirement: "recommended",
    explanation_template: "Wage loss: ${amount}. Score: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "0=none, 1=<$2K, 2=$2K-$10K, 3=$10K-$30K, 4=$30K-$75K, 5=>$75K.",
  },
  {
    id: "property_damage_context",
    name: "Property Damage Context",
    layer: 4,
    family: "economic",
    description: "Property damage amount as contextual support only — not a direct damages factor.",
    input_dependencies: [],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "neutral",
    evidence_requirement: "optional",
    explanation_template: "Property damage: {status}. Used as contextual support only. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Explicitly contextual. Does not directly influence corridor.",
  },
];

// ─── Layer 5: Post-Merit Adjustments ───────────────────

const LAYER_5: FactorDefinition[] = [
  {
    id: "causation_apportionment",
    name: "Causation & Apportionment",
    layer: 5,
    family: "liability",
    description: "Degree to which injuries are causally attributable to the subject incident vs. pre-existing conditions.",
    input_dependencies: ["injuries", "liability_facts"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "reducer",
    evidence_requirement: "required",
    explanation_template: "Causation strength: {score}/5. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "5=clear causation, 0=significant apportionment risk.",
  },
  {
    id: "comparative_negligence",
    name: "Comparative Negligence",
    layer: 5,
    family: "liability",
    description: "Claimant's percentage of fault reducing recovery.",
    input_dependencies: ["comparative_negligence"],
    score_type: "percentage",
    scale_min: 0, scale_max: 100,
    default_direction: "reducer",
    evidence_requirement: "required",
    explanation_template: "Comparative negligence: {pct}%. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Direct percentage reduction in modified comparative fault jurisdictions.",
  },
  {
    id: "coverage_collectibility",
    name: "Coverage / Collectible Realities",
    layer: 5,
    family: "policy_constraint",
    description: "Whether policy limits or collectibility constrain the practical recovery range.",
    input_dependencies: ["policy_coverage"],
    score_type: "dollar_adjustment",
    scale_min: 0, scale_max: 999999999,
    default_direction: "constraint",
    evidence_requirement: "recommended",
    explanation_template: "Coverage constraint: {status}. Policy limits: ${limit}. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Caps corridor to policy limits when applicable.",
  },
  {
    id: "venue_jurisdiction_adjustment",
    name: "Venue / Jurisdiction Adjustment",
    layer: 5,
    family: "venue",
    description: "Venue-specific multiplier based on historical settlement patterns in the jurisdiction.",
    input_dependencies: ["venue_jurisdiction"],
    score_type: "multiplier",
    scale_min: 0.5, scale_max: 2.0,
    default_direction: "variable",
    evidence_requirement: "recommended",
    explanation_template: "Venue adjustment: {multiplier}x ({jurisdiction}). {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "Driven by calibration corpus. Default 1.0x when no data.",
  },
  {
    id: "documentation_confidence",
    name: "Documentation Confidence Effect",
    layer: 5,
    family: "credibility",
    description: "Impact of overall documentation quality on confidence in the valuation range.",
    input_dependencies: ["overall_completeness_score", "completeness_warnings"],
    score_type: "ordinal_0_5",
    scale_min: 0, scale_max: 5,
    default_direction: "variable",
    evidence_requirement: "optional",
    explanation_template: "Documentation confidence: {score}/5. Completeness: {pct}%. {detail}",
    version: V, effective_date: D, is_active: true, prohibited: false,
    admin_notes: "5=excellent documentation, 0=critical gaps undermining valuation.",
  },
];

// ─── Registry ──────────────────────────────────────────

export const FACTOR_REGISTRY: FactorDefinition[] = [
  ...LAYER_0,
  ...LAYER_1,
  ...LAYER_2,
  ...LAYER_3,
  ...LAYER_4,
  ...LAYER_5,
];

/** Lookup factor by id */
export function getFactorById(id: string): FactorDefinition | undefined {
  return FACTOR_REGISTRY.find(f => f.id === id);
}

/** Get all factors for a specific layer */
export function getFactorsByLayer(layer: FactorLayer): FactorDefinition[] {
  return FACTOR_REGISTRY.filter(f => f.layer === layer && f.is_active && !f.prohibited);
}

/** Get all active, non-prohibited factors */
export function getActiveFactors(): FactorDefinition[] {
  return FACTOR_REGISTRY.filter(f => f.is_active && !f.prohibited);
}

/** Get factors grouped by layer */
export function getFactorsByLayerGrouped(): Map<FactorLayer, FactorDefinition[]> {
  const map = new Map<FactorLayer, FactorDefinition[]>();
  for (const f of getActiveFactors()) {
    const arr = map.get(f.layer) ?? [];
    arr.push(f);
    map.set(f.layer, arr);
  }
  return map;
}

/** Get all unique families */
export function getFactorFamilies(): string[] {
  return [...new Set(getActiveFactors().map(f => f.family))];
}
