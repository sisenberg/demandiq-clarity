/**
 * Adapter: DemandPackageV1 → EvaluateIntakeSnapshot
 *
 * Maps the real DB-backed published demand package into the normalized
 * intake snapshot consumed by the EvaluateIQ valuation workspace.
 */

import type { DemandPackageV1 } from "@/types/demand-package-v1";
import type {
  EvaluateIntakeSnapshot,
  FieldProvenance,
  ProvenancedField,
  EvalClaimantIdentity,
  EvalAccidentFacts,
  EvalLiabilityFact,
  EvalComparativeNegligence,
  EvalVenueJurisdiction,
  EvalPolicyCoverage,
  EvalInjury,
  EvalTreatmentEntry,
  EvalProvider,
  EvalMedicalBilling,
  EvalWageLoss,
  EvalFutureTreatment,
  EvalClinicalFlags,
  EvalUpstreamConcern,
  CompletenessWarning,
} from "@/types/evaluate-intake";

// ─── Helpers ────────────────────────────────────────────

function baseProv(version: number, confidence: number | null = null, completeness: "complete" | "partial" | "missing" = "complete"): FieldProvenance {
  return {
    source_module: "demandiq",
    source_package_version: version,
    evidence_ref_ids: [],
    confidence,
    completeness,
  };
}

function prov<T>(value: T, version: number, completeness?: "complete" | "partial" | "missing"): ProvenancedField<T> {
  const c = completeness ?? (value == null || value === "" ? "missing" : "complete");
  return { value, provenance: baseProv(version, null, c) };
}

// ─── Public API ─────────────────────────────────────────

