/**
 * EvaluateIQ — Explanation Ledger Types
 *
 * Structured contracts for the explanation ledger that makes
 * every valuation number traceable and defensible.
 *
 * DESIGN:
 *  - Each entry ties a value driver to its effect, magnitude,
 *    narrative, and evidence references.
 *  - Machine-derived entries are clearly separated from
 *    human-adopted entries.
 *  - The full ledger is included in saved valuation runs
 *    and published package payloads.
 */

// ─── Ledger Entry ────────────────────────────────────────

export type LedgerEntrySource = "engine" | "human_override" | "system_constraint";

export type LedgerEffectDirection = "increase" | "decrease" | "neutral" | "constraint";

export type LedgerCategory =
  | "economic_base"
  | "severity_multiplier"
  | "clinical_adjustment"
  | "liability"
  | "comparative_fault"
  | "treatment_reliability"
  | "policy_constraint"
  | "venue"
  | "credibility"
  | "prior_conditions"
  | "wage_loss"
  | "future_medical"
  | "human_assumption";

export interface LedgerEntry {
  /** Stable key for deduplication and diffing */
  entry_key: string;

  /** Human-readable title */
  title: string;

  /** Which part of the range this affects */
  category: LedgerCategory;

  /** Did this push value up, down, or cap it? */
  direction: LedgerEffectDirection;

  /** Quantified contribution where possible */
  magnitude: LedgerMagnitude;

  /** Claims-friendly narrative explanation */
  narrative: string;

  /** Where did this entry come from? */
  source: LedgerEntrySource;

  /** Evidence reference IDs from extracted_facts / evidence_links */
  evidence_ref_ids: string[];

  /** Upstream driver key if derived from valuation driver engine */
  driver_key: string | null;

  /** Source package lineage */
  lineage: LedgerLineage;
}

export interface LedgerMagnitude {
  /** Numeric contribution amount (e.g., $15,000 or 1.5x) */
  value: number | null;

  /** Unit of the magnitude */
  unit: "dollars" | "multiplier" | "percentage" | "factor" | "count";

  /** Formatted display string */
  display: string;
}

export interface LedgerLineage {
  /** Which module produced the upstream data */
  source_module: "demandiq" | "revieweriq" | "evaluateiq";

  /** Snapshot version consumed */
  snapshot_version: number;

  /** Engine version that produced this entry */
  engine_version: string;

  /** When this entry was computed */
  computed_at: string;
}

// ─── Full Ledger ─────────────────────────────────────────

export interface ExplanationLedger {
  /** Engine version that produced this ledger */
  engine_version: string;

  /** When the ledger was built */
  built_at: string;

  /** All entries, ordered by impact magnitude (descending) */
  entries: LedgerEntry[];

  /** Summary counts */
  summary: LedgerSummary;
}

export interface LedgerSummary {
  total_entries: number;
  increase_count: number;
  decrease_count: number;
  neutral_count: number;
  constraint_count: number;
  human_override_count: number;
  evidence_linked_count: number;
  categories_covered: LedgerCategory[];
}
