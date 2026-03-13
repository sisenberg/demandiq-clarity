/**
 * Post-Merit Adjustment Engine — Tests
 */

import { describe, it, expect } from "vitest";
import {
  computePostMeritAdjustments,
  type AdjustedSettlementCorridor,
  type AdjustmentConfig,
} from "@/lib/postMeritAdjustmentEngine";
import { computeMeritsCorridor } from "@/lib/meritsCorridorEngine";
import { computeWeightedMeritsScore } from "@/lib/profileWeightingEngine";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

// ─── Snapshot Factory ──────────────────────────────────

function prov() {
  return { source_module: "revieweriq" as const, source_package_version: 1, evidence_ref_ids: [], confidence: 0.9, completeness: "complete" as const };
}
function pf<T>(value: T) { return { value, provenance: prov() }; }

function makeSnap(overrides: Partial<{
  comparative_negligence_pct: number | null;
  pre_existing_count: number;
  completeness: number;
  jurisdiction: string;
  upstream_concerns: EvaluateIntakeSnapshot["upstream_concerns"];
  coverage_limit: number;
  has_surgery: boolean;
  has_permanency: boolean;
}> = {}): EvaluateIntakeSnapshot {
  const preEx = overrides.pre_existing_count ?? 0;
  const injuries = [
    { id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Cervical strain", diagnosis_code: "S13.4", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
    ...Array.from({ length: preEx }, (_, i) => ({
      id: `ipre${i}`, body_part: "Back", body_region: "back", diagnosis_description: "Pre-existing DDD", diagnosis_code: "M51.1", severity: "mild", is_pre_existing: true, date_of_onset: null, provenance: prov(),
    })),
  ];

  return {
    snapshot_id: "s1", case_id: "c1", tenant_id: "t1", created_at: "", created_by: null,
    source_module: "revieweriq", source_package_version: 1, source_snapshot_id: null,
    claimant: { claimant_name: pf("Jane"), date_of_birth: pf(null), occupation: pf(null), employer: pf(null) },
    accident: { date_of_loss: pf("2025-06-01"), mechanism_of_loss: pf("Collision"), description: pf("MVA") },
    liability_facts: [{ id: "lf1", fact_text: "Rear-end", supports_liability: true, confidence: 0.9, provenance: prov() }],
    comparative_negligence: { claimant_negligence_percentage: pf(overrides.comparative_negligence_pct ?? null), notes: pf("") },
    venue_jurisdiction: { jurisdiction_state: pf(overrides.jurisdiction ?? "PA"), venue_county: pf("Philadelphia") },
    policy_coverage: [{ carrier_name: "ABC", policy_type: "BI", coverage_limit: overrides.coverage_limit ?? 100000, deductible: null, provenance: prov() }],
    injuries,
    treatment_timeline: [
      { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
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
      has_surgery: overrides.has_surgery ?? false,
      has_injections: false,
      has_advanced_imaging: false,
      has_permanency_indicators: overrides.has_permanency ?? false,
      has_impairment_rating: false,
      has_scarring_disfigurement: false,
      provenance: prov(),
    },
    upstream_concerns: overrides.upstream_concerns ?? [],
    completeness_warnings: [],
    overall_completeness_score: overrides.completeness ?? 85,
  };
}

function buildResult(snap: EvaluateIntakeSnapshot, config?: AdjustmentConfig) {
  const scoring = scoreAllFactors(snap);
  const merits = computeWeightedMeritsScore(scoring, "A");
  const corridor = computeMeritsCorridor(merits, scoring.top_drivers, scoring.top_suppressors);
  return computePostMeritAdjustments(corridor, snap, config);
}

// ─── Tests ─────────────────────────────────────────────

describe("Post-Merit Adjustment Engine", () => {
  it("produces 5 adjustments (all categories)", () => {
    const r = buildResult(makeSnap());
    expect(r.adjustments).toHaveLength(5);
  });

  it("preserves merits corridor in output", () => {
    const r = buildResult(makeSnap());
    expect(r.merits_corridor.low).toBeDefined();
    expect(r.merits_corridor.mid).toBeDefined();
    expect(r.merits_corridor.high).toBeDefined();
  });

  it("adjusted bands maintain ordering: low ≤ mid ≤ high", () => {
    const r = buildResult(makeSnap({ comparative_negligence_pct: 30, pre_existing_count: 2 }));
    expect(r.adjusted.low).toBeLessThanOrEqual(r.adjusted.mid);
    expect(r.adjusted.mid).toBeLessThanOrEqual(r.adjusted.high);
  });

  it("adjusted bands are clamped 0–100", () => {
    const r = buildResult(makeSnap({ comparative_negligence_pct: 80, pre_existing_count: 3, completeness: 20 }));
    expect(r.adjusted.low).toBeGreaterThanOrEqual(0);
    expect(r.adjusted.high).toBeLessThanOrEqual(100);
  });

  it("comparative negligence reduces corridor", () => {
    const base = buildResult(makeSnap());
    const withNegl = buildResult(makeSnap({ comparative_negligence_pct: 25 }));
    expect(withNegl.adjusted.mid).toBeLessThanOrEqual(base.adjusted.mid);
  });

  it("comparative negligence at 0% is neutral", () => {
    const r = buildResult(makeSnap({ comparative_negligence_pct: 0 }));
    const neglAdj = r.adjustments.find(a => a.category === "comparative_negligence")!;
    expect(neglAdj.direction).toBe("neutral");
  });

  it("pre-existing conditions trigger causation reduction", () => {
    const r = buildResult(makeSnap({ pre_existing_count: 2 }));
    const adj = r.adjustments.find(a => a.category === "causation_apportionment")!;
    expect(adj.direction).toBe("negative");
    expect(adj.effect.mid_delta).toBeLessThan(0);
  });

  it("no pre-existing is neutral causation", () => {
    const r = buildResult(makeSnap());
    const adj = r.adjustments.find(a => a.category === "causation_apportionment")!;
    expect(adj.direction).toBe("neutral");
  });

  it("FL venue produces positive adjustment", () => {
    const r = buildResult(makeSnap({ jurisdiction: "FL" }));
    const adj = r.adjustments.find(a => a.category === "venue_jurisdiction")!;
    expect(adj.direction).toBe("positive");
    expect(adj.effect.mid_delta).toBeGreaterThan(0);
  });

  it("TX venue produces negative adjustment", () => {
    const r = buildResult(makeSnap({ jurisdiction: "TX" }));
    const adj = r.adjustments.find(a => a.category === "venue_jurisdiction")!;
    expect(adj.direction).toBe("negative");
    expect(adj.effect.mid_delta).toBeLessThan(0);
  });

  it("PA venue is neutral", () => {
    const r = buildResult(makeSnap({ jurisdiction: "PA" }));
    const adj = r.adjustments.find(a => a.category === "venue_jurisdiction")!;
    expect(adj.direction).toBe("neutral");
  });

  it("low documentation completeness widens corridor", () => {
    const r = buildResult(makeSnap({ completeness: 40 }));
    const adj = r.adjustments.find(a => a.category === "documentation_confidence")!;
    expect(adj.direction).toBe("widening");
    expect(adj.effect.low_delta).toBeLessThan(0);
    expect(adj.effect.high_delta).toBeGreaterThan(0);
  });

  it("high documentation completeness is neutral", () => {
    const r = buildResult(makeSnap({ completeness: 90 }));
    const adj = r.adjustments.find(a => a.category === "documentation_confidence")!;
    expect(adj.direction).toBe("neutral");
  });

  it("documentation with critical gaps suppresses midpoint", () => {
    const r = buildResult(makeSnap({
      completeness: 50,
      upstream_concerns: [
        { id: "dc1", category: "documentation", description: "Missing medical records", severity: "critical", provenance: prov() },
      ],
    }));
    const adj = r.adjustments.find(a => a.category === "documentation_confidence")!;
    expect(adj.effect.mid_delta).toBeLessThan(0);
  });

  it("coverage adjustment is skipped when disabled", () => {
    const r = buildResult(makeSnap(), { coverage_enabled: false });
    const adj = r.adjustments.find(a => a.category === "coverage_collectibility")!;
    expect(adj.applied).toBe(false);
    expect(adj.skip_reason).toBeTruthy();
  });

  it("low coverage + high severity constrains high band", () => {
    const r = buildResult(makeSnap({ coverage_limit: 25000, has_surgery: true }));
    const adj = r.adjustments.find(a => a.category === "coverage_collectibility")!;
    expect(adj.direction).toBe("negative");
    expect(adj.effect.high_delta).toBeLessThan(0);
  });

  it("audit trail has entries for all adjustments", () => {
    const r = buildResult(makeSnap());
    expect(r.audit_trail).toHaveLength(5);
    r.audit_trail.forEach(e => {
      expect(e.timestamp).toBeTruthy();
      expect(e.category).toBeTruthy();
    });
  });

  it("net_delta reflects actual changes", () => {
    const r = buildResult(makeSnap({ comparative_negligence_pct: 20 }));
    expect(r.net_delta.low_delta).toBe(r.adjusted.low - r.merits_corridor.low);
    expect(r.net_delta.mid_delta).toBe(r.adjusted.mid - r.merits_corridor.mid);
    expect(r.net_delta.high_delta).toBe(r.adjusted.high - r.merits_corridor.high);
  });

  it("summary is non-empty", () => {
    const r = buildResult(makeSnap());
    expect(r.summary.length).toBeGreaterThan(10);
  });

  it("engine version is present", () => {
    const r = buildResult(makeSnap());
    expect(r.engine_version).toBe("1.0.0");
  });
});
