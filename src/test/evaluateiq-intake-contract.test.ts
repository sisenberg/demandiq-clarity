/**
 * EvaluateIQ — Intake Contract Tests
 *
 * Tests covering:
 *  - ReviewPackage v1 contract validation
 *  - Intake adapter normalization (ReviewerIQ → EvaluateIQ)
 *  - Readiness scoring
 *  - Contract drift detection
 *  - Evidence link preservation
 *  - Reviewer confirmation state mapping
 */

import { describe, it, expect } from "vitest";
import type { ReviewPackageV1 } from "@/types/review-package-v1";
import { validateReviewPackage } from "@/lib/reviewPackageValidator";
import { ingestReviewPackage } from "@/lib/reviewPackageIntakeAdapter";

// ─── Factory ────────────────────────────────────────────

function makeMinimalPackage(overrides?: Partial<ReviewPackageV1>): ReviewPackageV1 {
  return {
    metadata: {
      package_id: "rp-001",
      contract_version: "1.0.0",
      case_id: "case-001",
      claim_id: "claim-001",
      tenant_id: "tenant-001",
      module_version: "1.0.0",
      package_version: 1,
      published_at: "2026-03-01T00:00:00Z",
      published_by: "user-001",
      upstream_source: { module_id: "demandiq", package_version: 1, snapshot_id: null },
    },
    evaluation_context: {
      jurisdiction_state: "FL",
      venue_county: "Broward",
      date_of_loss: "2025-06-01",
      mechanism_of_loss: "Rear-end collision",
      claimant_name: "Jane Doe",
      claimant_dob: "1985-03-15",
      policy_type: "BI",
      policy_limits: 100000,
      comparative_negligence_pct: null,
    },
    accepted_injuries: [
      {
        id: "inj-1",
        body_part: "Cervical Spine",
        body_region: "Neck",
        diagnosis_description: "Cervical strain",
        diagnosis_code: "S13.4XXA",
        severity: "moderate",
        is_pre_existing: false,
        date_of_onset: "2025-06-01",
        acceptance_status: "accepted",
        dispute_reason: null,
        confirmation: { state: "reviewer_accepted", reviewed_by: "reviewer-1", reviewed_at: "2026-02-28T00:00:00Z", correction_notes: null },
        extraction_confidence: { score: 0.92, label: "high", model: "extract-v1", model_version: "1.0" },
        citations: [{ source_document_id: "doc-1", source_page: 3, quoted_text: "Cervical strain diagnosed", relevance_type: "direct" }],
      },
    ],
    disputed_injuries: [],
    accepted_treatments: [
      {
        id: "tx-1",
        treatment_type: "emergency",
        treatment_date: "2025-06-01",
        treatment_end_date: null,
        description: "ER visit post-collision",
        procedure_codes: ["99283"],
        provider_name: "Metro ER",
        facility_name: "Metro Hospital",
        reasonableness_finding: "reasonable",
        necessity_finding: "necessary",
        reviewer_rationale: "Appropriate ER visit same-day as collision",
        guideline_refs: ["AMA-ER-01"],
        confirmation: { state: "reviewer_accepted", reviewed_by: "reviewer-1", reviewed_at: "2026-02-28T00:00:00Z", correction_notes: null },
        extraction_confidence: { score: 0.95, label: "high", model: "extract-v1", model_version: "1.0" },
        citations: [{ source_document_id: "doc-1", source_page: 1, quoted_text: "Patient presented to ER", relevance_type: "direct" }],
      },
    ],
    providers: [
      {
        id: "pv-1",
        full_name: "Metro ER",
        normalized_name: "Metro Emergency Room",
        specialty: "Emergency Medicine",
        facility_name: "Metro Hospital",
        npi: "1234567890",
        total_visits: 1,
        first_visit_date: "2025-06-01",
        last_visit_date: "2025-06-01",
        total_billed: 3200,
        total_reviewed: 3200,
        total_accepted: 3000,
        confirmation: { state: "reviewer_accepted", reviewed_by: "reviewer-1", reviewed_at: "2026-02-28T00:00:00Z", correction_notes: null },
      },
    ],
    visit_chronology: [
      {
        id: "visit-1",
        visit_date: "2025-06-01",
        provider_name: "Metro ER",
        facility_name: "Metro Hospital",
        visit_type: "emergency",
        procedure_codes: ["99283"],
        subjective: "Neck pain after rear-end collision",
        objective: "Tenderness C-spine, limited ROM",
        assessment: "Cervical strain",
        plan: "NSAIDs, PT referral",
        citations: [{ source_document_id: "doc-1", source_page: 1, quoted_text: "Patient presented to ER", relevance_type: "direct" }],
      },
    ],
    diagnosis_summaries: [
      {
        diagnosis_code: "S13.4XXA",
        description: "Cervical strain",
        body_part: "Cervical Spine",
        severity: "moderate",
        first_documented: "2025-06-01",
        last_documented: "2025-06-01",
        supporting_visit_count: 1,
        acceptance_status: "accepted",
      },
    ],
    procedure_summaries: [
      {
        procedure_code: "99283",
        description: "ER visit level 3",
        total_instances: 1,
        total_billed: 3200,
        total_reviewed: 3000,
        reasonableness_consensus: "reasonable",
      },
    ],
    objective_findings: {
      has_objective_findings: true,
      finding_categories: ["tenderness", "limited_ROM"],
      summary: "Tenderness to palpation over C-spine with limited cervical ROM",
      citations: [{ source_document_id: "doc-1", source_page: 2, quoted_text: "Tenderness C-spine", relevance_type: "direct" }],
    },
    imaging_summary: {
      has_imaging: false,
      imaging_types: [],
      key_findings: [],
      abnormalities_documented: false,
      citations: [],
    },
    hospitalization_indicators: {
      was_hospitalized: false,
      total_days: null,
      facilities: [],
      citations: [],
    },
    surgery_indicators: {
      had_surgery: false,
      surgery_count: 0,
      procedure_descriptions: [],
      post_surgical_complications: [],
      citations: [],
    },
    impairment_evidence: {
      has_permanency_indicators: false,
      has_impairment_rating: false,
      impairment_rating_value: null,
      impairment_source: null,
      permanency_narrative: "",
      citations: [],
    },
    functional_limitations: {
      has_functional_limitations: false,
      limitation_categories: [],
      summary: "",
      citations: [],
    },
    work_restrictions: {
      has_work_restrictions: false,
      restriction_type: "none",
      duration_description: null,
      summary: "",
      citations: [],
    },
    treatment_gaps: [],
    reasonableness_findings: {
      overall_assessment: "reasonable",
      total_treatments_reviewed: 1,
      reasonable_count: 1,
      questionable_count: 0,
      unreasonable_count: 0,
      insufficient_info_count: 0,
      key_findings: ["All treatments deemed reasonable"],
      guideline_references: ["AMA-ER-01"],
    },
    reviewed_specials: {
      total_billed: 3200,
      total_reviewed: 3200,
      total_accepted: 3000,
      total_reduced: 200,
      total_disputed: 0,
      reduction_percentage: 6.25,
      by_provider: [{ provider_name: "Metro ER", billed: 3200, accepted: 3000, reduced: 200, disputed: 0 }],
      by_category: [{ category: "Emergency", billed: 3200, accepted: 3000 }],
    },
    unresolved_issues: [],
    evidence_citations: [
      { source_document_id: "doc-1", source_page: 1, quoted_text: "Patient presented to ER", relevance_type: "direct" },
      { source_document_id: "doc-1", source_page: 3, quoted_text: "Cervical strain diagnosed", relevance_type: "direct" },
    ],
    ...overrides,
  };
}

