/**
 * Representation Analytics — Shared Types
 *
 * Type definitions for the representation analytics fact table
 * and the three reporting views.
 */

// ─── Fact Table Row ─────────────────────────────────────

export interface RepresentationAnalyticsFact {
  id: string;
  tenant_id: string;
  case_id: string;

  representation_status_at_first_evaluation: string;
  representation_status_at_latest_evaluation: string;
  representation_status_at_first_offer: string | null;
  representation_status_at_settlement: string | null;
  representation_status_at_transfer: string | null;
  representation_status_at_close: string;
  representation_transition_flag: boolean;
  attorney_retained_during_claim_flag: boolean;
  attorney_retained_after_initial_offer_flag: boolean;
  unrepresented_resolved_flag: boolean;

  fact_based_value_mid: number | null;
  expected_resolution_mid: number | null;
  final_settlement_amount: number | null;
  settlement_to_fact_based_value_ratio: number | null;
  settlement_to_expected_resolution_ratio: number | null;

  time_to_settlement_days: number | null;
  time_to_retention_days: number | null;
  litigation_transfer_flag: boolean;

  severity_band: string | null;
  specials_band: string | null;
  liability_band: string | null;
  venue: string | null;
  surgery_flag: boolean | null;

  created_at: string;
  updated_at: string;
}

// ─── View 1: Represented vs Unrepresented Summary ───────

export interface RepresentedVsUnrepresentedSummary {
  tenant_id: string;
  represented_case_count: number;
  unrepresented_case_count: number;
  transitioned_case_count: number;
  avg_fact_based_value_mid_represented: number | null;
  avg_fact_based_value_mid_unrepresented: number | null;
  avg_expected_resolution_mid_represented: number | null;
  avg_expected_resolution_mid_unrepresented: number | null;
  avg_final_settlement_represented: number | null;
  avg_final_settlement_unrepresented: number | null;
}

// ─── View 2: Transition Analytics ───────────────────────

export interface RepresentationTransitionAnalytics {
  tenant_id: string;
  unrepresented_at_open_count: number;
  retained_counsel_later_count: number;
  retained_after_initial_offer_count: number;
  avg_days_to_retention: number | null;
  avg_settlement_if_never_retained: number | null;
  avg_settlement_if_retained_later: number | null;
}

// ─── View 3: Severity-Banded Comparison ─────────────────

export interface SeverityBandedRepresentationComparison {
  tenant_id: string;
  severity_band: string;
  representation_status_at_close: string;
  claim_count: number;
  avg_fact_based_value_mid: number | null;
  avg_final_settlement: number | null;
  avg_settlement_to_fact_based_ratio: number | null;
}

// ─── Mock Data Seeds ────────────────────────────────────

export const MOCK_SUMMARY: RepresentedVsUnrepresentedSummary = {
  tenant_id: "mock",
  represented_case_count: 142,
  unrepresented_case_count: 87,
  transitioned_case_count: 23,
  avg_fact_based_value_mid_represented: 34250,
  avg_fact_based_value_mid_unrepresented: 31800,
  avg_expected_resolution_mid_represented: 28400,
  avg_expected_resolution_mid_unrepresented: 26100,
  avg_final_settlement_represented: 27800,
  avg_final_settlement_unrepresented: 24500,
};

export const MOCK_TRANSITION: RepresentationTransitionAnalytics = {
  tenant_id: "mock",
  unrepresented_at_open_count: 110,
  retained_counsel_later_count: 23,
  retained_after_initial_offer_count: 14,
  avg_days_to_retention: 42.3,
  avg_settlement_if_never_retained: 24500,
  avg_settlement_if_retained_later: 31200,
};

export const MOCK_SEVERITY_BANDED: SeverityBandedRepresentationComparison[] = [
  { tenant_id: "mock", severity_band: "Minor", representation_status_at_close: "represented", claim_count: 48, avg_fact_based_value_mid: 12400, avg_final_settlement: 10800, avg_settlement_to_fact_based_ratio: 0.871 },
  { tenant_id: "mock", severity_band: "Minor", representation_status_at_close: "unrepresented", claim_count: 41, avg_fact_based_value_mid: 11900, avg_final_settlement: 10200, avg_settlement_to_fact_based_ratio: 0.857 },
  { tenant_id: "mock", severity_band: "Minor", representation_status_at_close: "transitioned", claim_count: 5, avg_fact_based_value_mid: 12100, avg_final_settlement: 10900, avg_settlement_to_fact_based_ratio: 0.901 },
  { tenant_id: "mock", severity_band: "Moderate", representation_status_at_close: "represented", claim_count: 52, avg_fact_based_value_mid: 32500, avg_final_settlement: 27100, avg_settlement_to_fact_based_ratio: 0.834 },
  { tenant_id: "mock", severity_band: "Moderate", representation_status_at_close: "unrepresented", claim_count: 31, avg_fact_based_value_mid: 30800, avg_final_settlement: 25400, avg_settlement_to_fact_based_ratio: 0.825 },
  { tenant_id: "mock", severity_band: "Moderate", representation_status_at_close: "transitioned", claim_count: 10, avg_fact_based_value_mid: 31600, avg_final_settlement: 27800, avg_settlement_to_fact_based_ratio: 0.880 },
  { tenant_id: "mock", severity_band: "Severe", representation_status_at_close: "represented", claim_count: 42, avg_fact_based_value_mid: 68200, avg_final_settlement: 54900, avg_settlement_to_fact_based_ratio: 0.805 },
  { tenant_id: "mock", severity_band: "Severe", representation_status_at_close: "unrepresented", claim_count: 15, avg_fact_based_value_mid: 64100, avg_final_settlement: 49800, avg_settlement_to_fact_based_ratio: 0.777 },
  { tenant_id: "mock", severity_band: "Severe", representation_status_at_close: "transitioned", claim_count: 8, avg_fact_based_value_mid: 66400, avg_final_settlement: 55200, avg_settlement_to_fact_based_ratio: 0.831 },
];
