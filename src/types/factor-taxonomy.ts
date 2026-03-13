/**
 * EvaluateIQ — Factor Taxonomy Types
 *
 * Typed definitions for the governed factor registry.
 * Every factor has an id, layer, scoring model, evidence requirements,
 * and explanation template.
 */

// ─── Layers ────────────────────────────────────────────

export type FactorLayer = 0 | 1 | 2 | 3 | 4 | 5;

export const FACTOR_LAYER_META: Record<FactorLayer, { label: string; description: string }> = {
  0: { label: "Eligibility & Readiness Gates", description: "Preconditions that must be met before merit evaluation can begin." },
  1: { label: "Injury Merit Factors", description: "Core injury characteristics that establish the claim's intrinsic merit." },
  2: { label: "Treatment Pattern & Clinical Coherence", description: "Treatment behavior, continuity, and clinical coherence signals." },
  3: { label: "Functional & Life Impact", description: "Work impact, daily living restrictions, and quality of life effects." },
  4: { label: "Economic & Specials-Related", description: "Documented economic losses and medical cost exposure." },
  5: { label: "Post-Merit Adjustments", description: "Adjustments applied after merit scoring to reflect legal and practical realities." },
};

// ─── Score Type ─────────────────────────────────────────

export type FactorScoreType =
  | "ordinal_0_5"       // 0–5 bounded ordinal
  | "binary"            // 0 or 1 (gate pass/fail)
  | "percentage"        // 0–100
  | "multiplier"        // e.g. 0.8–1.2
  | "dollar_adjustment" // signed dollar amount
  | "not_scored";       // informational only

// ─── Evidence Requirement ───────────────────────────────

export type EvidenceRequirement = "required" | "recommended" | "optional";

// ─── Factor Direction ───────────────────────────────────

export type FactorDirection = "expander" | "reducer" | "constraint" | "neutral" | "variable";

// ─── Factor Definition ─────────────────────────────────

export interface FactorDefinition {
  /** Unique stable identifier (snake_case) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Factor layer (0–5) */
  layer: FactorLayer;
  /** Factor family for grouping */
  family: string;
  /** Description of what this factor measures */
  description: string;
  /** What intake data this factor depends on */
  input_dependencies: string[];
  /** Scoring model */
  score_type: FactorScoreType;
  /** Min/max for ordinal scores */
  scale_min: number;
  scale_max: number;
  /** Typical direction of impact */
  default_direction: FactorDirection;
  /** Evidence requirements */
  evidence_requirement: EvidenceRequirement;
  /** Template for generating the explanation narrative */
  explanation_template: string;
  /** Governance metadata */
  version: string;
  /** When this factor definition was last updated */
  effective_date: string;
  /** Whether this factor is active in scoring */
  is_active: boolean;
  /** Prohibited: factors that must never be used */
  prohibited: boolean;
  /** Internal admin notes (not shown to end users) */
  admin_notes: string;
}

// ─── Scored Factor ──────────────────────────────────────

export interface ScoredFactor {
  factor_id: string;
  /** Reference to definition */
  definition: FactorDefinition;
  /** The raw input value (for auditability) */
  raw_input: string;
  /** The computed score */
  score: number;
  /** Direction of impact for this specific scoring */
  direction: FactorDirection;
  /** Generated narrative */
  narrative: string;
  /** Evidence reference IDs */
  evidence_ref_ids: string[];
  /** Whether this factor was actually applicable */
  applicable: boolean;
  /** If not applicable, why */
  inapplicable_reason: string | null;
  /** Confidence in the score */
  confidence: "high" | "moderate" | "low";
}

// ─── Layer Summary ──────────────────────────────────────

export interface LayerSummary {
  layer: FactorLayer;
  label: string;
  factor_count: number;
  scored_count: number;
  gate_passed: boolean | null; // only for layer 0
  avg_score: number | null;
  net_direction: FactorDirection;
}

// ─── Registry Result ────────────────────────────────────

export interface FactorScoringResult {
  scored_factors: ScoredFactor[];
  layer_summaries: LayerSummary[];
  /** Overall readiness gate status (all layer 0 gates passed) */
  gates_passed: boolean;
  gate_failures: string[];
  /** Total number of applicable factors */
  applicable_count: number;
  /** Total number of factors with evidence */
  evidenced_count: number;
}