// ─── Validation Tests ───────────────────────────────────

describe("ReviewPackage v1 Validator", () => {
  it("validates a complete package as evaluation_ready", () => {
    const pkg = makeMinimalPackage();
    const result = validateReviewPackage(pkg);
    expect(result.readiness).toBe("evaluation_ready");
    expect(result.error_count).toBe(0);
    expect(result.completeness_score).toBeGreaterThanOrEqual(80);
  });

  it("detects contract version mismatch", () => {
    const pkg = makeMinimalPackage();
    pkg.metadata.contract_version = "2.0.0";
    const result = validateReviewPackage(pkg);
    expect(result.readiness).toBe("contract_mismatch");
    expect(result.findings.some(f => f.code === "CONTRACT_VERSION_MISMATCH")).toBe(true);
  });

  it("marks as not_ready when required fields missing", () => {
    const pkg = makeMinimalPackage();
    pkg.accepted_injuries = [];
    pkg.accepted_treatments = [];
    pkg.reasonableness_findings.total_treatments_reviewed = 0;
    const result = validateReviewPackage(pkg);
    expect(result.readiness).toBe("not_ready");
    expect(result.error_count).toBeGreaterThan(0);
  });

  it("marks as provisional when warnings present", () => {
    const pkg = makeMinimalPackage();
    pkg.disputed_injuries = [{
      ...pkg.accepted_injuries[0],
      id: "inj-disputed",
      acceptance_status: "disputed",
      dispute_reason: "Pre-existing per IME",
    }];
    pkg.unresolved_issues = [{
      id: "issue-1",
      issue_type: "excessive_visit_frequency",
      title: "Excessive visits",
      description: "48 chiro visits in 90 days",
      severity: "high",
      affected_provider: "Dr. Smith",
      questioned_amount: 14400,
      citations: [],
    }];
    const result = validateReviewPackage(pkg);
    expect(result.readiness).toBe("provisional");
    expect(result.unresolved_issue_count).toBe(1);
    expect(result.findings.some(f => f.code === "DISPUTED_INJURIES_PRESENT")).toBe(true);
  });

  it("flags unexplained treatment gaps", () => {
    const pkg = makeMinimalPackage();
    pkg.treatment_gaps = [{
      id: "gap-1",
      gap_start_date: "2025-07-01",
      gap_end_date: "2025-08-15",
      gap_days: 45,
      preceding_provider: "Dr. Smith",
      following_provider: "PT Center",
      explanation: null,
      is_explained: false,
      severity: "critical",
    }];
    const result = validateReviewPackage(pkg);
    expect(result.findings.some(f => f.code === "UNEXPLAINED_TREATMENT_GAPS")).toBe(true);
  });

  it("flags questionable reasonableness assessment", () => {
    const pkg = makeMinimalPackage();
    pkg.reasonableness_findings.overall_assessment = "questionable";
    const result = validateReviewPackage(pkg);
    expect(result.findings.some(f => f.code === "REASONABLENESS_CONCERN")).toBe(true);
  });

  it("flags unreviewed treatments", () => {
    const pkg = makeMinimalPackage();
    pkg.accepted_treatments[0].confirmation.state = "unreviewed";
    const result = validateReviewPackage(pkg);
    expect(result.findings.some(f => f.code === "UNREVIEWED_TREATMENTS")).toBe(true);
  });

  it("computes completeness score correctly", () => {
    const pkg = makeMinimalPackage();
    const result = validateReviewPackage(pkg);
    expect(result.completeness_score).toBeGreaterThan(0);
    expect(result.completeness_score).toBeLessThanOrEqual(100);
  });
});

