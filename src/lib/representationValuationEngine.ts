/**
 * EvaluateIQ — Representation-Aware Valuation Engine
 *
 * Computes dual-range outputs:
 *  - fact_based_value_range: grounded in claim facts, never adjusted by representation
 *  - expected_resolution_range: considers representation context for practical settlement
 *
 * Core invariant: fact_based_value_range MUST be identical whether the claimant
 * is represented or unrepresented.
 */

import type { EvaluateIntakeSnapshot } from '@/types/evaluate-intake';
import type { RangeEngineOutput } from './settlementRangeEngine';
import type { ClaimantRepresentationSummary } from '@/types/representation';
import type {
  RepresentationAwareValuation,
  EvalRepresentationContext,
  FactBasedValueRange,
  ExpectedResolutionRange,
  RepresentationScenarioSet,
  RepresentationScenario,
  RepresentationNotes,
  RepresentationContextFactor,
} from '@/types/representation-valuation';

export const REP_VALUATION_ENGINE_VERSION = 'v1.0.0';

// ─── Resolution Adjustment Constants ────────────────────

/**
 * REPRESENTATION CONTEXT ADJUSTMENTS
 *
 * These adjust the EXPECTED RESOLUTION range only. They never touch fact-based value.
 * Rationale: unrepresented claimants historically resolve at different percentages
 * of claim value due to negotiation dynamics, not claim merit differences.
 */
const RESOLUTION_ADJUSTMENTS = {
  /** Unrepresented claimants historically resolve at different % of fact-based value due to negotiation dynamics, not merit */
  unrepresented_direct_resolution: {
    low_pct: 0.45,   // Floor: 45% of fact-based low
    mid_pct: 0.55,   // Likely: 55% of fact-based mid
    high_pct: 0.70,  // Stretch: 70% of fact-based high
    reason: 'Direct resolution without counsel historically results in settlements at 45-70% of fact-based value due to negotiation dynamics',
  },
  /** Represented claimants with experienced counsel */
  represented_counsel: {
    low_pct: 0.75,   // Floor: 75% of fact-based low
    mid_pct: 0.85,   // Likely: 85% of fact-based mid
    high_pct: 0.95,  // Stretch: 95% of fact-based high
    reason: 'Represented claimants with counsel typically achieve 75-95% of full claim value',
  },
  /** Early resolution opportunity (before retention risk materializes) */
  early_resolution: {
    low_pct: 0.50,
    mid_pct: 0.60,
    high_pct: 0.75,
    reason: 'Early resolution captures savings from avoided litigation costs and attorney fees',
  },
} as const;

// ─── Attorney Retention Risk ────────────────────────────

/**
 * Estimates the probability of attorney retention based on claim characteristics.
 * Higher values = higher risk of counsel being retained.
 */
function computeAttorneyRetentionRisk(
  snapshot: EvaluateIntakeSnapshot,
  repSummary: ClaimantRepresentationSummary | null,
): number {
  if (repSummary?.representation_status_current === 'represented') return 0; // Already represented

  let risk = 20; // Base risk for any open claim

  // Higher-value claims attract counsel
  const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
  if (totalBilled > 50000) risk += 25;
  else if (totalBilled > 20000) risk += 15;
  else if (totalBilled > 10000) risk += 10;

  // Surgery and permanency significantly increase retention risk
  if (snapshot.clinical_flags.has_surgery) risk += 15;
  if (snapshot.clinical_flags.has_permanency_indicators) risk += 15;

  // Multiple injuries increase risk
  const nonPreExisting = snapshot.injuries.filter((i) => !i.is_pre_existing).length;
  if (nonPreExisting >= 3) risk += 10;

  // Disputed liability increases risk (claimant seeks help)
  const adverseFacts = snapshot.liability_facts.filter((f) => !f.supports_liability).length;
  if (adverseFacts > 0) risk += 10;

  return Math.min(95, Math.max(5, risk));
}

// ─── Representation Context Factors ─────────────────────

