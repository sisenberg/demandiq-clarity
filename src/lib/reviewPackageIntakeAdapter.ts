/**
 * EvaluateIQ — ReviewPackage v1 Intake Adapter
 *
 * Normalizes a validated ReviewPackageV1 into EvaluateIQ's internal
 * EvaluateIntakeSnapshot. This is the sole ingestion boundary — EvaluateIQ
 * never directly reads ReviewerIQ tables or internal state.
 *
 * Preserves:
 *  - evidence links and reviewer acceptance state on all imported facts
 *  - package version metadata and publication timestamp
 *  - extraction confidence and reviewer confirmation states
 *
 * Error handling:
 *  - missing fields → partial provenance markers
 *  - contract drift → validation findings surfaced to UI
 */

import type { ReviewPackageV1, ReviewPackageCitation, ReviewerConfirmation, ExtractionConfidence } from "@/types/review-package-v1";
import type {
  EvaluateIntakeSnapshot,
  FieldProvenance,
  ProvenancedField,
  EvalInjury,
  EvalTreatmentEntry,
  EvalProvider,
  EvalMedicalBilling,
  EvalLiabilityFact,
  EvalPolicyCoverage,
  EvalUpstreamConcern,
  EvalClinicalFlags,
  CompletenessWarning,
  FieldCompleteness,
} from "@/types/evaluate-intake";
import { validateReviewPackage, type PackageValidationResult } from "@/lib/reviewPackageValidator";

// ─── Adapter Result ─────────────────────────────────────

export interface ReviewPackageIntakeResult {
  snapshot: EvaluateIntakeSnapshot;
  validation: PackageValidationResult;
  /** Was this ingested as a provisional (incomplete) package? */
  is_provisional: boolean;
}

// ─── Adapter ────────────────────────────────────────────

export function ingestReviewPackage(
  pkg: ReviewPackageV1,
  userId: string | null,
): ReviewPackageIntakeResult {
  const validation = validateReviewPackage(pkg);
  const isProvisional = validation.readiness === "provisional" || validation.readiness === "contract_mismatch";

  const snapshot = buildSnapshotFromReviewPackage(pkg, userId, validation);

  return {
    snapshot,
    validation,
    is_provisional: isProvisional,
  };
}

// ─── Snapshot Builder ───────────────────────────────────