export function buildIntakeFromDemandPackage(
  pkg: DemandPackageV1,
  userId: string | null = null,
): EvaluateIntakeSnapshot {
  const v = pkg.package_version;
  const h = pkg.case_header;
  const ds = pkg.damages_seeds;
  const ci = pkg.clinical_indicators;

  // Claimant
  const claimant: EvalClaimantIdentity = {
    claimant_name: prov(h.claimant_name, v),
    date_of_birth: prov<string | null>(null, v, "missing"),
    occupation: prov<string | null>(null, v, "missing"),
    employer: prov<string | null>(null, v, "missing"),
  };

  // Accident
  const accident: EvalAccidentFacts = {
    date_of_loss: prov(h.date_of_loss ?? "", v, h.date_of_loss ? "complete" : "missing"),
    mechanism_of_loss: prov("", v, "missing"),
    description: prov("", v, "missing"),
  };

  // Liability — no structured facts in DemandPackage, empty
  const liability_facts: EvalLiabilityFact[] = [];

  const comparative_negligence: EvalComparativeNegligence = {
    claimant_negligence_percentage: prov<number | null>(null, v, "missing"),
    notes: prov("", v, "missing"),
  };

  // Venue — derive from case header if available
  const venue_jurisdiction: EvalVenueJurisdiction = {
    jurisdiction_state: prov("", v, "missing"),
    venue_county: prov<string | null>(null, v, "missing"),
  };

  // Policy coverage — demand amount as a proxy entry
  const policy_coverage: EvalPolicyCoverage[] = [];
  if (h.demand_amount != null) {
    policy_coverage.push({
      carrier_name: "",
      policy_type: "demand",
      coverage_limit: h.demand_amount,
      deductible: null,
      provenance: baseProv(v),
    });
  }

  // Injuries
  const injuries: EvalInjury[] = ds.injury_summary.map((inj) => ({
    id: inj.id,
    body_part: inj.body_part,
    body_region: inj.body_part,
    diagnosis_description: inj.diagnosis_description ?? inj.injury_description,
    diagnosis_code: inj.icd_codes?.[0] ?? "",
    severity: inj.invasive_treatment_flag ? "severe" : "moderate",
    is_pre_existing: false,
    date_of_onset: null,
    provenance: baseProv(v),
  }));

  // Treatment timeline — single summary entry when data exists
  const treatment_timeline: EvalTreatmentEntry[] = [];
  if (ds.treatment_summary.total_events > 0) {
    treatment_timeline.push({
      id: `ts-${pkg.package_id}`,
      treatment_type: "summary",
      treatment_date: ds.treatment_summary.first_treatment_date,
      treatment_end_date: ds.treatment_summary.last_treatment_date,
      description: `${ds.treatment_summary.total_events} treatment events over ${ds.treatment_summary.treatment_duration_days} days`,
      procedure_codes: [],
      provider_name: "",
      facility_name: "",
      provenance: baseProv(v),
    });
  }

  // Providers
  const providers: EvalProvider[] = ds.provider_list.map((p) => ({
    id: p.party_id ?? p.name,
    full_name: p.name,
    specialty: p.role,
    facility_name: p.organization,
    role_description: p.role,
    total_visits: 0,
    first_visit_date: null,
    last_visit_date: null,
    total_billed: 0,
    total_paid: 0,
    provenance: baseProv(v),
  }));

  // Medical billing — aggregate from specials summary
  const medical_billing: EvalMedicalBilling[] = [];
  if (ds.specials_summary.bill_count > 0) {
    medical_billing.push({
      id: `specials-${pkg.package_id}`,
      description: `${ds.specials_summary.bill_count} bills from ${ds.specials_summary.provider_count} providers`,
      service_date: null,
      cpt_codes: [],
      billed_amount: ds.specials_summary.total_billed,
      paid_amount: null,
      reviewer_recommended_amount: ds.specials_summary.total_adjusted || null,
      provider_name: "",
      provenance: baseProv(v),
    });
  }

  // Wage loss & future treatment — not in DemandPackage
  const wage_loss: EvalWageLoss = {
    total_lost_wages: prov(0, v, "missing"),
    duration_description: prov<string | null>(null, v, "missing"),
  };

  const future_treatment: EvalFutureTreatment = {
    future_medical_estimate: prov(0, v, "missing"),
    indicators: prov<string[]>([], v, "missing"),
  };

  // Clinical flags
  const hasFlag = (arr: any[]) => arr.length > 0;
  const clinical_flags: EvalClinicalFlags = {
    has_surgery: hasFlag(ci.invasive_treatment_flags),
    has_injections: false,
    has_advanced_imaging: false,
    has_permanency_indicators: hasFlag(ci.residual_symptom_flags),
    has_impairment_rating: false,
    has_scarring_disfigurement: false,
    provenance: baseProv(v),
  };

  // Upstream concerns from review flags
  const upstream_concerns: EvalUpstreamConcern[] = pkg.review_needed_flags.map((f, i) => ({
    id: `uc-${i}`,
    category: "other" as const,
    description: f.message,
    severity: f.severity === "blocker" ? "critical" as const : "warning" as const,
    provenance: baseProv(v),
  }));

  // Completeness warnings
  const completeness_warnings: CompletenessWarning[] = pkg.completeness.missing_data_flags.map((f) => ({
    field: f.field,
    label: f.field,
    status: "missing" as const,
    message: f.message,
  }));

  return {
    snapshot_id: `snap-${pkg.package_id}-v${v}`,
    case_id: pkg.case_id,
    tenant_id: pkg.tenant_id,
    created_at: new Date().toISOString(),
    created_by: userId,
    source_module: "demandiq",
    source_package_version: v,
    source_snapshot_id: pkg.package_id,
    claimant,
    accident,
    liability_facts,
    comparative_negligence,
    venue_jurisdiction,
    policy_coverage,
    injuries,
    treatment_timeline,
    providers,
    medical_billing,
    wage_loss,
    future_treatment,
    clinical_flags,
    upstream_concerns,
    completeness_warnings,
    overall_completeness_score: pkg.completeness.quality_score,
  };
}