export function computeRepresentationContextFactors(
  repSummary: ClaimantRepresentationSummary | null,
  retentionRisk: number,
): RepresentationContextFactor[] {
  const factors: RepresentationContextFactor[] = [];

  const status = repSummary?.representation_status_current ?? 'unknown';

  factors.push({
    factor_id: 'rep_current_status',
    label: 'Current Representation Status',
    family: 'representation_negotiation_context',
    direction: status === 'unrepresented' ? 'narrows_resolution' : 'neutral',
    score: status === 'represented' ? 70 : status === 'unrepresented' ? 40 : 50,
    narrative: status === 'represented'
      ? `Claimant is currently represented by ${repSummary?.represented_by_current_attorney_name ?? 'counsel'}. Expected resolution approaches full claim value.`
      : status === 'unrepresented'
        ? 'Claimant is currently unrepresented. Direct resolution may be achievable at reduced percentage of claim value.'
        : 'Representation status unknown. Resolution range assumes moderate negotiation posture.',
    affects_expected_resolution: true,
    affects_fact_based_value: false,
  });

  if (status === 'unrepresented') {
    factors.push({
      factor_id: 'rep_retention_risk',
      label: 'Attorney Retention Risk',
      family: 'representation_negotiation_context',
      direction: retentionRisk > 50 ? 'widens_resolution' : 'neutral',
      score: retentionRisk,
      narrative: retentionRisk > 60
        ? `High attorney retention risk (${retentionRisk}%). Delayed resolution may result in counsel retention, increasing expected resolution costs.`
        : retentionRisk > 35
          ? `Moderate attorney retention risk (${retentionRisk}%). Early engagement recommended to manage resolution within current posture.`
          : `Low attorney retention risk (${retentionRisk}%). Direct resolution opportunity favorable.`,
      affects_expected_resolution: true,
      affects_fact_based_value: false,
    });
  }

  if (repSummary?.representation_transition_flag) {
    factors.push({
      factor_id: 'rep_transition',
      label: 'Representation Transition',
      family: 'representation_negotiation_context',
      direction: 'widens_resolution',
      score: 60,
      narrative: 'Claimant has transitioned between represented and unrepresented states. This transition signal may indicate evolving claim posture.',
      affects_expected_resolution: true,
      affects_fact_based_value: false,
    });
  }

  return factors;
}

// ─── Scenario Builder ───────────────────────────────────

