/**
 * EvaluateIQ — Modifier Layer Types
 *
 * Typed contracts for defensibility and settlement posture modifiers
 * that adjust the valuation range OUTSIDE pure medical damages.
 *
 * Modifier groups:
 *  1. Liability
 *  2. Causation
 *  3. Claim Posture (including representation status)
 *  4. Venue / Forum
 *
 * DESIGN:
 *  - Modifiers are separate from base damages factors (Layers 1–4).
 *  - Each modifier record stores its source (system-derived vs user-entered).
 *  - Representation status is a first-class, reporting-ready field.
 *  - Supervisor overrides carry explanation and audit metadata.
 */

// ─── Modifier Group ─────────────────────────────────────

export type ModifierGroup = "liability" | "causation" | "claim_posture" | "venue_forum";

export type ModifierDirection = "positive" | "negative" | "neutral";

export type ModifierSource = "system_derived" | "user_entered" | "supervisor_override";

export type ModifierConfidence = "high" | "moderate" | "low" | "missing";

// ─── Representation Status (reporting-ready) ────────────

export type RepresentationStatus = "represented" | "unrepresented" | "unknown";

export interface RepresentationContext {
  status: RepresentationStatus;
  attorney_name: string | null;
  firm_name: string | null;
  is_known_attorney: boolean;
  retention_date: string | null;
  /** Whether representation status changed during claim lifecycle */
  transitioned: boolean;
  source: ModifierSource;
}

// ─── Individual Modifier Record ─────────────────────────

export interface ModifierRecord {
  /** Unique stable key (e.g., "liability_accepted") */
  id: string;
  /** Human-readable label */
  label: string;
  /** Which group this modifier belongs to */
  group: ModifierGroup;
  /** Direction of impact on the corridor */
  direction: ModifierDirection;
  /** Effect magnitude as a corridor score delta (-30 to +30) */
  effect_magnitude: number;
  /** System-computed or user-entered value */
  current_value: string;
  /** Human-readable explanation of why this modifier applied */
  explanation: string;
  /** Evidence references supporting this modifier */
  evidence_refs: string[];
  /** Evidence description for UI display */
  evidence_summary: string;
  /** Whether this was system-derived or user-entered */
  source: ModifierSource;
  /** Confidence in this modifier */
  confidence: ModifierConfidence;
  /** Whether this modifier was actually applied */
  applied: boolean;
  /** Reason if not applied */
  skip_reason: string | null;
}

// ─── Supervisor Override ────────────────────────────────

export interface ModifierOverride {
  modifier_id: string;
  original_value: string;
  original_direction: ModifierDirection;
  original_magnitude: number;
  override_value: string;
  override_direction: ModifierDirection;
  override_magnitude: number;
  override_reason: string;
  overridden_by: string;
  overridden_by_name: string;
  overridden_at: string;
}

// ─── Confidence Degradation ─────────────────────────────

export interface ConfidenceDegradation {
  /** Which modifier field is missing */
  modifier_id: string;
  label: string;
  /** How many confidence points this costs */
  penalty: number;
  /** Description of the impact */
  impact_description: string;
}

// ─── Modifier Group Summary ─────────────────────────────

export interface ModifierGroupSummary {
  group: ModifierGroup;
  label: string;
  modifier_count: number;
  applied_count: number;
  net_effect: number;
  net_direction: ModifierDirection;
  confidence: ModifierConfidence;
  /** Average confidence across modifiers in this group */
  has_overrides: boolean;
}

// ─── Full Modifier Layer Output ─────────────────────────

export interface ModifierLayerResult {
  engine_version: string;
  computed_at: string;

  /** All modifiers across all groups */
  modifiers: ModifierRecord[];

  /** Applied modifiers only */
  applied_modifiers: ModifierRecord[];

  /** Group summaries */
  group_summaries: ModifierGroupSummary[];

  /** Net corridor effect across all modifiers */
  net_effect: {
    low_delta: number;
    mid_delta: number;
    high_delta: number;
  };

  /** Overall net direction */
  net_direction: ModifierDirection;

  /** Representation context (reporting-ready) */
  representation: RepresentationContext;

  /** Confidence degradations for missing fields */
  confidence_degradations: ConfidenceDegradation[];

  /** Total confidence penalty from missing fields */
  total_confidence_penalty: number;

  /** Active supervisor overrides */
  overrides: ModifierOverride[];

  /** Audit-ready summary */
  audit_summary: string;
}

// ─── Modifier Definition (registry-style) ───────────────

export interface ModifierDefinition {
  id: string;
  label: string;
  group: ModifierGroup;
  description: string;
  /** What intake fields this modifier reads */
  input_fields: string[];
  /** Default direction when the modifier applies */
  default_direction: ModifierDirection;
  /** Maximum magnitude (absolute) */
  max_magnitude: number;
  /** Whether missing data for this modifier degrades confidence */
  degrades_confidence_if_missing: boolean;
  /** Confidence penalty when missing */
  missing_confidence_penalty: number;
}
