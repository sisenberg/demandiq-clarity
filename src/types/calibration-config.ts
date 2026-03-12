/**
 * EvaluateIQ — Calibration Configuration Types
 *
 * Typed contracts for versioned, tunable engine parameters.
 * Every constant in the settlement range engine is inspectable
 * and adjustable through this configuration layer.
 */

// ─── Severity Multiplier Config ──────────────────────────

export interface SeverityBandConfig {
  floor: number;
  likely: number;
  stretch: number;
}

export interface SeverityMultiplierConfig {
  baseline: SeverityBandConfig;
  moderate: SeverityBandConfig;
  severe: SeverityBandConfig;
  catastrophic: SeverityBandConfig;
}

// ─── Clinical Adjustment Config ──────────────────────────

export interface ClinicalAdjustmentConfig {
  surgery: SeverityBandConfig & { reason: string };
  permanency: SeverityBandConfig & { reason: string };
  impairment_rating: SeverityBandConfig & { reason: string };
  injections: SeverityBandConfig & { reason: string };
  scarring: SeverityBandConfig & { reason: string };
  advanced_imaging: SeverityBandConfig & { reason: string };
}

// ─── Reliability Reduction Config ────────────────────────

export interface ReliabilityReductionConfig {
  treatment_gap: { factor: number; reason: string };
  passive_concentration: { factor: number; reason: string };
  reasonableness_concerns: { factor: number; reason: string };
  billing_reduction: { factor: number; reason: string };
  credibility_issues: { factor: number; reason: string };
}

// ─── Venue Multiplier Config ─────────────────────────────

export interface VenueMultiplierConfig {
  plaintiff_friendly: number;
  neutral: number;
  defense_friendly: number;
}

// ─── Confidence Rules Config ─────────────────────────────

export interface ConfidenceRulesConfig {
  completeness_weight: number;
  coverage_weight: number;
  stability_weight: number;
  critical_warning_penalty: number;
  warning_penalty: number;
  high_threshold: number;
  moderate_threshold: number;
  low_threshold: number;
}

// ─── Full Calibration Config ─────────────────────────────

export interface CalibrationConfig {
  id: string;
  tenant_id: string;
  version: number;
  is_active: boolean;
  severity_multipliers: SeverityMultiplierConfig;
  clinical_adjustments: ClinicalAdjustmentConfig;
  reliability_reductions: ReliabilityReductionConfig;
  venue_multipliers: VenueMultiplierConfig;
  confidence_rules: ConfidenceRulesConfig;
  rounding_rules: Record<string, unknown>;
  change_reason: string;
  changed_by: string;
  change_summary: string;
  created_at: string;
}

// ─── Default (hardcoded v1 values) ───────────────────────

export const DEFAULT_SEVERITY_MULTIPLIERS: SeverityMultiplierConfig = {
  baseline:     { floor: 1.0, likely: 1.5, stretch: 2.5 },
  moderate:     { floor: 1.5, likely: 2.5, stretch: 4.0 },
  severe:       { floor: 2.5, likely: 4.0, stretch: 6.0 },
  catastrophic: { floor: 4.0, likely: 7.0, stretch: 12.0 },
};

export const DEFAULT_CLINICAL_ADJUSTMENTS: ClinicalAdjustmentConfig = {
  surgery:          { floor: 0.5, likely: 1.0, stretch: 1.5, reason: "Surgical intervention" },
  permanency:       { floor: 0.5, likely: 1.0, stretch: 2.0, reason: "Permanency / impairment indicators" },
  impairment_rating:{ floor: 0.3, likely: 0.5, stretch: 1.0, reason: "Formal impairment rating documented" },
  injections:       { floor: 0.2, likely: 0.4, stretch: 0.6, reason: "Interventional injection procedures" },
  scarring:         { floor: 0.1, likely: 0.3, stretch: 0.5, reason: "Scarring / disfigurement" },
  advanced_imaging: { floor: 0.1, likely: 0.2, stretch: 0.3, reason: "Advanced imaging (MRI/CT) with findings" },
};

export const DEFAULT_RELIABILITY_REDUCTIONS: ReliabilityReductionConfig = {
  treatment_gap:           { factor: 0.03, reason: "Treatment gap >30 days identified" },
  passive_concentration:   { factor: 0.04, reason: "High passive-treatment concentration" },
  reasonableness_concerns: { factor: 0.05, reason: "Reasonableness concerns from medical review" },
  billing_reduction:       { factor: 0.03, reason: "Significant billing reductions by reviewer" },
  credibility_issues:      { factor: 0.04, reason: "Claimant credibility concerns" },
};

export const DEFAULT_VENUE_MULTIPLIERS: VenueMultiplierConfig = {
  plaintiff_friendly: 1.05,
  neutral: 1.0,
  defense_friendly: 0.90,
};

export const DEFAULT_CONFIDENCE_RULES: ConfidenceRulesConfig = {
  completeness_weight: 0.40,
  coverage_weight: 0.30,
  stability_weight: 0.30,
  critical_warning_penalty: 30,
  warning_penalty: 10,
  high_threshold: 75,
  moderate_threshold: 50,
  low_threshold: 25,
};

export function getDefaultCalibrationConfig(): Omit<CalibrationConfig, "id" | "tenant_id" | "version" | "changed_by" | "created_at"> {
  return {
    is_active: false,
    severity_multipliers: DEFAULT_SEVERITY_MULTIPLIERS,
    clinical_adjustments: DEFAULT_CLINICAL_ADJUSTMENTS,
    reliability_reductions: DEFAULT_RELIABILITY_REDUCTIONS,
    venue_multipliers: DEFAULT_VENUE_MULTIPLIERS,
    confidence_rules: DEFAULT_CONFIDENCE_RULES,
    rounding_rules: {},
    change_reason: "",
    change_summary: "",
  };
}

// ─── Drift Analysis Types ────────────────────────────────

export interface DriftDataPoint {
  claim_id: string;
  predicted_floor: number;
  predicted_likely: number;
  predicted_stretch: number;
  actual_settlement: number;
  accuracy_label: "within_range" | "below_floor" | "above_stretch";
  venue_state: string;
  attorney_name: string;
  injury_categories: string[];
  provider_names: string[];
  billed_specials: number | null;
}

export interface DriftSlice {
  dimension: string;
  value: string;
  count: number;
  within_range_pct: number;
  below_floor_pct: number;
  above_stretch_pct: number;
  mean_error_pct: number;
  median_settlement: number;
}

export interface DriftSummary {
  total_claims: number;
  within_range_count: number;
  below_floor_count: number;
  above_stretch_count: number;
  overall_accuracy_pct: number;
  mean_absolute_error_pct: number;
  slices_by_venue: DriftSlice[];
  slices_by_attorney: DriftSlice[];
  slices_by_injury: DriftSlice[];
  slices_by_specials_band: DriftSlice[];
}

export interface ConfigImpactPreview {
  cases_affected: number;
  total_cases: number;
  avg_floor_delta_pct: number;
  avg_likely_delta_pct: number;
  avg_stretch_delta_pct: number;
  material_shift_count: number;
  material_shift_threshold_pct: number;
  warning: string | null;
  sample_impacts: Array<{
    claim_id: string;
    before_likely: number;
    after_likely: number;
    delta_pct: number;
  }>;
}