function buildScenarios(
  factBased: FactBasedValueRange,
  repSummary: ClaimantRepresentationSummary | null,
  retentionRisk: number,
): RepresentationScenarioSet {
  const status = repSummary?.representation_status_current ?? 'unknown';

  const directResolution: RepresentationScenario | null = status !== 'represented'
    ? {
        scenario_id: 'direct_resolution_unrepresented',
        label: 'Direct Resolution (Unrepresented)',
        description: 'Settlement achieved through direct negotiation without counsel involvement.',
        range: {
          low: Math.round(factBased.low * RESOLUTION_ADJUSTMENTS.unrepresented_direct_resolution.low_pct),
          mid: Math.round(factBased.mid * RESOLUTION_ADJUSTMENTS.unrepresented_direct_resolution.mid_pct),
          high: Math.round(factBased.high * RESOLUTION_ADJUSTMENTS.unrepresented_direct_resolution.high_pct),
        },
        probability: status === 'unrepresented' ? Math.max(20, 75 - retentionRisk) : 40,
        assumptions: [
          'Claimant negotiates directly without legal counsel',
          RESOLUTION_ADJUSTMENTS.unrepresented_direct_resolution.reason,
          'No litigation costs or contingency fees deducted',
        ],
      }
    : null;

  const counselRetained: RepresentationScenario | null = status !== 'represented'
    ? {
        scenario_id: 'likely_if_counsel_retained',
        label: 'If Counsel Retained',
        description: 'Projected resolution range if claimant retains legal counsel.',
        range: {
          low: Math.round(factBased.low * RESOLUTION_ADJUSTMENTS.represented_counsel.low_pct),
          mid: Math.round(factBased.mid * RESOLUTION_ADJUSTMENTS.represented_counsel.mid_pct),
          high: Math.round(factBased.high * RESOLUTION_ADJUSTMENTS.represented_counsel.high_pct),
        },
        probability: retentionRisk,
        assumptions: [
          'Claimant retains experienced plaintiff counsel',
          RESOLUTION_ADJUSTMENTS.represented_counsel.reason,
          'Settlement cycle may extend by 6-18 months',
        ],
      }
    : null;

  const earlyResolution: RepresentationScenario | null = status !== 'represented'
    ? {
        scenario_id: 'early_resolution_opportunity',
        label: 'Early Resolution Opportunity',
        description: 'Resolution achieved early before counsel retention or litigation.',
        range: {
          low: Math.round(factBased.low * RESOLUTION_ADJUSTMENTS.early_resolution.low_pct),
          mid: Math.round(factBased.mid * RESOLUTION_ADJUSTMENTS.early_resolution.mid_pct),
          high: Math.round(factBased.high * RESOLUTION_ADJUSTMENTS.early_resolution.high_pct),
        },
        probability: status === 'unrepresented' ? Math.max(15, 60 - retentionRisk) : 30,
        assumptions: [
          'Prompt engagement and fair initial offer',
          RESOLUTION_ADJUSTMENTS.early_resolution.reason,
          'Avoids extended negotiation cycle',
        ],
      }
    : null;

  const currentRepresented: RepresentationScenario | null = status === 'represented'
    ? {
        scenario_id: 'current_represented_posture',
        label: 'Current Represented Posture',
        description: `Resolution expectation with current counsel (${repSummary?.represented_by_current_attorney_name ?? 'counsel'}).`,
        range: {
          low: Math.round(factBased.low * RESOLUTION_ADJUSTMENTS.represented_counsel.low_pct),
          mid: Math.round(factBased.mid * RESOLUTION_ADJUSTMENTS.represented_counsel.mid_pct),
          high: Math.round(factBased.high * RESOLUTION_ADJUSTMENTS.represented_counsel.high_pct),
        },
        probability: 85,
        assumptions: [
          `Currently represented by ${repSummary?.represented_by_current_firm_name ?? 'counsel'}`,
          RESOLUTION_ADJUSTMENTS.represented_counsel.reason,
        ],
      }
    : null;

  return {
    direct_resolution_range_unrepresented: directResolution,
    likely_range_if_counsel_retained: counselRetained,
    early_resolution_opportunity_range: earlyResolution,
    current_represented_posture_range: currentRepresented,
  };
}

// ─── Expected Resolution Range ──────────────────────────

function computeExpectedResolution(
  factBased: FactBasedValueRange,
  repSummary: ClaimantRepresentationSummary | null,
  retentionRisk: number,
  snapshot: EvaluateIntakeSnapshot,
): ExpectedResolutionRange {
  const status = repSummary?.representation_status_current ?? 'unknown';

  if (status === 'represented') {
    const adj = RESOLUTION_ADJUSTMENTS.represented_counsel;
    return {
      low: Math.round(factBased.low * adj.low_pct),
      mid: Math.round(factBased.mid * adj.mid_pct),
      high: Math.round(factBased.high * adj.high_pct),
    };
  }

  if (status === 'unrepresented') {
    // Blend direct resolution with counsel-retention-weighted outcome
    const direct = RESOLUTION_ADJUSTMENTS.unrepresented_direct_resolution;
    const counsel = RESOLUTION_ADJUSTMENTS.represented_counsel;
    const riskWeight = retentionRisk / 100;

    return {
      low: Math.round(factBased.low * (direct.low_pct * (1 - riskWeight) + counsel.low_pct * riskWeight)),
      mid: Math.round(factBased.mid * (direct.mid_pct * (1 - riskWeight) + counsel.mid_pct * riskWeight)),
      high: Math.round(factBased.high * (direct.high_pct * (1 - riskWeight) + counsel.high_pct * riskWeight)),
    };
  }

  // Unknown status: use midpoint between direct and counsel
  return {
    low: Math.round(factBased.low * 0.60),
    mid: Math.round(factBased.mid * 0.70),
    high: Math.round(factBased.high * 0.82),
  };
}