// ─── Intake Adapter Tests ───────────────────────────────

describe("ReviewPackage Intake Adapter", () => {
  it("produces a valid snapshot from a complete package", () => {
    const pkg = makeMinimalPackage();
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.source_module).toBe("revieweriq");
    expect(result.snapshot.source_package_version).toBe(1);
    expect(result.snapshot.injuries.length).toBe(1);
    expect(result.snapshot.treatment_timeline.length).toBe(1);
    expect(result.snapshot.providers.length).toBe(1);
    expect(result.is_provisional).toBe(false);
  });

  it("preserves evidence links on imported injuries", () => {
    const pkg = makeMinimalPackage();
    const result = ingestReviewPackage(pkg, "user-001");
    const inj = result.snapshot.injuries[0];
    expect(inj.provenance.evidence_ref_ids.length).toBeGreaterThan(0);
    expect(inj.provenance.source_module).toBe("revieweriq");
  });

  it("preserves reviewer confirmation state via confidence", () => {
    const pkg = makeMinimalPackage();
    const result = ingestReviewPackage(pkg, "user-001");
    const tx = result.snapshot.treatment_timeline[0];
    expect(tx.provenance.confidence).toBe(0.95);
    expect(tx.provenance.completeness).toBe("complete"); // reviewer_accepted → complete
  });

  it("maps unreviewed treatment to partial completeness", () => {
    const pkg = makeMinimalPackage();
    pkg.accepted_treatments[0].confirmation.state = "unreviewed";
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.treatment_timeline[0].provenance.completeness).toBe("partial");
  });

  it("converts disputed injuries to adverse liability facts", () => {
    const pkg = makeMinimalPackage();
    pkg.disputed_injuries = [{
      ...pkg.accepted_injuries[0],
      id: "inj-d1",
      acceptance_status: "disputed",
      dispute_reason: "Pre-existing per IME",
    }];
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.liability_facts.some(f => f.fact_text.includes("Disputed injury"))).toBe(true);
    expect(result.snapshot.liability_facts[0].supports_liability).toBe(false);
  });

  it("maps surgery indicators to clinical flags", () => {
    const pkg = makeMinimalPackage();
    pkg.surgery_indicators.had_surgery = true;
    pkg.surgery_indicators.surgery_count = 1;
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.clinical_flags.has_surgery).toBe(true);
  });

  it("maps impairment evidence to clinical flags", () => {
    const pkg = makeMinimalPackage();
    pkg.impairment_evidence.has_permanency_indicators = true;
    pkg.impairment_evidence.has_impairment_rating = true;
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.clinical_flags.has_permanency_indicators).toBe(true);
    expect(result.snapshot.clinical_flags.has_impairment_rating).toBe(true);
  });

  it("maps treatment gaps to upstream concerns", () => {
    const pkg = makeMinimalPackage();
    pkg.treatment_gaps = [{
      id: "gap-1",
      gap_start_date: "2025-07-01",
      gap_end_date: "2025-08-15",
      gap_days: 45,
      preceding_provider: "Dr. Smith",
      following_provider: "PT Center",
      explanation: null,
      is_explained: false,
      severity: "warning",
    }];
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.upstream_concerns.some(c => c.category === "gap")).toBe(true);
  });

  it("maps unresolved issues to upstream concerns", () => {
    const pkg = makeMinimalPackage();
    pkg.unresolved_issues = [{
      id: "issue-1",
      issue_type: "coding_mismatch",
      title: "CPT mismatch",
      description: "CPT code does not match treatment note",
      severity: "medium",
      affected_provider: "Dr. Chen",
      questioned_amount: 500,
      citations: [{ source_document_id: "doc-2", source_page: 5, quoted_text: "CPT 99214", relevance_type: "direct" }],
    }];
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.upstream_concerns.length).toBeGreaterThan(0);
    expect(result.snapshot.upstream_concerns[0].provenance.evidence_ref_ids.length).toBeGreaterThan(0);
  });

  it("flags provisional when contract version mismatches", () => {
    const pkg = makeMinimalPackage();
    pkg.metadata.contract_version = "1.1.0";
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.is_provisional).toBe(true);
    expect(result.validation.readiness).toBe("contract_mismatch");
  });

  it("maps reviewed specials to medical billing", () => {
    const pkg = makeMinimalPackage();
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.medical_billing.length).toBe(1);
    expect(result.snapshot.medical_billing[0].billed_amount).toBe(3200);
    expect(result.snapshot.medical_billing[0].reviewer_recommended_amount).toBe(3000);
  });

  it("preserves package version metadata", () => {
    const pkg = makeMinimalPackage();
    pkg.metadata.package_version = 3;
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.source_package_version).toBe(3);
    expect(result.snapshot.source_snapshot_id).toBe("rp-001");
  });

  it("maps work restrictions to wage loss description", () => {
    const pkg = makeMinimalPackage();
    pkg.work_restrictions = {
      has_work_restrictions: true,
      restriction_type: "light_duty",
      duration_description: "4 weeks",
      summary: "Light duty restrictions for 4 weeks post-accident",
      citations: [],
    };
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.wage_loss.duration_description.value).toContain("Light duty");
  });

  it("derives imaging clinical flag from imaging summary", () => {
    const pkg = makeMinimalPackage();
    pkg.imaging_summary = {
      has_imaging: true,
      imaging_types: ["MRI"],
      key_findings: ["Disc herniation at C5-C6"],
      abnormalities_documented: true,
      citations: [{ source_document_id: "doc-2", source_page: 1, quoted_text: "MRI shows herniation", relevance_type: "direct" }],
    };
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.clinical_flags.has_advanced_imaging).toBe(true);
  });
});

