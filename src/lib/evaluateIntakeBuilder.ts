/**
 * EvaluateIQ — Intake Snapshot Builder
 *
 * Reads upstream CasePackage (DemandIQ baseline or ReviewerIQ enriched)
 * and normalizes into an EvaluateIntakeSnapshot with field-level provenance.
 */

import type { CasePackage, DemandSummary } from "@/types";
import type { ReviewerPackage } from "@/types/reviewer-package";
import type {
  EvaluateIntakeSnapshot,
  FieldProvenance,
  ProvenancedField,
  EvalLiabilityFact,
  EvalInjury,
  EvalTreatmentEntry,
  EvalProvider,
  EvalMedicalBilling,
  EvalPolicyCoverage,
  EvalUpstreamConcern,
  CompletenessWarning,
  EvalClinicalFlags,
  FieldCompleteness,
} from "@/types/evaluate-intake";
import { TreatmentType } from "@/types";

// ─── Helpers ────────────────────────────────────────────

function prov(
  module: "demandiq" | "revieweriq",
  version: number,
  completeness: FieldCompleteness = "complete",
  confidence: number | null = null,
  evidenceIds: string[] = []
): FieldProvenance {
  return { source_module: module, source_package_version: version, completeness, confidence, evidence_ref_ids: evidenceIds };
}

function field<T>(value: T, p: FieldProvenance): ProvenancedField<T> {
  return { value, provenance: p };
}

