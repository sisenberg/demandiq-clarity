/**
 * Benchmark Matching Engine — Tests
 */

import { describe, it, expect } from "vitest";
import {
  computeBenchmarkMatching,
  SEEDED_BENCHMARK_CORPUS,
  type BenchmarkCase,
} from "@/lib/benchmarkMatchingEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

function prov() {
  return { source_module: "revieweriq" as const, source_package_version: 1, evidence_ref_ids: [], confidence: 0.9, completeness: "complete" as const };
}
function pf<T>(value: T) { return { value, provenance: prov() }; }

function makeSnap(overrides: Partial<{
  jurisdiction: string;
  venue_county: string;
  has_surgery: boolean;
  has_permanency: boolean;
  has_impairment: boolean;
  comparative_negligence: number;
  billed: number;
  body_parts: string[];
}> = {}): EvaluateIntakeSnapshot {
  return {
    snapshot_id: "s1", case_id: "c1", tenant_id: "t1", created_at: "", created_by: null,
    source_module: "revieweriq", source_package_version: 1, source_snapshot_id: null,
    claimant: { claimant_name: pf("Jane"), date_of_birth: pf(null), occupation: pf(null), employer: pf(null) },
    accident: { date_of_loss: pf("2025-06-01"), mechanism_of_loss: pf("Collision"), description: pf("MVA") },
    liability_facts: [{ id: "lf1", fact_text: "Rear-end", supports_liability: true, confidence: 0.9, provenance: prov() }],
    comparative_negligence: { claimant_negligence_percentage: pf(overrides.comparative_negligence ?? 0), notes: pf("") },
    venue_jurisdiction: { jurisdiction_state: pf(overrides.jurisdiction ?? "PA"), venue_county: pf(overrides.venue_county ?? "Philadelphia") },
    policy_coverage: [{ carrier_name: "ABC", policy_type: "BI", coverage_limit: 100000, deductible: null, provenance: prov() }],
    injuries: (overrides.body_parts ?? ["neck", "back"]).map((bp, i) => ({
      id: `i${i}`, body_part: bp, body_region: bp.toLowerCase(), diagnosis_description: `${bp} strain`,
      diagnosis_code: "S13.4XXA", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov(),
    })),
    treatment_timeline: [
      { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
      { id: "t2", treatment_type: "pt", treatment_date: "2025-07-15", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. B", facility_name: "", provenance: prov() },
      { id: "t3", treatment_type: "chiro", treatment_date: "2025-09-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
    ],
    providers: [
      { id: "p1", full_name: "Dr. A", specialty: "Chiro", facility_name: "", role_description: "", total_visits: 10, first_visit_date: "2025-06-10", last_visit_date: "2025-09-10", total_billed: 3000, total_paid: 2500, provenance: prov() },
    ],
    medical_billing: [
      { id: "b1", description: "Visit", service_date: "2025-06-10", cpt_codes: [], billed_amount: overrides.billed ?? 8000, paid_amount: 6500, reviewer_recommended_amount: 7000, provider_name: "Dr. A", provenance: prov() },
    ],
    wage_loss: { total_lost_wages: pf(0), duration_description: pf(null) },
    future_treatment: { future_medical_estimate: pf(0), indicators: pf([]) },
    clinical_flags: {
      has_surgery: overrides.has_surgery ?? false,
      has_injections: false,
      has_advanced_imaging: false,
      has_permanency_indicators: overrides.has_permanency ?? false,
      has_impairment_rating: overrides.has_impairment ?? false,
      has_scarring_disfigurement: false,
      provenance: prov(),
    },
    upstream_concerns: [],
    completeness_warnings: [],
    overall_completeness_score: 85,
  };
}

describe("Benchmark Matching Engine", () => {
  it("uses seeded corpus by default", () => {
    const r = computeBenchmarkMatching(makeSnap());
    expect(r.candidate_count).toBe(SEEDED_BENCHMARK_CORPUS.length);
  });

  it("produces 9 matching dimensions", () => {
    const r = computeBenchmarkMatching(makeSnap());
    expect(r.dimensions).toHaveLength(9);
  });

  it("selects at least some matches for a PA soft-tissue case", () => {
    const r = computeBenchmarkMatching(makeSnap());
    expect(r.selected_count).toBeGreaterThan(0);
  });

  it("match quality reflects selected count", () => {
    const r = computeBenchmarkMatching(makeSnap());
    if (r.selected_count >= 5) expect(r.match_quality).toBe("strong");
    else if (r.selected_count >= 3) expect(r.match_quality).toBe("moderate");
    else if (r.selected_count >= 1) expect(r.match_quality).toBe("weak");
    else expect(r.match_quality).toBe("insufficient");
  });

  it("all candidates have similarity scores 0–100", () => {
    const r = computeBenchmarkMatching(makeSnap());
    r.all_candidates.forEach(c => {
      expect(c.overall_similarity).toBeGreaterThanOrEqual(0);
      expect(c.overall_similarity).toBeLessThanOrEqual(100);
    });
  });

  it("selected matches have similarity >= threshold", () => {
    const r = computeBenchmarkMatching(makeSnap());
    r.selected_matches.forEach(m => {
      expect(m.overall_similarity).toBeGreaterThanOrEqual(45);
    });
  });

  it("excluded matches have exclusion reasons", () => {
    const r = computeBenchmarkMatching(makeSnap());
    r.all_candidates.filter(c => !c.selected).forEach(c => {
      expect(c.exclusion_reason).toBeTruthy();
    });
  });

  it("venue match boosts same-state cases", () => {
    const r = computeBenchmarkMatching(makeSnap({ jurisdiction: "PA" }));
    const paCases = r.all_candidates.filter(c => {
      const venueDim = c.dimension_scores.find(d => d.dimension === "venue");
      return venueDim && venueDim.similarity >= 75;
    });
    expect(paCases.length).toBeGreaterThan(0);
  });

  it("surgery mismatch penalizes dimension score", () => {
    const r = computeBenchmarkMatching(makeSnap({ has_surgery: false }));
    const surgeryCase = r.all_candidates.find(c =>
      c.dimension_scores.find(d => d.dimension === "surgery_status")?.similarity === 0
    );
    expect(surgeryCase).toBeDefined();
  });

  it("settlement stats computed for selected matches", () => {
    const r = computeBenchmarkMatching(makeSnap());
    if (r.selected_count > 0) {
      expect(r.settlement_stats.median).not.toBeNull();
      expect(r.settlement_stats.p25).not.toBeNull();
      expect(r.settlement_stats.p75).not.toBeNull();
    }
  });

  it("top match reasons are populated", () => {
    const r = computeBenchmarkMatching(makeSnap());
    if (r.selected_count > 0) {
      expect(r.top_match_reasons.length).toBeGreaterThan(0);
    }
  });

  it("confidence explanation is non-empty", () => {
    const r = computeBenchmarkMatching(makeSnap());
    expect(r.confidence_explanation.length).toBeGreaterThan(10);
  });

  it("engine version is present", () => {
    const r = computeBenchmarkMatching(makeSnap());
    expect(r.engine_version).toBe("1.0.0");
  });

  it("empty corpus yields insufficient quality", () => {
    const r = computeBenchmarkMatching(makeSnap(), []);
    expect(r.match_quality).toBe("insufficient");
    expect(r.selected_count).toBe(0);
  });

  it("candidates sorted by similarity descending", () => {
    const r = computeBenchmarkMatching(makeSnap());
    for (let i = 1; i < r.all_candidates.length; i++) {
      expect(r.all_candidates[i].overall_similarity).toBeLessThanOrEqual(r.all_candidates[i - 1].overall_similarity);
    }
  });
});
