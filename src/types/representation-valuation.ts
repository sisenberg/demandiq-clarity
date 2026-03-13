/**
 * EvaluateIQ — Representation-Aware Valuation Types
 *
 * Extends the evaluation output with dual-range (fact-based vs expected resolution),
 * representation context, scenario modeling, and representation notes.
 *
 * Core rule: Representation status is a negotiation-context variable,
 * NOT a standalone negative injury-value factor.
 */

import type { RepresentationStatus } from './representation';

// ─── Representation Context for Evaluation ──────────────

export interface EvalRepresentationContext {
  /** Current representation status at time of evaluation */
  representation_status_current: RepresentationStatus;
  /** Status recorded at the moment the evaluation was generated */
  representation_status_at_evaluation: RepresentationStatus;
  /** True if claimant has transitioned between represented/unrepresented */
  representation_transition_flag: boolean;
  /** True if attorney was retained at any point during the claim */
  attorney_retained_during_claim_flag: boolean;
  /** True if attorney was retained after an initial offer was made */
  attorney_retained_after_initial_offer_flag: boolean;
  /** Total number of representation history records */
  representation_history_count: number;
  /** Risk assessment for attorney retention (0-100) */
  attorney_retention_risk: number;
  /** Current attorney name */
  current_attorney_name: string | null;
  /** Current firm name */
  current_firm_name: string | null;
}

// ─── Dual Value Ranges ──────────────────────────────────

/** Fact-based value range — grounded purely in claim facts, never adjusted by representation */
export interface FactBasedValueRange {
  low: number;
  mid: number;
  high: number;
}

/** Expected resolution range — considers representation context, documentation quality, and practical resolution factors */
export interface ExpectedResolutionRange {
  low: number;
  mid: number;
  high: number;
}

// ─── Scenario Modeling ──────────────────────────────────

export interface RepresentationScenario {
  scenario_id: string;
  label: string;
  description: string;
  range: { low: number; mid: number; high: number };
  /** Probability assessment (0-100) for this scenario */
  probability: number;
  assumptions: string[];
}

export interface RepresentationScenarioSet {
  /** Direct resolution range if claimant remains unrepresented */
  direct_resolution_range_unrepresented: RepresentationScenario | null;
  /** Likely range if counsel is retained */
  likely_range_if_counsel_retained: RepresentationScenario | null;
  /** Early resolution opportunity (before litigation or counsel retention) */
  early_resolution_opportunity_range: RepresentationScenario | null;
  /** Current represented posture range (if currently represented) */
  current_represented_posture_range: RepresentationScenario | null;
}

// ─── Representation Notes ───────────────────────────────

export interface RepresentationNotes {
  /** Required rule statement — must be present for publication */
  value_rule_applied: string;
  /** Explicit statement that representation did not reduce fact-based value */
  fact_value_independence_statement: string;
  /** How representation context influenced expected resolution range */
  resolution_context_explanation: string;
  /** Recommended: summary of how representation context was considered in negotiation posture */
  negotiation_context_summary: string | null;
  /** Any additional compliance notes */
  compliance_notes: string[];
}

// ─── Combined Evaluation Output Extension ───────────────

export interface RepresentationAwareValuation {
  /** Fact-based value range — pure claim merit, unaffected by representation */
  fact_based_value_range: FactBasedValueRange;
  /** Expected resolution range — practical settlement expectation */
  expected_resolution_range: ExpectedResolutionRange;
  /** Representation context captured at evaluation time */
  representation_context: EvalRepresentationContext;
  /** Scenario modeling for different representation postures */
  scenarios: RepresentationScenarioSet;
  /** Explicit notes about representation/value independence */
  representation_notes: RepresentationNotes;
}

// ─── Representation / Negotiation Context Factor Family ─
// This family affects expected resolution confidence, NOT fact-based value.

export interface RepresentationContextFactor {
  factor_id: string;
  label: string;
  family: 'representation_negotiation_context';
  /** Direction of impact on expected resolution (not on fact-based value) */
  direction: 'narrows_resolution' | 'widens_resolution' | 'neutral';
  /** Score 0–100 */
  score: number;
  narrative: string;
  /** Whether this factor affects the expected resolution range */
  affects_expected_resolution: true;
  /** This factor never affects fact-based value */
  affects_fact_based_value: false;
}
