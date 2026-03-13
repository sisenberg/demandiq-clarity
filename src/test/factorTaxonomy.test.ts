/**
 * Factor Registry & Scoring Engine — Tests
 */

import { describe, it, expect } from "vitest";
import { FACTOR_REGISTRY, getFactorById, getFactorsByLayer, getActiveFactors, getFactorsByLayerGrouped, getFactorFamilies } from "@/lib/factorRegistry";
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
  treatment_timeline: EvaluateIntakeSnapshot["treatment_timeline"];
  providers: EvaluateIntakeSnapshot["providers"];
  medical_billing: EvaluateIntakeSnapshot["medical_billing"];
  upstream_concerns: EvaluateIntakeSnapshot["upstream_concerns"];
  completeness: number;
  liability_facts: EvaluateIntakeSnapshot["liability_facts"];
  wage_loss: number;
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
    treatment_timeline: overrides.treatment_timeline ?? [
      { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
      { id: "t2", treatment_type: "chiro", treatment_date: "2025-07-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
    ],
    providers: overrides.providers ?? [
      { id: "p1", full_name: "Dr. A", specialty: "Chiropractic", facility_name: "", role_description: "", total_visits: 10, first_visit_date: "2025-06-10", last_visit_date: "2025-07-10", total_billed: 3000, total_paid: 2500, provenance: prov() },
    ],
    medical_billing: overrides.medical_billing ?? [
      { id: "b1", description: "Visit", service_date: "2025-06-10", cpt_codes: [], billed_amount: 3000, paid_amount: 2500, reviewer_recommended_amount: 2800, provider_name: "Dr. A", provenance: prov() },
    ],
    wage_loss: { total_lost_wages: pf(overrides.wage_loss ?? 0), duration_description: pf(null) },
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
    upstream_concerns: overrides.upstream_concerns ?? [],
    completeness_warnings: [],
    overall_completeness_score: overrides.completeness ?? 85,
  };
}

// ─── Registry Tests ────────────────────────────────────

describe("Factor Registry", () => {
  it("has at least 25 factor definitions", () => {
    expect(FACTOR_REGISTRY.length).toBeGreaterThanOrEqual(25);
  });

  it("has no duplicate ids", () => {
    const ids = FACTOR_REGISTRY.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no prohibited factors active", () => {
    expect(FACTOR_REGISTRY.filter(f => f.prohibited && f.is_active)).toHaveLength(0);
  });

  it("has factors across all 6 layers", () => {
    for (let layer = 0; layer <= 5; layer++) {
      expect(getFactorsByLayer(layer as any).length).toBeGreaterThan(0);
    }
  });

  it("getFactorById returns correct factor", () => {
    const f = getFactorById("injury_severity_class");
    expect(f).toBeDefined();
    expect(f!.layer).toBe(1);
  });

  it("getFactorsByLayerGrouped returns all layers", () => {
    const grouped = getFactorsByLayerGrouped();
    expect(grouped.size).toBe(6);
  });

  it("getFactorFamilies returns unique families", () => {
    const families = getFactorFamilies();
    expect(families.length).toBeGreaterThan(5);
    expect(new Set(families).size).toBe(families.length);
  });

  it("every factor has an explanation template", () => {
    for (const f of FACTOR_REGISTRY) {
      expect(f.explanation_template.length).toBeGreaterThan(0);
    }
  });

  it("every factor has input dependencies declared", () => {
    // Layer 0–4 should all have dependencies (layer 5 some may have empty)
    for (const f of FACTOR_REGISTRY.filter(f => f.layer <= 4 && f.id !== "property_damage_context")) {
      expect(f.input_dependencies.length).toBeGreaterThan(0);
    }
  });
});

// ─── Scoring Engine Tests ──────────────────────────────

describe("Factor Scoring Engine", () => {
  it("scores all active factors", () => {
    const result = scoreAllFactors(makeSnap());
    expect(result.scored_factors.length).toBe(getActiveFactors().length);
  });

  it("passes all gates for a well-formed snapshot", () => {
    const result = scoreAllFactors(makeSnap());
    expect(result.gates_passed).toBe(true);
    expect(result.gate_failures).toHaveLength(0);
  });

  it("fails gate when no liability facts", () => {
    const result = scoreAllFactors(makeSnap({ liability_facts: [] }));
    expect(result.gates_passed).toBe(false);
    expect(result.gate_failures).toContain("Liability Posture Available");
  });

  it("fails gate when completeness is low", () => {
    const result = scoreAllFactors(makeSnap({ completeness: 30 }));
    expect(result.gates_passed).toBe(false);
    expect(result.gate_failures).toContain("Medical Review Completeness");
  });

  it("scores injury severity based on max severity", () => {
    const result = scoreAllFactors(makeSnap({
      injuries: [
        { id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Strain", diagnosis_code: "S13.4", severity: "severe", is_pre_existing: false, date_of_onset: null, provenance: prov() },
      ],
    }));
    const sev = result.scored_factors.find(f => f.factor_id === "injury_severity_class");
    expect(sev!.score).toBe(4);
  });

  it("scores surgery as max invasiveness", () => {
    const result = scoreAllFactors(makeSnap({ clinical_flags: { has_surgery: true } }));
    const inv = result.scored_factors.find(f => f.factor_id === "treatment_invasiveness");
    expect(inv!.score).toBe(5);
  });

  it("detects wage loss impact", () => {
    const result = scoreAllFactors(makeSnap({ wage_loss: 15000 }));
    const wl = result.scored_factors.find(f => f.factor_id === "work_impact");
    expect(wl!.score).toBe(3);
    expect(wl!.direction).toBe("expander");
  });

  it("marks property damage as not applicable", () => {
    const result = scoreAllFactors(makeSnap());
    const pd = result.scored_factors.find(f => f.factor_id === "property_damage_context");
    expect(pd!.applicable).toBe(false);
  });

  it("returns layer summaries for all 6 layers", () => {
    const result = scoreAllFactors(makeSnap());
    expect(result.layer_summaries).toHaveLength(6);
  });

  it("provides narrative for every scored factor", () => {
    const result = scoreAllFactors(makeSnap());
    for (const f of result.scored_factors) {
      expect(f.narrative.length).toBeGreaterThan(0);
    }
  });
});
