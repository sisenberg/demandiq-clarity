/**
 * Claim Profile Classifier — Unit Tests
 */

import { describe, it, expect } from "vitest";
import { classifyClaimProfile, type ClaimProfileCode } from "@/lib/claimProfileClassifier";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";

// ─── Factory ────────────────────────────────────────────

function prov(complete = true) {
  return {
    source_module: "revieweriq" as const,
    source_package_version: 1,
    evidence_ref_ids: [],
    confidence: 0.9,
    completeness: complete ? "complete" as const : "missing" as const,
  };
}

function provField<T>(value: T) {
  return { value, provenance: prov() };
}

function makeSnapshot(overrides: Partial<{
  injuries: EvaluateIntakeSnapshot["injuries"];
  clinical_flags: Partial<EvaluateIntakeSnapshot["clinical_flags"]>;
  treatment_timeline: EvaluateIntakeSnapshot["treatment_timeline"];
  providers: EvaluateIntakeSnapshot["providers"];
  medical_billing: EvaluateIntakeSnapshot["medical_billing"];
  upstream_concerns: EvaluateIntakeSnapshot["upstream_concerns"];
  completeness_warnings: EvaluateIntakeSnapshot["completeness_warnings"];
  overall_completeness_score: number;
  wage_loss_value: number;
}> = {}): EvaluateIntakeSnapshot {
  return {
    snapshot_id: "snap-1",
    case_id: "case-1",
    tenant_id: "tenant-1",
    created_at: "2026-01-01T00:00:00Z",
    created_by: null,
    source_module: "revieweriq",
    source_package_version: 1,
    source_snapshot_id: null,
    claimant: {
      claimant_name: provField("Jane Doe"),
      date_of_birth: provField("1985-01-01"),
      occupation: provField(null),
      employer: provField(null),
    },
    accident: {
      date_of_loss: provField("2025-06-01"),
      mechanism_of_loss: provField("Rear-end collision"),
      description: provField("Motor vehicle accident"),
    },
    liability_facts: [],
    comparative_negligence: {
      claimant_negligence_percentage: provField(null),
      notes: provField(""),
    },
    venue_jurisdiction: {
      jurisdiction_state: provField("FL"),
      venue_county: provField("Broward"),
    },
    policy_coverage: [],
    injuries: overrides.injuries ?? [
      { id: "i1", body_part: "Cervical Spine", body_region: "neck", diagnosis_description: "Cervical strain", diagnosis_code: "S13.4", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
    ],
    treatment_timeline: overrides.treatment_timeline ?? [
      { id: "t1", treatment_type: "chiropractic", treatment_date: "2025-06-10", treatment_end_date: null, description: "Chiropractic adjustment", procedure_codes: ["98941"], provider_name: "Dr. Smith", facility_name: "", provenance: prov() },
      { id: "t2", treatment_type: "chiropractic", treatment_date: "2025-07-10", treatment_end_date: null, description: "Chiropractic adjustment", procedure_codes: ["98941"], provider_name: "Dr. Smith", facility_name: "", provenance: prov() },
    ],
    providers: overrides.providers ?? [
      { id: "p1", full_name: "Dr. Smith", specialty: "Chiropractic", facility_name: "", role_description: "", total_visits: 10, first_visit_date: "2025-06-10", last_visit_date: "2025-07-10", total_billed: 3000, total_paid: 2500, provenance: prov() },
    ],
    medical_billing: overrides.medical_billing ?? [
      { id: "b1", description: "Adjustment", service_date: "2025-06-10", cpt_codes: ["98941"], billed_amount: 150, paid_amount: 120, reviewer_recommended_amount: null, provider_name: "Dr. Smith", provenance: prov() },
    ],
    wage_loss: { total_lost_wages: provField(overrides.wage_loss_value ?? 0), duration_description: provField(null) },
    future_treatment: { future_medical_estimate: provField(0), indicators: provField([]) },
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
    completeness_warnings: overrides.completeness_warnings ?? [],
    overall_completeness_score: overrides.overall_completeness_score ?? 85,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe("Claim Profile Classifier", () => {
  it("classifies Profile A: minor soft tissue", () => {
    const result = classifyClaimProfile(makeSnapshot());
    expect(result.primary).toBe("A");
    expect(result.confidence).toBe("high");
  });

  it("classifies Profile B: extended soft tissue with long treatment", () => {
    const result = classifyClaimProfile(makeSnapshot({
      treatment_timeline: [
        { id: "t1", treatment_type: "chiro", treatment_date: "2025-06-01", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "", facility_name: "", provenance: prov() },
        { id: "t2", treatment_type: "chiro", treatment_date: "2025-10-15", treatment_end_date: null, description: "", procedure_codes: [], provider_name: "", facility_name: "", provenance: prov() },
      ],
    }));
    expect(result.primary).toBe("B");
  });

  it("classifies Profile B: work restrictions present", () => {
    const result = classifyClaimProfile(makeSnapshot({ wage_loss_value: 5000 }));
    expect(result.primary).toBe("B");
    expect(result.explanation.reasons.some(r => /work/i.test(r.factor))).toBe(true);
  });

  it("classifies Profile C: objective ortho non-surgical", () => {
    const result = classifyClaimProfile(makeSnapshot({
      injuries: [
        { id: "i1", body_part: "Lumbar Spine", body_region: "back", diagnosis_description: "Lumbar disc herniation", diagnosis_code: "M51.16", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
      ],
    }));
    expect(result.primary).toBe("C");
  });

  it("classifies Profile D: fracture", () => {
    const result = classifyClaimProfile(makeSnapshot({
      injuries: [
        { id: "i1", body_part: "Wrist", body_region: "upper_extremity", diagnosis_description: "Distal radius fracture", diagnosis_code: "S52.501A", severity: "severe", is_pre_existing: false, date_of_onset: null, provenance: prov() },
      ],
    }));
    expect(result.primary).toBe("D");
  });

  it("classifies Profile E: injection escalation", () => {
    const result = classifyClaimProfile(makeSnapshot({
      clinical_flags: { has_injections: true },
    }));
    expect(result.primary).toBe("E");
  });

  it("classifies Profile F: surgery", () => {
    const result = classifyClaimProfile(makeSnapshot({
      clinical_flags: { has_surgery: true },
    }));
    expect(result.primary).toBe("F");
  });

  it("classifies Profile G: permanency / impairment", () => {
    const result = classifyClaimProfile(makeSnapshot({
      clinical_flags: { has_permanency: true },
    }));
    expect(result.primary).toBe("G");
  });

  it("classifies Profile G with surgery secondary flag", () => {
    const result = classifyClaimProfile(makeSnapshot({
      clinical_flags: { has_permanency: true, has_surgery: true },
    }));
    expect(result.primary).toBe("G");
    expect(result.secondary_flags).toContain("F");
  });

  it("classifies Profile H: multi-system", () => {
    const result = classifyClaimProfile(makeSnapshot({
      injuries: [
        { id: "i1", body_part: "Cervical Spine", body_region: "neck", diagnosis_description: "Strain", diagnosis_code: "S13.4", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
        { id: "i2", body_part: "Lumbar Spine", body_region: "back", diagnosis_description: "Strain", diagnosis_code: "S33.5", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
        { id: "i3", body_part: "Right Shoulder", body_region: "upper_extremity", diagnosis_description: "Contusion", diagnosis_code: "S40.0", severity: "mild", is_pre_existing: false, date_of_onset: null, provenance: prov() },
        { id: "i4", body_part: "Right Knee", body_region: "lower_extremity", diagnosis_description: "Sprain", diagnosis_code: "S83.5", severity: "moderate", is_pre_existing: false, date_of_onset: null, provenance: prov() },
      ],
    }));
    expect(result.primary).toBe("H");
  });

  it("classifies Profile Z: no injuries or treatments", () => {
    const result = classifyClaimProfile(makeSnapshot({
      injuries: [],
      treatment_timeline: [],
    }));
    expect(result.primary).toBe("Z");
    expect(result.confidence).toBe("low");
  });

  it("returns explanation with reasons for every profile", () => {
    const result = classifyClaimProfile(makeSnapshot({ clinical_flags: { has_surgery: true } }));
    expect(result.explanation.reasons.length).toBeGreaterThan(0);
    expect(result.explanation.summary).toContain("Profile F");
  });

  it("marks moderate confidence when gaps exist", () => {
    const result = classifyClaimProfile(makeSnapshot({
      upstream_concerns: [
        { id: "c1", category: "gap", description: "45-day treatment gap", severity: "warning", provenance: prov() },
      ],
    }));
    expect(result.confidence).toBe("moderate");
  });
});
