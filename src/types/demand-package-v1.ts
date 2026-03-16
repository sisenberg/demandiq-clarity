/**
 * DemandPackageV1 — Formal contract for the upstream demand package
 * produced by DemandIQ and consumed by downstream modules (EvaluateIQ, NegotiateIQ).
 *
 * This is the canonical typed representation of the `intake_evaluation_packages` table row.
 * All downstream modules MUST reference this contract version when launching.
 */

// ─── Sub-types ───────────────────────────────────────

export type DemandPackageStatus = "draft" | "ready_for_review" | "published";

export interface DPCaseHeader {
  claimant_name: string;
  date_of_loss: string | null;
  claim_number: string;
  represented_status: string;
  attorney_name: string;
  law_firm: string;
  demand_amount: number | null;
  demand_deadline: string | null;
  demand_date: string | null;
}

export interface DPSourceDocumentEntry {
  document_id: string;
  filename: string;
  document_type: string;
  page_count: number | null;
  ocr_status: string;
  classification: string | null;
  processing_stage: string;
}

export interface DPExtractionSummary {
  total_documents: number;
  total_pages_processed: number;
  total_extracted_facts: number;
  extraction_confidence_avg: number | null;
  extraction_completed_at: string | null;
}

export interface DPEvidenceLinkedField {
  field_name: string;
  extracted_value: string;
  confidence: number | null;
  source_document_id: string | null;
  source_page: number | null;
  source_snippet: string;
  evidence_reference_id: string | null;
}

export interface DPChronologySeed {
  event_date: string;
  event_type: string;
  description: string;
  source_document_id: string | null;
  source_page: number | null;
}

export interface DPSpecialsSummary {
  total_billed: number;
  total_adjusted: number;
  total_balance: number;
  bill_count: number;
  provider_count: number;
  verified_count: number;
}

export interface DPInjurySeed {
  id: string;
  body_part: string;
  injury_description: string;
  icd_codes: string[] | null;
  diagnosis_description: string | null;
  objective_support_flag: boolean;
  invasive_treatment_flag: boolean;
  residual_symptom_flag: boolean;
  functional_impact_flag: boolean;
  verification_status: string;
}

export interface DPTreatmentSummary {
  total_events: number;
  first_treatment_date: string | null;
  last_treatment_date: string | null;
  treatment_duration_days: number;
  provider_count: number;
  verified_count: number;
  event_types: Record<string, number>;
}

export interface DPProviderEntry {
  party_id: string | null;
  name: string;
  organization: string;
  role: string;
}

export interface DPDamagesSeeds {
  specials_summary: DPSpecialsSummary;
  injury_summary: DPInjurySeed[];
  treatment_summary: DPTreatmentSummary;
  provider_list: DPProviderEntry[];
}

export interface DPClinicalFlag {
  injury_id: string;
  body_part: string;
  detail: string;
}

export interface DPClinicalIndicators {
  objective_support_flags: DPClinicalFlag[];
  invasive_treatment_flags: DPClinicalFlag[];
  residual_symptom_flags: DPClinicalFlag[];
  functional_impact_flags: DPClinicalFlag[];
}

export type DPFlagSeverity = "blocker" | "warning";

export interface DPReviewFlag {
  field: string;
  message: string;
  severity: DPFlagSeverity;
  is_blocker: boolean;
}

export interface DPCompleteness {
  quality_score: number;
  verified_sections: string[];
  missing_data_flags: { field: string; message: string }[];
}

export interface DPMetadata {
  assembled_at: string;
  assembled_by: string | null;
  published_at: string | null;
  published_by: string | null;
  engine_version: string;
}

// ─── Top-level contract ──────────────────────────────

export interface DemandPackageV1 {
  contract_version: "1.0.0";
  package_id: string;
  case_id: string;
  tenant_id: string;
  package_version: number;
  package_status: DemandPackageStatus;
  processing_run_id: string | null;

  case_header: DPCaseHeader;
  source_document_registry: DPSourceDocumentEntry[];
  extraction_summary: DPExtractionSummary;
  evidence_linked_fields: DPEvidenceLinkedField[];
  chronology_seeds: DPChronologySeed[];
  damages_seeds: DPDamagesSeeds;
  clinical_indicators: DPClinicalIndicators;
  review_needed_flags: DPReviewFlag[];
  completeness: DPCompleteness;
  metadata: DPMetadata;
}

// ─── Validation ──────────────────────────────────────

export interface DemandPackageValidation {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

const BLOCKER_FIELDS = new Set(["demand", "specials", "injuries"]);

export function validateDemandPackage(pkg: DemandPackageV1): DemandPackageValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!pkg.case_header.claimant_name) {
    blockers.push("Claimant name is required.");
  }
  if (pkg.case_header.demand_amount == null) {
    blockers.push("Demand amount is required.");
  }
  if (pkg.damages_seeds.injury_summary.length === 0) {
    blockers.push("At least one injury record is required.");
  }
  if (pkg.damages_seeds.specials_summary.bill_count === 0) {
    blockers.push("At least one specials record is required.");
  }

  for (const flag of pkg.review_needed_flags) {
    if (flag.is_blocker || BLOCKER_FIELDS.has(flag.field)) {
      blockers.push(flag.message);
    } else {
      warnings.push(flag.message);
    }
  }

  for (const flag of pkg.completeness.missing_data_flags) {
    if (BLOCKER_FIELDS.has(flag.field)) {
      blockers.push(flag.message);
    } else {
      warnings.push(flag.message);
    }
  }

  return { valid: blockers.length === 0, blockers, warnings };
}

