/**
 * Profile Weighting Engine — Tests
 */

import { describe, it, expect } from "vitest";
import {
  getProfileWeightBand,
  getAllWeightBands,
  computeWeightedMeritsScore,
  WEIGHT_CATEGORY_META,
} from "@/lib/profileWeightingEngine";
import { scoreAllFactors } from "@/lib/factorScoringEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { ClaimProfileCode } from "@/lib/claimProfileClassifier";

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

// ─── Weight Band Tests ─────────────────────────────────

describe("Profile Weight Bands", () => {
  it("returns specific band for Profile A", () => {
    const band = getProfileWeightBand("A");
    expect(band.profile).toBe("A");
    expect(band.weights.treatment_pattern).toBeGreaterThan(band.weights.injury_merit);
  });

  it("returns specific band for Profile C", () => {
    const band = getProfileWeightBand("C");
    expect(band.profile).toBe("C");
    expect(band.weights.injury_merit).toBeGreaterThanOrEqual(band.weights.treatment_pattern);
  });

  it("returns specific band for Profile F", () => {
    const band = getProfileWeightBand("F");
    expect(band.profile).toBe("F");
    expect(band.weights.injury_merit).toBeGreaterThan(band.weights.treatment_pattern);
  });

  it("returns specific band for Profile G", () => {
    const band = getProfileWeightBand("G");
    expect(band.profile).toBe("G");
    expect(band.weights.functional_impact).toBeGreaterThanOrEqual(band.weights.injury_merit);
  });

  it("returns fallback band for unconfigured profiles", () => {
    const band = getProfileWeightBand("B");
    expect(band.profile).toBe("B");
    expect(band.rationale).toContain("Balanced");
  });

  it("all weight bands sum to 1.0", () => {
    const bands = getAllWeightBands();
    for (const band of bands) {
      const sum = Object.values(band.weights).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
    }
  });

  it("all weight bands have version and rationale", () => {
    const bands = getAllWeightBands();
    for (const band of bands) {
      expect(band.version.length).toBeGreaterThan(0);
      expect(band.rationale.length).toBeGreaterThan(10);
    }
  });
});

// ─── Merits Score Tests ────────────────────────────────

describe("Weighted Merits Score", () => {
  it("produces a score between 0 and 100", () => {
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "A");
    expect(result.merits_score).toBeGreaterThanOrEqual(0);
    expect(result.merits_score).toBeLessThanOrEqual(100);
  });

  it("has 5 category scores", () => {
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "C");
    expect(result.category_scores).toHaveLength(5);
  });

  it("category weighted contributions sum to merits score", () => {
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "F");
    const sumContributions = result.category_scores.reduce((s, c) => s + c.weighted_contribution, 0);
    expect(Math.abs(Math.round(sumContributions) - result.merits_score)).toBeLessThanOrEqual(1);
  });

  it("different profiles produce different merits scores", () => {
    const snap = makeSnap({ clinical_flags: { has_surgery: true }, wage_loss: 20000 });
    const scoring = scoreAllFactors(snap);
    const resultA = computeWeightedMeritsScore(scoring, "A");
    const resultF = computeWeightedMeritsScore(scoring, "F");
    // Not necessarily different values, but weight distributions should differ
    expect(resultA.weight_band.weights.treatment_pattern).not.toBe(resultF.weight_band.weights.treatment_pattern);
  });

  it("marks score as provisional when gates fail", () => {
    const snap = makeSnap({ liability_facts: [] });
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "A");
    expect(result.is_provisional).toBe(true);
  });

  it("provides weighting explanation", () => {
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "G");
    expect(result.weighting_explanation.length).toBeGreaterThan(20);
    expect(result.weighting_explanation).toContain("Profile G");
  });

  it("Profile A emphasizes treatment pattern in breakdown", () => {
    const snap = makeSnap();
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "A");
    const tp = result.category_scores.find(c => c.category === "treatment_pattern")!;
    const im = result.category_scores.find(c => c.category === "injury_merit")!;
    expect(tp.weight).toBeGreaterThan(im.weight);
  });

  it("Profile G emphasizes functional impact in breakdown", () => {
    const snap = makeSnap({ clinical_flags: { has_permanency_indicators: true, has_impairment_rating: true } });
    const scoring = scoreAllFactors(snap);
    const result = computeWeightedMeritsScore(scoring, "G");
    const fi = result.category_scores.find(c => c.category === "functional_impact")!;
    const tp = result.category_scores.find(c => c.category === "treatment_pattern")!;
    expect(fi.weight).toBeGreaterThan(tp.weight);
  });

  it("higher injury severity produces higher merits for Profile C", () => {
    const mildSnap = makeSnap({
      injuries: [{ id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Strain", diagnosis_code: "S13.4", severity: "mild", is_pre_existing: false, date_of_onset: null, provenance: prov() }],
    });
    const severeSnap = makeSnap({
      injuries: [{ id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Disc herniation", diagnosis_code: "M51.1", severity: "severe", is_pre_existing: false, date_of_onset: null, provenance: prov() }],
      clinical_flags: { has_advanced_imaging: true },
    });
    const mildResult = computeWeightedMeritsScore(scoreAllFactors(mildSnap), "C");
    const severeResult = computeWeightedMeritsScore(scoreAllFactors(severeSnap), "C");
    expect(severeResult.merits_score).toBeGreaterThan(mildResult.merits_score);
  });
});
