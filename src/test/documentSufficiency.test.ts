/**
 * Documentation Sufficiency Engine — Tests
 */

import { describe, it, expect } from "vitest";
import { computeDocumentSufficiency, type DocumentSufficiencyResult } from "@/lib/documentSufficiencyEngine";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

function prov() {
  return { source_module: "revieweriq" as const, source_package_version: 1, evidence_ref_ids: [], confidence: 0.9, completeness: "complete" as const };
}
function pf<T>(value: T) { return { value, provenance: prov() }; }

function makeSnap(overrides: Partial<{
  injuries: EvaluateIntakeSnapshot["injuries"];
  treatments: EvaluateIntakeSnapshot["treatment_timeline"];
  completeness: number;
  has_surgery: boolean;
  has_permanency: boolean;
  has_impairment: boolean;
  has_imaging: boolean;
  wage_loss: number;
  occupation: string | null;
  future_estimate: number;
  future_indicators: string[];
  upstream_concerns: EvaluateIntakeSnapshot["upstream_concerns"];
}> = {}): EvaluateIntakeSnapshot {
  return {
    snapshot_id: "s1", case_id: "c1", tenant_id: "t1", created_at: "", created_by: null,
    source_module: "revieweriq", source_package_version: 1, source_snapshot_id: null,
    claimant: {
      claimant_name: pf("Jane"),
      date_of_birth: pf(null),
      occupation: pf(overrides.occupation ?? null),
      employer: pf(null),
    },
    accident: { date_of_loss: pf("2025-06-01"), mechanism_of_loss: pf("Collision"), description: pf("MVA") },
    liability_facts: [{ id: "lf1", fact_text: "Rear-end", supports_liability: true, confidence: 0.9, provenance: prov() }],
    comparative_negligence: { claimant_negligence_percentage: pf(null), notes: pf("") },
    venue_jurisdiction: { jurisdiction_state: pf("PA"), venue_county: pf("Philadelphia") },
    policy_coverage: [{ carrier_name: "ABC", policy_type: "BI", coverage_limit: 100000, deductible: null, provenance: prov() }],
    injuries: overrides.injuries ?? [
      { id: "i1", body_part: "Neck", body_region: "neck", diagnosis_description: "Cervical strain", diagnosis_code: "S13.4XXA", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
    ],
    treatment_timeline: overrides.treatments ?? [
      { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-10", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
      { id: "t2", treatment_type: "pt", treatment_date: "2025-07-01", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. B", facility_name: "", provenance: prov() },
      { id: "t3", treatment_type: "chiro", treatment_date: "2025-08-15", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
    ],
    providers: [
      { id: "p1", full_name: "Dr. A", specialty: "Chiropractic", facility_name: "", role_description: "", total_visits: 10, first_visit_date: "2025-06-10", last_visit_date: "2025-08-15", total_billed: 3000, total_paid: 2500, provenance: prov() },
    ],
    medical_billing: [],
    wage_loss: { total_lost_wages: pf(overrides.wage_loss ?? 0), duration_description: pf(null) },
    future_treatment: { future_medical_estimate: pf(overrides.future_estimate ?? 0), indicators: pf(overrides.future_indicators ?? []) },
    clinical_flags: {
      has_surgery: overrides.has_surgery ?? false,
      has_injections: false,
      has_advanced_imaging: overrides.has_imaging ?? false,
      has_permanency_indicators: overrides.has_permanency ?? false,
      has_impairment_rating: overrides.has_impairment ?? false,
      has_scarring_disfigurement: false,
      provenance: prov(),
    },
    upstream_concerns: overrides.upstream_concerns ?? [],
    completeness_warnings: [],
    overall_completeness_score: overrides.completeness ?? 85,
  };
}

describe("Documentation Sufficiency Engine", () => {
  it("produces 8 subcomponents", () => {
    const r = computeDocumentSufficiency(makeSnap());
    expect(r.subcomponents).toHaveLength(8);
  });

  it("overall score is 0–100", () => {
    const r = computeDocumentSufficiency(makeSnap());
    expect(r.overall_score).toBeGreaterThanOrEqual(0);
    expect(r.overall_score).toBeLessThanOrEqual(100);
  });

  it("label matches score range", () => {
    const r = computeDocumentSufficiency(makeSnap());
    if (r.overall_score >= 75) expect(r.overall_label).toBe("strong");
    else if (r.overall_score >= 55) expect(r.overall_label).toBe("adequate");
    else if (r.overall_score >= 35) expect(r.overall_label).toBe("limited");
    else expect(r.overall_label).toBe("insufficient");
  });

  it("no injuries → diagnosis specificity is 0", () => {
    const r = computeDocumentSufficiency(makeSnap({ injuries: [] }));
    const dx = r.subcomponents.find(s => s.key === "diagnosis_specificity")!;
    expect(dx.score).toBe(0);
    expect(dx.impact).toBe("excludes_component");
  });

  it("surgery + imaging + impairment → high objective support", () => {
    const r = computeDocumentSufficiency(makeSnap({
      has_surgery: true, has_imaging: true, has_impairment: true,
    }));
    const obj = r.subcomponents.find(s => s.key === "objective_support")!;
    expect(obj.score).toBeGreaterThanOrEqual(70);
  });

  it("no treatments → chronology score is 0", () => {
    const r = computeDocumentSufficiency(makeSnap({ treatments: [] }));
    const chrono = r.subcomponents.find(s => s.key === "chronology_completeness")!;
    expect(chrono.score).toBe(0);
  });

  it("large treatment gap lowers treatment gap score", () => {
    const r = computeDocumentSufficiency(makeSnap({
      treatments: [
        { id: "t1", treatment_type: "chiro", treatment_date: "2025-01-01", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
        { id: "t2", treatment_type: "chiro", treatment_date: "2025-06-01", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "Dr. A", facility_name: "", provenance: prov() },
      ],
    }));
    const gap = r.subcomponents.find(s => s.key === "treatment_gap_explanation")!;
    expect(gap.score).toBeLessThan(70);
    expect(gap.gaps.length).toBeGreaterThan(0);
  });

  it("no impairment rating → low functional limitation", () => {
    const r = computeDocumentSufficiency(makeSnap({ has_impairment: false, has_permanency: false }));
    const func = r.subcomponents.find(s => s.key === "functional_limitation")!;
    expect(func.score).toBeLessThan(60);
  });

  it("no wage loss → low work-impact score", () => {
    const r = computeDocumentSufficiency(makeSnap({ wage_loss: 0 }));
    const work = r.subcomponents.find(s => s.key === "work_impact")!;
    expect(work.score).toBeLessThan(30);
  });

  it("wage loss with occupation → higher work-impact", () => {
    const r = computeDocumentSufficiency(makeSnap({ wage_loss: 5000, occupation: "Nurse" }));
    const work = r.subcomponents.find(s => s.key === "work_impact")!;
    expect(work.score).toBeGreaterThan(50);
  });

  it("no permanency indicators → low permanency score", () => {
    const r = computeDocumentSufficiency(makeSnap());
    const perm = r.subcomponents.find(s => s.key === "permanency_impairment")!;
    expect(perm.score).toBeLessThan(30);
    expect(perm.finding).toContain("Permanency not credited");
  });

  it("permanency + impairment rating → high permanency score", () => {
    const r = computeDocumentSufficiency(makeSnap({ has_permanency: true, has_impairment: true }));
    const perm = r.subcomponents.find(s => s.key === "permanency_impairment")!;
    expect(perm.score).toBeGreaterThanOrEqual(70);
  });

  it("no future care data → low future care score with exclusion", () => {
    const r = computeDocumentSufficiency(makeSnap());
    const fc = r.subcomponents.find(s => s.key === "future_care")!;
    expect(fc.score).toBeLessThan(30);
    expect(fc.finding).toContain("Future care not included");
  });

  it("future care with estimate + indicators → high score", () => {
    const r = computeDocumentSufficiency(makeSnap({
      future_estimate: 15000,
      future_indicators: ["ongoing PT needed", "possible surgery"],
    }));
    const fc = r.subcomponents.find(s => s.key === "future_care")!;
    expect(fc.score).toBeGreaterThanOrEqual(60);
  });

  it("generates valuation effects for weak subcomponents", () => {
    const r = computeDocumentSufficiency(makeSnap());
    // With default snap, work-impact and permanency should be weak
    expect(r.valuation_effects.length).toBeGreaterThan(0);
  });

  it("all_gaps aggregates from all subcomponents", () => {
    const r = computeDocumentSufficiency(makeSnap());
    expect(r.all_gaps.length).toBeGreaterThan(0);
  });

  it("findings are non-empty for every scored subcomponent", () => {
    const r = computeDocumentSufficiency(makeSnap());
    r.subcomponents.forEach(sub => {
      expect(sub.finding.length).toBeGreaterThan(5);
    });
  });

  it("engine version is present", () => {
    const r = computeDocumentSufficiency(makeSnap());
    expect(r.engine_version).toBe("1.0.0");
  });

  it("well-documented case scores higher overall", () => {
    const weak = computeDocumentSufficiency(makeSnap());
    const strong = computeDocumentSufficiency(makeSnap({
      has_surgery: true, has_imaging: true, has_impairment: true, has_permanency: true,
      wage_loss: 10000, occupation: "Engineer",
      future_estimate: 20000, future_indicators: ["ongoing rehab", "revision surgery possible"],
    }));
    expect(strong.overall_score).toBeGreaterThan(weak.overall_score);
  });
});