function generateId(): string {
  return `eval-snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Builder ────────────────────────────────────────────

export interface SnapshotBuildInput {
  casePackage: CasePackage;
  reviewerPackage: ReviewerPackage | null;
  sourceModule: "demandiq" | "revieweriq";
  sourceVersion: number;
  sourceSnapshotId: string | null;
  userId: string | null;
}

export function buildEvaluateIntakeSnapshot(input: SnapshotBuildInput): EvaluateIntakeSnapshot {
  const { casePackage: pkg, reviewerPackage: rPkg, sourceModule, sourceVersion, sourceSnapshotId, userId } = input;
  const p = (c: FieldCompleteness = "complete", conf: number | null = null, eIds: string[] = []) =>
    prov(sourceModule, sourceVersion, c, conf, eIds);

  const caseRec = pkg.case_record;
  const demand = pkg.demand_summary;

  // ── Claimant ──
  const claimantParty = pkg.parties.find((pt) => pt.party_role === "claimant");
  const claimant = {
    claimant_name: field(caseRec.claimant || claimantParty?.full_name || "", p(caseRec.claimant ? "complete" : "missing")),
    date_of_birth: field(extractFromNotes(claimantParty?.notes, /DOB:\s*([^\s.]+)/), p("partial")),
    occupation: field(extractFromNotes(claimantParty?.notes, /Occupation:\s*(.+?)(?:\.|$)/i), p(claimantParty?.notes ? "partial" : "missing")),
    employer: field<string | null>(null, p("missing")),
  };

  // ── Accident ──
  const accidentEvent = pkg.timeline_events.find((e) => e.category === "Accident");
  const accident = {
    date_of_loss: field(caseRec.date_of_loss || "", p(caseRec.date_of_loss ? "complete" : "missing")),
    mechanism_of_loss: field(caseRec.mechanism_of_loss || "", p(caseRec.mechanism_of_loss ? "complete" : "missing")),
    description: field(accidentEvent?.description || "", p(accidentEvent ? "complete" : "missing", null, accidentEvent?.evidence_refs.map((r) => r.id) ?? [])),
  };

  // ── Liability ──
  const liabilityFacts: EvalLiabilityFact[] = pkg.liability_facts.map((lf) => ({
    id: lf.id,
    fact_text: lf.fact_text,
    supports_liability: lf.supports_liability,
    confidence: lf.confidence_score,
    provenance: p("complete", lf.confidence_score, lf.evidence_refs.map((r) => r.id)),
  }));

  // ── Comparative negligence (inferred) ──
  const compNegFact = pkg.liability_facts.find((lf) =>
    lf.fact_text.toLowerCase().includes("contributory") || lf.fact_text.toLowerCase().includes("comparative")
  );
  const comparativeNegligence = {
    claimant_negligence_percentage: field<number | null>(compNegFact ? 0 : null, p(compNegFact ? "partial" : "missing")),
    notes: field(compNegFact?.fact_text || "", p(compNegFact ? "complete" : "missing")),
  };

  // ── Venue / Jurisdiction ──
  const venueJurisdiction = {
    jurisdiction_state: field(caseRec.jurisdiction_state || "", p(caseRec.jurisdiction_state ? "complete" : "missing")),
    venue_county: field<string | null>(null, p("missing")),
  };

  // ── Policy coverage ──
  const policyCoverage: EvalPolicyCoverage[] = pkg.insurance_policies.map((pol) => ({
    carrier_name: pol.carrier_name,
    policy_type: pol.policy_type,
    coverage_limit: pol.coverage_limit,
    deductible: pol.deductible,
    provenance: p("complete"),
  }));

  // ── Injuries ──
  const injuries: EvalInjury[] = pkg.injuries.map((inj) => ({
    id: inj.id,
    body_part: inj.body_part,
    body_region: inj.body_region,
    diagnosis_description: inj.diagnosis_description,
    diagnosis_code: inj.diagnosis_code,
    severity: inj.severity,
    is_pre_existing: inj.is_pre_existing,
    date_of_onset: inj.date_of_onset,
    provenance: p("complete", null, inj.evidence_refs.map((r) => r.id)),
  }));

  // ── Treatment timeline ──
  const treatmentTimeline: EvalTreatmentEntry[] = pkg.treatments.map((tx) => ({
    id: tx.id,
    treatment_type: tx.treatment_type,
    treatment_date: tx.treatment_date,
    treatment_end_date: tx.treatment_end_date,
    description: tx.description,
    procedure_codes: tx.procedure_codes,
    provider_name: tx.provider_name,
    facility_name: tx.facility_name,
    provenance: p("complete", null, tx.evidence_refs.map((r) => r.id)),
  }));

  // ── Providers ──
  const providers: EvalProvider[] = pkg.providers.map((pv) => ({
    id: pv.id,
    full_name: pv.full_name,
    specialty: pv.specialty,
    facility_name: pv.facility_name,
    role_description: pv.role_description,
    total_visits: pv.total_visits,
    first_visit_date: pv.first_visit_date,
    last_visit_date: pv.last_visit_date,
    total_billed: pv.total_billed,
    total_paid: pv.total_paid,
    provenance: p("complete"),
  }));

  // ── Medical billing ──
  // When ReviewerIQ is available, enrich with recommended amounts
  const reviewerBillMap = new Map<string, number>();
  if (rPkg) {
    for (const bl of rPkg.bill_lines) {
      // Use accepted_amount (reviewer disposition) or reference_amount as fallback
      const amt = bl.accepted_amount ?? bl.reference_amount;
      if (amt != null) {
        reviewerBillMap.set(bl.id, amt);
      }
    }
  }

  const medicalBilling: EvalMedicalBilling[] = pkg.billing_lines.map((bl) => ({
    id: bl.id,
    description: bl.description,
    service_date: bl.service_date,
    cpt_codes: bl.cpt_codes,
    billed_amount: bl.billed_amount,
    paid_amount: bl.paid_amount,
    reviewer_recommended_amount: reviewerBillMap.get(bl.id) ?? null,
    provider_name: bl.provider_name,
    provenance: p("complete"),
  }));

  // ── Wage loss ──
  const wageLoss = {
    total_lost_wages: field(demand.lost_wages, p(demand.lost_wages > 0 ? "complete" : "missing")),
    duration_description: field<string | null>(null, p("missing")),
  };

  // ── Future treatment ──
  const futureTreatment = {
    future_medical_estimate: field(demand.future_medical, p(demand.future_medical > 0 ? "complete" : "missing")),
    indicators: field<string[]>(deriveFutureTreatmentIndicators(pkg), p("partial")),
  };

  // ── Clinical flags ──
  const clinicalFlags = deriveClinicalFlags(pkg, p());

  // ── Upstream concerns ──
  const upstreamConcerns = deriveUpstreamConcerns(pkg, rPkg, sourceModule, sourceVersion);

  // ── Completeness ──
  const { warnings, score } = assessCompleteness({
    claimant, accident, liabilityFacts, comparativeNegligence,
    venueJurisdiction, policyCoverage, injuries, treatmentTimeline,
    providers, medicalBilling, wageLoss, futureTreatment,
  });

  return {
    snapshot_id: generateId(),
    case_id: caseRec.id,
    tenant_id: caseRec.tenant_id,
    created_at: new Date().toISOString(),
    created_by: userId,
    source_module: sourceModule,
    source_package_version: sourceVersion,
    source_snapshot_id: sourceSnapshotId,
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
    completeness_warnings: warnings,
    overall_completeness_score: score,
  };
}

// ─── Clinical flag derivation ───────────────────────────

function deriveClinicalFlags(pkg: CasePackage, baseProv: FieldProvenance): EvalClinicalFlags {
  const txTypes = new Set(pkg.treatments.map((t) => t.treatment_type));
  const allCodes = pkg.billing_lines.flatMap((b) => b.cpt_codes);
  const injuryNotes = pkg.injuries.map((i) => `${i.diagnosis_description} ${i.notes}`.toLowerCase()).join(" ");

  return {
    has_surgery: txTypes.has(TreatmentType.Surgery) || allCodes.some((c) => parseInt(c) >= 20000 && parseInt(c) <= 69999),
    has_injections: txTypes.has(TreatmentType.Injection) || allCodes.includes("64483") || allCodes.includes("64493"),
    has_advanced_imaging: txTypes.has(TreatmentType.DiagnosticImaging) || allCodes.some((c) => ["72141", "73721", "70553", "72148"].includes(c)),
    has_permanency_indicators: injuryNotes.includes("permanent") || injuryNotes.includes("impairment") || injuryNotes.includes("herniation"),
    has_impairment_rating: injuryNotes.includes("impairment rating") || injuryNotes.includes("mmi"),
    has_scarring_disfigurement: injuryNotes.includes("scar") || injuryNotes.includes("disfigure"),
    provenance: baseProv,
  };
}

// ─── Future treatment indicators ────────────────────────

function deriveFutureTreatmentIndicators(pkg: CasePackage): string[] {
  const indicators: string[] = [];
  const notes = pkg.injuries.map((i) => i.notes.toLowerCase()).join(" ");
  const txDesc = pkg.treatments.map((t) => t.description.toLowerCase()).join(" ");
  const allText = `${notes} ${txDesc}`;

  if (allText.includes("surgical") || allText.includes("surgery")) indicators.push("Surgical intervention discussed");
  if (allText.includes("follow-up pending") || allText.includes("pending")) indicators.push("Follow-up treatment pending");
  if (allText.includes("neurosurg")) indicators.push("Neurosurgical consultation recommended");
  if (allText.includes("conservative treatment has not been exhausted")) indicators.push("Conservative treatment not exhausted (per IME)");
  if (allText.includes("herniation")) indicators.push("Disc herniation — potential long-term management");

  return indicators;
}

// ─── Upstream concern derivation ────────────────────────

function deriveUpstreamConcerns(
  pkg: CasePackage,
  rPkg: ReviewerPackage | null,
  sourceModule: "demandiq" | "revieweriq",
  sourceVersion: number,
): EvalUpstreamConcern[] {
  const concerns: EvalUpstreamConcern[] = [];
  const baseProv = prov(sourceModule, sourceVersion, "complete");
  let seq = 0;

  // From issue flags
  for (const flag of pkg.issue_flags) {
    const category = flagTypeToCategory(flag.flag_type);
    concerns.push({
      id: `concern-${++seq}`,
      category,
      description: flag.description,
      severity: flag.severity === "critical" || flag.severity === "high" ? "critical" : flag.severity === "medium" ? "warning" : "info",
      provenance: baseProv,
    });
  }

  // From ReviewerIQ issues if available
  if (rPkg) {
    for (const issue of rPkg.issues) {
      concerns.push({
        id: `concern-${++seq}`,
        category: "other",
        description: `[ReviewerIQ] ${issue.title}: ${issue.description}`,
        severity: issue.severity === "critical" ? "critical" : issue.severity === "high" ? "warning" : "info",
        provenance: prov("revieweriq", sourceVersion, "complete"),
      });
    }
  }

  return concerns;
}

function flagTypeToCategory(flagType: string): EvalUpstreamConcern["category"] {
  switch (flagType) {
    case "treatment_gap": return "gap";
    case "incomplete_compliance": return "compliance";
    case "causation_risk": return "causation";
    case "documentation_missing": return "documentation";
    case "inconsistency": return "credibility";
    case "pre_existing_condition": return "causation";
    default: return "other";
  }
}

// ─── Completeness assessment ────────────────────────────

function assessCompleteness(sections: Record<string, unknown>): { warnings: CompletenessWarning[]; score: number } {
  const warnings: CompletenessWarning[] = [];
  const checks: { field: string; label: string; present: boolean; critical: boolean }[] = [
    { field: "claimant_name", label: "Claimant Name", present: !!(sections.claimant as any).claimant_name.value, critical: true },
    { field: "date_of_loss", label: "Date of Loss", present: !!(sections.accident as any).date_of_loss.value, critical: true },
    { field: "mechanism_of_loss", label: "Mechanism of Loss", present: !!(sections.accident as any).mechanism_of_loss.value, critical: false },
    { field: "liability_facts", label: "Liability Facts", present: (sections.liabilityFacts as any[]).length > 0, critical: true },
    { field: "jurisdiction_state", label: "Jurisdiction / State", present: !!(sections.venueJurisdiction as any).jurisdiction_state.value, critical: true },
    { field: "policy_coverage", label: "Policy / Coverage Limits", present: (sections.policyCoverage as any[]).length > 0, critical: false },
    { field: "injuries", label: "Injuries", present: (sections.injuries as any[]).length > 0, critical: true },
    { field: "treatment_timeline", label: "Treatment Timeline", present: (sections.treatmentTimeline as any[]).length > 0, critical: true },
    { field: "providers", label: "Providers", present: (sections.providers as any[]).length > 0, critical: false },
    { field: "medical_billing", label: "Medical Billing", present: (sections.medicalBilling as any[]).length > 0, critical: true },
    { field: "wage_loss", label: "Wage / Earnings Loss", present: (sections.wageLoss as any).total_lost_wages.value > 0, critical: false },
    { field: "future_treatment", label: "Future Treatment Estimate", present: (sections.futureTreatment as any).future_medical_estimate.value > 0, critical: false },
    { field: "comparative_negligence", label: "Comparative Negligence", present: (sections.comparativeNegligence as any).claimant_negligence_percentage.value !== null, critical: false },
  ];

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const check of checks) {
    const weight = check.critical ? 10 : 5;
    totalWeight += weight;
    if (check.present) {
      earnedWeight += weight;
    } else {
      warnings.push({
        field: check.field,
        label: check.label,
        status: check.critical ? "missing" : "partial",
        message: check.critical
          ? `${check.label} is required for accurate valuation but was not found in the upstream package.`
          : `${check.label} is not available. This may affect valuation accuracy.`,
      });
    }
  }

  const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
  return { warnings, score };
}

// ─── Utility ────────────────────────────────────────────

function extractFromNotes(notes: string | undefined, pattern: RegExp): string | null {
  if (!notes) return null;
  const match = notes.match(pattern);
  return match ? match[1].trim() : null;
}