function buildSnapshotFromReviewPackage(
  pkg: ReviewPackageV1,
  userId: string | null,
  validation: PackageValidationResult,
): EvaluateIntakeSnapshot {
  const meta = pkg.metadata;
  const ctx = pkg.evaluation_context;
  const ver = meta.package_version;

  const p = (
    completeness: FieldCompleteness = "complete",
    confidence: number | null = null,
    evidenceIds: string[] = [],
  ): FieldProvenance => ({
    source_module: "revieweriq",
    source_package_version: ver,
    completeness,
    confidence,
    evidence_ref_ids: evidenceIds,
  });

  const pField = <T>(value: T, completeness: FieldCompleteness = "complete", confidence: number | null = null): ProvenancedField<T> => ({
    value,
    provenance: p(completeness, confidence),
  });

  // ── Claimant ──
  const claimant = {
    claimant_name: pField(ctx.claimant_name, ctx.claimant_name ? "complete" : "missing"),
    date_of_birth: pField(ctx.claimant_dob, ctx.claimant_dob ? "complete" : "missing"),
    occupation: pField<string | null>(null, "missing"),
    employer: pField<string | null>(null, "missing"),
  };

  // ── Accident ──
  const accident = {
    date_of_loss: pField(ctx.date_of_loss, ctx.date_of_loss ? "complete" : "missing"),
    mechanism_of_loss: pField(ctx.mechanism_of_loss, ctx.mechanism_of_loss ? "complete" : "missing"),
    description: pField(ctx.mechanism_of_loss || "", ctx.mechanism_of_loss ? "complete" : "missing"),
  };

  // ── Injuries (accepted only for primary valuation) ──
  const injuries: EvalInjury[] = pkg.accepted_injuries.map(inj => ({
    id: inj.id,
    body_part: inj.body_part,
    body_region: inj.body_region,
    diagnosis_description: inj.diagnosis_description,
    diagnosis_code: inj.diagnosis_code,
    severity: inj.severity,
    is_pre_existing: inj.is_pre_existing,
    date_of_onset: inj.date_of_onset,
    provenance: p(
      "complete",
      inj.extraction_confidence.score,
      citationIds(inj.citations),
    ),
  }));

  // ── Treatment timeline ──
  const treatmentTimeline: EvalTreatmentEntry[] = pkg.accepted_treatments.map(tx => ({
    id: tx.id,
    treatment_type: tx.treatment_type,
    treatment_date: tx.treatment_date,
    treatment_end_date: tx.treatment_end_date,
    description: tx.description,
    procedure_codes: tx.procedure_codes,
    provider_name: tx.provider_name,
    facility_name: tx.facility_name,
    provenance: p(
      confirmationToCompleteness(tx.confirmation),
      tx.extraction_confidence.score,
      citationIds(tx.citations),
    ),
  }));

  // ── Providers ──
  const providers: EvalProvider[] = pkg.providers.map(pv => ({
    id: pv.id,
    full_name: pv.normalized_name || pv.full_name,
    specialty: pv.specialty,
    facility_name: pv.facility_name,
    role_description: pv.specialty,
    total_visits: pv.total_visits,
    first_visit_date: pv.first_visit_date,
    last_visit_date: pv.last_visit_date,
    total_billed: pv.total_billed,
    total_paid: pv.total_accepted,
    provenance: p("complete"),
  }));

  // ── Medical billing (from reviewed specials) ──
  const medicalBilling: EvalMedicalBilling[] = pkg.reviewed_specials.by_provider.map((prov_summary, i) => ({
    id: `rp-bill-${i}`,
    description: `Reviewed specials — ${prov_summary.provider_name}`,
    service_date: null,
    cpt_codes: [],
    billed_amount: prov_summary.billed,
    paid_amount: null,
    reviewer_recommended_amount: prov_summary.accepted,
    provider_name: prov_summary.provider_name,
    provenance: p("complete"),
  }));

  // ── Liability facts (from evaluation context + disputed injuries) ──
  const liabilityFacts: EvalLiabilityFact[] = [];
  // Disputed injuries become adverse liability facts
  pkg.disputed_injuries.forEach(inj => {
    liabilityFacts.push({
      id: `lf-dispute-${inj.id}`,
      fact_text: `Disputed injury: ${inj.diagnosis_description} (${inj.dispute_reason || "reviewer-disputed"})`,
      supports_liability: false,
      confidence: inj.extraction_confidence.score,
      provenance: p("complete", inj.extraction_confidence.score, citationIds(inj.citations)),
    });
  });

  // ── Comparative negligence ──
  const comparativeNegligence = {
    claimant_negligence_percentage: pField(ctx.comparative_negligence_pct, ctx.comparative_negligence_pct != null ? "complete" : "missing"),
    notes: pField("", "missing"),
  };

  // ── Venue/Jurisdiction ──
  const venueJurisdiction = {
    jurisdiction_state: pField(ctx.jurisdiction_state, ctx.jurisdiction_state ? "complete" : "missing"),
    venue_county: pField(ctx.venue_county, ctx.venue_county ? "complete" : "missing"),
  };

  // ── Policy coverage ──
  const policyCoverage: EvalPolicyCoverage[] = ctx.policy_limits != null ? [{
    carrier_name: "Primary",
    policy_type: ctx.policy_type || "BI",
    coverage_limit: ctx.policy_limits,
    deductible: null,
    provenance: p("complete"),
  }] : [];

  // ── Wage loss ──
  const wageLoss = {
    total_lost_wages: pField(0, "missing"),
    duration_description: pField<string | null>(
      pkg.work_restrictions.has_work_restrictions ? pkg.work_restrictions.summary : null,
      pkg.work_restrictions.has_work_restrictions ? "partial" : "missing",
    ),
  };

  // ── Future treatment ──
  const futureIndicators: string[] = [];
  if (pkg.surgery_indicators.post_surgical_complications.length > 0) futureIndicators.push("Post-surgical complications documented");
  if (pkg.impairment_evidence.has_permanency_indicators) futureIndicators.push("Permanency indicators present");
  if (pkg.functional_limitations.has_functional_limitations) futureIndicators.push("Functional limitations documented");
  const futureTreatment = {
    future_medical_estimate: pField(0, "missing"),
    indicators: pField(futureIndicators, futureIndicators.length > 0 ? "partial" : "missing"),
  };

  // ── Clinical flags ──
  const clinicalFlags: EvalClinicalFlags = {
    has_surgery: pkg.surgery_indicators.had_surgery,
    has_injections: pkg.procedure_summaries.some(ps => ["64483", "64493", "20610", "27096"].includes(ps.procedure_code)),
    has_advanced_imaging: pkg.imaging_summary.has_imaging && pkg.imaging_summary.imaging_types.some(t => ["MRI", "CT", "PET"].includes(t.toUpperCase())),
    has_permanency_indicators: pkg.impairment_evidence.has_permanency_indicators,
    has_impairment_rating: pkg.impairment_evidence.has_impairment_rating,
    has_scarring_disfigurement: false, // Not directly in ReviewPackage v1
    provenance: p("complete"),
  };

  // ── Upstream concerns ──
  const upstreamConcerns: EvalUpstreamConcern[] = [];
  let seq = 0;

  // From unresolved issues
  pkg.unresolved_issues.forEach(issue => {
    upstreamConcerns.push({
      id: `uc-${++seq}`,
      category: issueTypeToCategory(issue.issue_type),
      description: `[ReviewerIQ] ${issue.title}: ${issue.description}`,
      severity: issue.severity === "critical" || issue.severity === "high" ? "critical" : issue.severity === "medium" ? "warning" : "info",
      provenance: p("complete", null, citationIds(issue.citations)),
    });
  });

  // From treatment gaps
  pkg.treatment_gaps.filter(g => !g.is_explained).forEach(gap => {
    upstreamConcerns.push({
      id: `uc-gap-${++seq}`,
      category: "gap",
      description: `${gap.gap_days}-day treatment gap (${gap.gap_start_date} to ${gap.gap_end_date})${gap.preceding_provider ? ` after ${gap.preceding_provider}` : ""}`,
      severity: gap.severity === "critical" ? "critical" : gap.severity === "warning" ? "warning" : "info",
      provenance: p("complete"),
    });
  });

  // From reasonableness
  if (pkg.reasonableness_findings.overall_assessment === "questionable" || pkg.reasonableness_findings.overall_assessment === "unreasonable") {
    upstreamConcerns.push({
      id: `uc-reason-${++seq}`,
      category: "compliance",
      description: `Overall treatment reasonableness: ${pkg.reasonableness_findings.overall_assessment}. ${pkg.reasonableness_findings.questionable_count} questionable, ${pkg.reasonableness_findings.unreasonable_count} unreasonable.`,
      severity: "critical",
      provenance: p("complete"),
    });
  }

  // ── Completeness ──
  const completenessWarnings: CompletenessWarning[] = validation.findings
    .filter(f => f.severity === "error" || f.severity === "warning")
    .map(f => ({
      field: f.field,
      label: f.field.split(".").pop() || f.field,
      status: (f.severity === "error" ? "missing" : "partial") as FieldCompleteness,
      message: f.message,
    }));

  return {
    snapshot_id: `eval-rp-${meta.package_id}-${Date.now()}`,
    case_id: meta.case_id,
    tenant_id: meta.tenant_id,
    created_at: new Date().toISOString(),
    created_by: userId,
    source_module: "revieweriq",
    source_package_version: ver,
    source_snapshot_id: meta.package_id,
    claimant,
    accident,
    liability_facts: liabilityFacts,
    comparative_negligence: comparativeNegligence,
    venue_jurisdiction: venueJurisdiction,
    policy_coverage: policyCoverage,
    injuries,
    treatment_timeline: treatmentTimeline,
    providers,
    medical_billing: medicalBilling,
    wage_loss: wageLoss,
    future_treatment: futureTreatment,
    clinical_flags: clinicalFlags,
    upstream_concerns: upstreamConcerns,
    completeness_warnings: completenessWarnings,
    overall_completeness_score: validation.completeness_score,
  };
}

// ─── Helpers ────────────────────────────────────────────

function citationIds(citations: ReviewPackageCitation[]): string[] {
  return citations
    .filter(c => c.source_document_id)
    .map(c => `${c.source_document_id}:${c.source_page ?? 0}`);
}

function confirmationToCompleteness(conf: ReviewerConfirmation): FieldCompleteness {
  switch (conf.state) {
    case "reviewer_accepted":
    case "reviewer_corrected":
      return "complete";
    case "ai_suggested":
    case "unreviewed":
      return "partial";
    case "reviewer_rejected":
      return "missing";
  }
}

function issueTypeToCategory(issueType: string): EvalUpstreamConcern["category"] {
  if (issueType.includes("gap")) return "gap";
  if (issueType.includes("documentation") || issueType.includes("missing")) return "documentation";
  if (issueType.includes("code") || issueType.includes("coding") || issueType.includes("billing")) return "coding";
  if (issueType.includes("causation")) return "causation";
  if (issueType.includes("credibility") || issueType.includes("inconsisten")) return "credibility";
  if (issueType.includes("compliance")) return "compliance";
  return "other";
}