export function isDemandPackagePublished(pkg: DemandPackageV1 | null | undefined): boolean {
  return pkg?.package_status === "published";
}

// ─── Mapper: DB row → DemandPackageV1 ────────────────

/**
 * Maps a raw `intake_evaluation_packages` row to the formal DemandPackageV1 contract.
 * The row's `package_payload` JSON already contains most nested structures.
 */
export function mapRowToDemandPackageV1(row: Record<string, any>): DemandPackageV1 {
  const payload = row.package_payload ?? {};
  const missingFlags: { field: string; message: string }[] = row.missing_data_flags ?? payload.missing_data_flags ?? [];

  // Derive status from DB status string
  let status: DemandPackageStatus = "draft";
  if (row.package_status === "published_to_evaluateiq") status = "published";
  else if (row.package_status === "ready_for_review") status = "ready_for_review";

  // Build review flags from missing_data_flags with severity
  const reviewFlags: DPReviewFlag[] = missingFlags.map((f) => ({
    field: f.field,
    message: f.message,
    severity: BLOCKER_FIELDS.has(f.field) ? "blocker" as const : "warning" as const,
    is_blocker: BLOCKER_FIELDS.has(f.field),
  }));

  // Compute quality score
  const totalSections = 4; // demand, specials, injuries, treatments
  const verifiedSections: string[] = [];
  if (row.claimant_name && row.demand_amount != null) verifiedSections.push("demand");
  const specialsSummary = row.specials_summary ?? payload.specials_summary ?? {};
  if ((specialsSummary.bill_count ?? 0) > 0) verifiedSections.push("specials");
  const injurySummary = row.injury_summary ?? payload.injury_summary ?? [];
  if (injurySummary.length > 0) verifiedSections.push("injuries");
  const treatmentSummary = row.treatment_summary ?? payload.treatment_summary ?? {};
  if ((treatmentSummary.total_events ?? 0) > 0) verifiedSections.push("treatments");
  const qualityScore = Math.round((verifiedSections.length / totalSections) * 100);

  return {
    contract_version: "1.0.0",
    package_id: row.id,
    case_id: row.case_id,
    tenant_id: row.tenant_id,
    package_version: row.version ?? 1,
    package_status: status,
    processing_run_id: null,

    case_header: {
      claimant_name: row.claimant_name ?? "",
      date_of_loss: null,
      claim_number: "",
      represented_status: row.represented_status ?? "",
      attorney_name: row.attorney_name ?? "",
      law_firm: row.law_firm ?? "",
      demand_amount: row.demand_amount ?? null,
      demand_deadline: row.demand_deadline ?? null,
      demand_date: null,
    },

    source_document_registry: [],
    extraction_summary: {
      total_documents: 0,
      total_pages_processed: 0,
      total_extracted_facts: 0,
      extraction_confidence_avg: null,
      extraction_completed_at: null,
    },

    evidence_linked_fields: [],
    chronology_seeds: [],

    damages_seeds: {
      specials_summary: {
        total_billed: specialsSummary.total_billed ?? 0,
        total_adjusted: specialsSummary.total_adjusted ?? 0,
        total_balance: specialsSummary.total_balance ?? 0,
        bill_count: specialsSummary.bill_count ?? 0,
        provider_count: specialsSummary.provider_count ?? 0,
        verified_count: specialsSummary.verified_count ?? 0,
      },
      injury_summary: (injurySummary as any[]).map((inj) => ({
        id: inj.id ?? "",
        body_part: inj.body_part ?? "",
        injury_description: inj.injury_description ?? "",
        icd_codes: inj.icd_codes ?? null,
        diagnosis_description: inj.diagnosis_description ?? null,
        objective_support_flag: inj.objective_support_flag ?? false,
        invasive_treatment_flag: inj.invasive_treatment_flag ?? false,
        residual_symptom_flag: inj.residual_symptom_flag ?? false,
        functional_impact_flag: inj.functional_impact_flag ?? false,
        verification_status: inj.verification_status ?? "unverified",
      })),
      treatment_summary: {
        total_events: treatmentSummary.total_events ?? 0,
        first_treatment_date: treatmentSummary.first_treatment_date ?? null,
        last_treatment_date: treatmentSummary.last_treatment_date ?? null,
        treatment_duration_days: treatmentSummary.treatment_duration_days ?? 0,
        provider_count: treatmentSummary.provider_count ?? 0,
        verified_count: treatmentSummary.verified_count ?? 0,
        event_types: treatmentSummary.event_types ?? {},
      },
      provider_list: (row.provider_list ?? payload.provider_list ?? []).map((p: any) => ({
        party_id: p.party_id ?? null,
        name: p.name ?? "",
        organization: p.organization ?? "",
        role: p.role ?? "provider",
      })),
    },

    clinical_indicators: {
      objective_support_flags: row.objective_support_flags ?? payload.objective_support_flags ?? [],
      invasive_treatment_flags: row.invasive_treatment_flags ?? payload.invasive_treatment_flags ?? [],
      residual_symptom_flags: row.residual_symptom_flags ?? payload.residual_symptom_flags ?? [],
      functional_impact_flags: row.functional_impact_flags ?? payload.functional_impact_flags ?? [],
    },

    review_needed_flags: reviewFlags,

    completeness: {
      quality_score: qualityScore,
      verified_sections: verifiedSections,
      missing_data_flags: missingFlags,
    },

    metadata: {
      assembled_at: row.assembled_at ?? row.created_at ?? "",
      assembled_by: row.assembled_by ?? null,
      published_at: row.published_at ?? null,
      published_by: row.published_by ?? null,
      engine_version: payload.schema_version ?? "1.0.0",
    },
  };
}