// ─── Edge Cases ─────────────────────────────────────────

describe("Intake Contract Edge Cases", () => {
  it("handles empty package gracefully", () => {
    const pkg = makeMinimalPackage({
      accepted_injuries: [],
      accepted_treatments: [],
      providers: [],
      visit_chronology: [],
      diagnosis_summaries: [],
      procedure_summaries: [],
      treatment_gaps: [],
      unresolved_issues: [],
      evidence_citations: [],
      reviewed_specials: {
        total_billed: 0,
        total_reviewed: 0,
        total_accepted: 0,
        total_reduced: 0,
        total_disputed: 0,
        reduction_percentage: 0,
        by_provider: [],
        by_category: [],
      },
      reasonableness_findings: {
        overall_assessment: "reasonable",
        total_treatments_reviewed: 0,
        reasonable_count: 0,
        questionable_count: 0,
        unreasonable_count: 0,
        insufficient_info_count: 0,
        key_findings: [],
        guideline_references: [],
      },
    });
    const result = ingestReviewPackage(pkg, null);
    expect(result.snapshot.injuries.length).toBe(0);
    expect(result.snapshot.treatment_timeline.length).toBe(0);
    expect(result.validation.readiness).toBe("not_ready");
  });

  it("handles package with only disputed injuries", () => {
    const pkg = makeMinimalPackage();
    const disputed = { ...pkg.accepted_injuries[0], id: "inj-d", acceptance_status: "disputed" as const, dispute_reason: "IME disputes" };
    pkg.accepted_injuries = [];
    pkg.disputed_injuries = [disputed];
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.injuries.length).toBe(0);
    expect(result.snapshot.liability_facts.length).toBeGreaterThan(0);
  });

  it("preserves provider normalized name", () => {
    const pkg = makeMinimalPackage();
    const result = ingestReviewPackage(pkg, "user-001");
    expect(result.snapshot.providers[0].full_name).toBe("Metro Emergency Room"); // normalized
  });
});