// ─── Representation Notes ───────────────────────────────

function generateRepresentationNotes(
  repSummary: ClaimantRepresentationSummary | null,
): RepresentationNotes {
  const status = repSummary?.representation_status_current ?? 'unknown';

  return {
    value_rule_applied: 'Representation status did not directly reduce fact-based case value.',

    fact_value_independence_statement:
      'The fact-based value range is determined exclusively by the medical evidence, injury severity, treatment patterns, economic losses, and liability posture of this claim. ' +
      'Representation status has NO effect on the fact-based value range. A represented and an unrepresented claimant with identical claim facts will receive identical fact-based valuations.',

    resolution_context_explanation:
      status === 'represented'
        ? 'The expected resolution range reflects typical outcomes for represented claimants, where counsel involvement tends to achieve settlements closer to full claim value through structured negotiation and litigation posture.'
        : status === 'unrepresented'
          ? 'The expected resolution range reflects practical settlement dynamics for unrepresented claimants, including the probability of direct resolution and the risk of future attorney retention. This is a negotiation-context consideration, not a claim-merit adjustment.'
          : 'Representation status is unknown. The expected resolution range uses moderate assumptions about negotiation dynamics.',

    negotiation_context_summary:
      status === 'represented'
        ? 'Claimant is represented by counsel. Expected resolution reflects structured negotiation posture.'
        : status === 'unrepresented'
          ? 'Claimant is unrepresented. Expected resolution accounts for direct-resolution dynamics and attorney-retention risk.'
          : null,

    compliance_notes: [
      'Representation status is treated as a negotiation-context and scenario variable only.',
      'No representation-based haircut has been applied to fact-based damages.',
      'Attorney identity, firm reputation, and trial frequency are excluded from all valuation inputs per governance policy.',
      'Scenario ranges are provided for planning purposes and should not be interpreted as recommended settlement amounts.',
    ],
  };
}

// ─── Main Entry Point ───────────────────────────────────

export function computeRepresentationAwareValuation(
  rangeOutput: RangeEngineOutput,
  snapshot: EvaluateIntakeSnapshot,
  repSummary: ClaimantRepresentationSummary | null,
): RepresentationAwareValuation {
  // Fact-based value range comes directly from the settlement range engine
  // This is NEVER adjusted by representation status
  const factBased: FactBasedValueRange = {
    low: rangeOutput.floor,
    mid: rangeOutput.likely,
    high: rangeOutput.stretch,
  };

  const retentionRisk = computeAttorneyRetentionRisk(snapshot, repSummary);

  const expectedResolution = computeExpectedResolution(
    factBased, repSummary, retentionRisk, snapshot,
  );

  const scenarios = buildScenarios(factBased, repSummary, retentionRisk);

  const representationContext: EvalRepresentationContext = {
    representation_status_current: repSummary?.representation_status_current ?? 'unknown',
    representation_status_at_evaluation: repSummary?.representation_status_current ?? 'unknown',
    representation_transition_flag: repSummary?.representation_transition_flag ?? false,
    attorney_retained_during_claim_flag: repSummary?.attorney_retained_during_claim_flag ?? false,
    attorney_retained_after_initial_offer_flag: repSummary?.attorney_retained_after_initial_offer_flag ?? false,
    representation_history_count: repSummary?.representation_history_count ?? 0,
    attorney_retention_risk: retentionRisk,
    current_attorney_name: repSummary?.represented_by_current_attorney_name ?? null,
    current_firm_name: repSummary?.represented_by_current_firm_name ?? null,
  };

  const notes = generateRepresentationNotes(repSummary);

  return {
    fact_based_value_range: factBased,
    expected_resolution_range: expectedResolution,
    representation_context: representationContext,
    scenarios,
    representation_notes: notes,
  };
}
