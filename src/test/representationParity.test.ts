/**
 * EvaluateIQ — Representation Parity Tests
 *
 * Verifies that fact-based value range is IDENTICAL for represented
 * and unrepresented claimants with the same claim facts.
 */

import { describe, it, expect } from 'vitest';
import { computeRepresentationAwareValuation } from '@/lib/representationValuationEngine';
import { computeSettlementRange } from '@/lib/settlementRangeEngine';
import { extractValuationDrivers } from '@/lib/valuationDriverEngine';
import type { ClaimantRepresentationSummary } from '@/types/representation';
import { SCENARIOS } from '@/test/fixtures/evaluateFixtures';

const representedSummary: ClaimantRepresentationSummary = {
  representation_status_current: 'represented',
  represented_by_current_attorney_name: 'Jane Smith',
  represented_by_current_firm_name: 'Smith Law',
  representation_transition_flag: false,
  representation_history_count: 1,
  represented_at: '2024-01-01T00:00:00Z',
  unrepresented_confirmed_at: null,
  attorney_retained_during_claim_flag: true,
  attorney_retained_after_initial_offer_flag: false,
  unrepresented_resolved_flag: false,
};

const unrepresentedSummary: ClaimantRepresentationSummary = {
  representation_status_current: 'unrepresented',
  represented_by_current_attorney_name: null,
  represented_by_current_firm_name: null,
  representation_transition_flag: false,
  representation_history_count: 1,
  represented_at: null,
  unrepresented_confirmed_at: '2024-01-01T00:00:00Z',
  attorney_retained_during_claim_flag: false,
  attorney_retained_after_initial_offer_flag: false,
  unrepresented_resolved_flag: false,
};

describe('Representation Parity in Fact-Based Value', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.label}: fact-based value identical for represented vs unrepresented`, () => {
      const drivers = extractValuationDrivers(scenario.snapshot);
      const rangeOutput = computeSettlementRange(scenario.snapshot, drivers);

      const repValuation = computeRepresentationAwareValuation(rangeOutput, scenario.snapshot, representedSummary);
      const unrepValuation = computeRepresentationAwareValuation(rangeOutput, scenario.snapshot, unrepresentedSummary);

      // CORE INVARIANT: fact-based value must be identical
      expect(repValuation.fact_based_value_range.low).toBe(unrepValuation.fact_based_value_range.low);
      expect(repValuation.fact_based_value_range.mid).toBe(unrepValuation.fact_based_value_range.mid);
      expect(repValuation.fact_based_value_range.high).toBe(unrepValuation.fact_based_value_range.high);

      // Expected resolution CAN differ
      expect(repValuation.expected_resolution_range.mid).not.toBe(unrepValuation.expected_resolution_range.mid);

      // Representation notes must state independence
      expect(repValuation.representation_notes.fact_value_independence_statement).toContain('NO effect');
      expect(unrepValuation.representation_notes.fact_value_independence_statement).toContain('NO effect');
    });
  }

  it('unrepresented expected resolution is lower than represented', () => {
    const snapshot = SCENARIOS[0].snapshot;
    const drivers = extractValuationDrivers(snapshot);
    const rangeOutput = computeSettlementRange(snapshot, drivers);

    const rep = computeRepresentationAwareValuation(rangeOutput, snapshot, representedSummary);
    const unrep = computeRepresentationAwareValuation(rangeOutput, snapshot, unrepresentedSummary);

    expect(unrep.expected_resolution_range.mid).toBeLessThan(rep.expected_resolution_range.mid);
  });

  it('scenarios are generated for unrepresented claimants', () => {
    const snapshot = SCENARIOS[0].snapshot;
    const drivers = extractValuationDrivers(snapshot);
    const rangeOutput = computeSettlementRange(snapshot, drivers);

    const val = computeRepresentationAwareValuation(rangeOutput, snapshot, unrepresentedSummary);
    expect(val.scenarios.direct_resolution_range_unrepresented).not.toBeNull();
    expect(val.scenarios.likely_range_if_counsel_retained).not.toBeNull();
    expect(val.scenarios.early_resolution_opportunity_range).not.toBeNull();
    expect(val.scenarios.current_represented_posture_range).toBeNull();
  });

  it('scenarios are generated for represented claimants', () => {
    const snapshot = SCENARIOS[0].snapshot;
    const drivers = extractValuationDrivers(snapshot);
    const rangeOutput = computeSettlementRange(snapshot, drivers);

    const val = computeRepresentationAwareValuation(rangeOutput, snapshot, representedSummary);
    expect(val.scenarios.current_represented_posture_range).not.toBeNull();
    expect(val.scenarios.direct_resolution_range_unrepresented).toBeNull();
  });
});
