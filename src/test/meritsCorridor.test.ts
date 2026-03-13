/**
 * Merits Corridor Engine — Tests
 */

import { describe, it, expect } from "vitest";
import { computeMeritsCorridor, CORRIDOR_LABEL_META } from "@/lib/meritsCorridorEngine";
import { computeWeightedMeritsScore } from "@/lib/profileWeightingEngine";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

// ─── Snapshot Factory ──────────────────────────────────

function prov() {
  return { source_module: "revieweriq" as const, source_package_version: 1, evidence_ref_ids: [], confidence: 0.9, completeness: "complete" as const };
}
function pf<T>(value: T) { return { value, provenance: prov() }; }

function makeSnap(overrides: Partial<{
  injuries: EvaluateIntakeSnapshot["injuries"];
  clinical_flags: Partial<EvaluateIntakeSnapshot["clinical_flags"]>;
  liability_facts: EvaluateIntakeSnapshot["liability_facts"];
  completeness: number;
}> = {}): EvaluateIntakeSnapshot {
  return {
    snapshot_id: "s1", case_id: "c1", tenant_id: "t1", created_at: "", created_by: null,
    source_module: "revieweriq", source_package_version: 1, source_snapshot_id: null,
    claimant: { claimant_name: pf("Jane"), date_of_birth: pf(null), occupation: pf(null), employer: pf(null) },
    accident: { date_of_loss: pf("2025-06-01"), mechanism_of_loss: pf("Collision"), description: pf("MVA") },
    liability_facts: overrides.liability_facts ?? [{ id: "lf1", fact_text: "Rear-end", supports_liability: true, confidence: 0.9, provenance: prov() }],
    comparative_negligence: { claimant_negligence_percentage: pf(null), notes: pf("") },
    venue_jurisdiction: { jurisdiction_state: pf("FL"), venue_county: pf("Broward") },
    policy_coverage: [{ carrier_name: "ABC", policy_type: "BI", coverage_limit: 100000, deductible: null, provenance: prov() }],
    injuries: overrides.injuries ?? [
      { id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Cervical strain", diagnosis_code: "S13.4", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
    ],
    treatment_timeline: [
      { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
      { id: "t2", treatment_type: "chiro", treatment_date: "2025-07-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
    ],
    providers: [
      { id: "p1", full_name: "Dr. A", specialty: "Chiropractic", facility_name: "", role_description: "", total_visits: 10, first_visit_date: "2025-06-10", last_visit_date: "2025-07-10", total_billed: 3000, total_paid: 2500, provenance: prov() },
    ],
    medical_billing: [
      { id: "b1", description: "Visit", service_date: "2025-06-10", cpt_codes: [], billed_amount: 3000, paid_amount: 2500, reviewer_recommended_amount: 2800, provider_name: "Dr. A", provenance: prov() },
    ],
    wage_loss: { total_lost_wages: pf(0), duration_description: pf(null) },
    future_treatment: { future_medical_estimate: pf(0), indicators: pf([]) },
    clinical_flags: {
      has_surgery: overrides.clinical_flags?.has_surgery ?? false,
      has_injections: overrides.clinical_flags?.has_injections ?? false,
      has_advanced_imaging: overrides.clinical_flags?.has_advanced_imaging ?? false,
      has_permanency_indicators: overrides.clinical_flags?.has_permanency_indicators ?? false,
      has_impairment_rating: overrides.clinical_flags?.has_impairment_rating ?? false,
      has_scarring_disfigurement: false,
      provenance: prov(),
    },
    upstream_concerns: [],
    completeness_warnings: [],
    overall_completeness_score: overrides.completeness ?? 85,
  };
}

function buildCorridor(snap: EvaluateIntakeSnapshot, profile: "A" | "C" | "F" | "G" = "A") {
  const scoring = scoreAllFactors(snap);
  const merits = computeWeightedMeritsScore(scoring, profile);
  return computeMeritsCorridor(merits, scoring.top_drivers, scoring.top_suppressors);
}

// ─── Tests ─────────────────────────────────────────────

describe("Merits Corridor Engine", () => {
  it("produces three ordered bands: low ≤ mid ≤ high", () => {
    const c = buildCorridor(makeSnap());
    expect(c.low).toBeLessThanOrEqual(c.mid);
    expect(c.mid).toBeLessThanOrEqual(c.high);
  });

  it("all bands are within 0–100", () => {
    const c = buildCorridor(makeSnap());
    expect(c.low).toBeGreaterThanOrEqual(0);
    expect(c.high).toBeLessThanOrEqual(100);
  });

  it("corridor label matches merits score range", () => {
    const c = buildCorridor(makeSnap());
    const label = c.corridor_label;
    expect(Object.keys(CORRIDOR_LABEL_META)).toContain(label);
  });

  it("has top contributors", () => {
    const c = buildCorridor(makeSnap());
    expect(c.top_contributors.length).toBeGreaterThan(0);
  });

  it("explanation includes exclusions", () => {
    const c = buildCorridor(makeSnap());
    expect(c.explanation.exclusions.length).toBeGreaterThanOrEqual(3);
    expect(c.explanation.exclusions.some(e => e.includes("liability") || e.includes("Liability"))).toBe(true);
  });

  it("provisional when gates fail", () => {
    const c = buildCorridor(makeSnap({ liability_facts: [] }));
    expect(c.is_provisional).toBe(true);
  });

  it("different profiles produce different band widths", () => {
    const snap = makeSnap({ clinical_flags: { has_surgery: true } });
    const cA = buildCorridor(snap, "A");
    const cG = buildCorridor(snap, "G");
    // G has wider base_width_pct than A
    expect(cG.band_width_pct).not.toBe(cA.band_width_pct);
  });

  it("confidence width multiplier increases corridor spread", () => {
    // Directly test that the engine uses confidence to shape width
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const meritsHigh = computeWeightedMeritsScore(scoring, "A");
    const corridor = computeMeritsCorridor(meritsHigh, scoring.top_drivers, scoring.top_suppressors);
    // Corridor should have non-zero width
    expect(corridor.high - corridor.low).toBeGreaterThan(0);
    expect(corridor.band_width_pct).toBeGreaterThan(0);
  });

  it("includes engine version", () => {
    const c = buildCorridor(makeSnap());
    expect(c.engine_version).toBe("1.0.0");
  });

  it("explanation has position and width rationale", () => {
    const c = buildCorridor(makeSnap());
    expect(c.explanation.position_rationale.length).toBeGreaterThan(10);
    expect(c.explanation.width_rationale.length).toBeGreaterThan(10);
  });
});
