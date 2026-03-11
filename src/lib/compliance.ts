/**
 * Compliance Data Inventory — Machine-readable classification of platform data assets.
 *
 * ⚠️ READINESS HARDENING ONLY — This file documents the data classification and trust
 * boundaries of the CasualtyIQ platform. It does NOT constitute a claim of SOC 2 Type II
 * certification or HIPAA compliance.
 *
 * This inventory is consumed by developer tooling and compliance documentation generators.
 * It should be kept in sync with schema changes.
 */

// ── Data classification levels ──────────────────────────────────────────

export type DataClassification =
  | "public"           // L0 — non-sensitive, safe for public exposure
  | "internal"         // L1 — business data, not personally identifiable
  | "confidential"     // L2 — business-sensitive, tenant-scoped
  | "restricted_pii"   // L3 — personally identifiable information
  | "restricted_phi";  // L4 — protected health information (HIPAA-relevant)

// ── Trust zones ─────────────────────────────────────────────────────────

export type TrustZone =
  | "primary_evidence"    // Raw files + OCR text + first-pass extractions
  | "derived_working"     // AI-generated structured data
  | "platform_config"     // System configuration, non-sensitive ops data
  | "non_production";     // Seed/dev/test data — NO real PII/PHI permitted

// ── Data asset descriptor ───────────────────────────────────────────────

export interface DataAssetDescriptor {
  /** Table or bucket name */
  asset: string;
  /** asset type */
  type: "table" | "storage_bucket";
  /** Highest data classification level present in this asset */
  classification: DataClassification;
  /** Whether PII may exist in this asset */
  containsPii: boolean;
  /** Whether PHI may exist in this asset */
  containsPhi: boolean;
  /** Tenant-scoped (RLS enforced) or global */
  tenantScoped: boolean;
  /** Trust zone assignment */
  trustZone: TrustZone;
  /** Retention intent */
  retention: "indefinite" | "configurable" | "session" | "ephemeral";
  /** Whether data in this asset should ever leave the primary trust boundary */
  mayLeaveboundary: boolean;
  /** Specific columns or fields that contain sensitive data */
  sensitiveFields?: string[];
  /** Notes for developers */
  notes?: string;
}

// ── Inventory ───────────────────────────────────────────────────────────

export const DATA_ASSET_INVENTORY: DataAssetDescriptor[] = [
  // ─── Primary Evidence Zone ────────────────────────────────────────────
  {
    asset: "case-documents",
    type: "storage_bucket",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "primary_evidence",
    retention: "indefinite",
    mayLeaveboundary: true, // Sent to AI gateway for OCR
    notes: "Raw uploaded documents. May contain medical records, billing, legal filings.",
  },
  {
    asset: "case_documents",
    type: "table",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "primary_evidence",
    retention: "indefinite",
    mayLeaveboundary: true, // extracted_text sent to AI for classification
    sensitiveFields: ["extracted_text", "file_name"],
    notes: "Document metadata + full extracted text. extracted_text contains OCR output of medical records.",
  },
  {
    asset: "document_pages",
    type: "table",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "primary_evidence",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["extracted_text"],
    notes: "Per-page OCR text. Same sensitivity as parent document.",
  },
  {
    asset: "document_metadata_extractions",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "primary_evidence",
    retention: "indefinite",
    mayLeaveboundary: true, // Sent to AI for entity normalization
    sensitiveFields: ["extracted_value", "user_corrected_value", "source_snippet"],
    notes: "Extracted field values: names, phones, emails, addresses, dates.",
  },
  {
    asset: "extracted_facts",
    type: "table",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "primary_evidence",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["fact_text", "source_snippet", "structured_data"],
    notes: "AI-extracted medical facts: diagnoses, treatments, medications.",
  },

  // ─── Derived Working Data Zone ────────────────────────────────────────
  {
    asset: "document_type_suggestions",
    type: "table",
    classification: "confidential",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["source_snippet"],
    notes: "AI-suggested document types. Source snippets may contain incidental PII.",
  },
  {
    asset: "entity_clusters",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["display_value", "canonical_value"],
    notes: "Normalized entity names (people, facilities, firms).",
  },
  {
    asset: "entity_cluster_members",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["raw_value", "source_snippet"],
  },
  {
    asset: "chronology_event_candidates",
    type: "table",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["label", "description", "machine_label", "machine_description"],
    notes: "AI-generated timeline events. Descriptions contain medical event details.",
  },
  {
    asset: "chronology_evidence_links",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["quoted_text"],
  },
  {
    asset: "fact_evidence_links",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    notes: "Link metadata only — no content fields.",
  },
  {
    asset: "generated_artifacts",
    type: "table",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["content_json"],
    notes: "Generated demand letters and reports. content_json contains full PHI.",
  },
  {
    asset: "derived-artifacts",
    type: "storage_bucket",
    classification: "restricted_phi",
    containsPii: true,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    notes: "Rendered artifact files (PDFs). Contains assembled PHI.",
  },

  // ─── Case Entity Tables ──────────────────────────────────────────────
  {
    asset: "cases",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["claimant", "defendant", "insured", "claim_number"],
  },
  {
    asset: "case_parties",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["full_name", "contact_email", "contact_phone", "address"],
  },
  {
    asset: "injuries",
    type: "table",
    classification: "restricted_phi",
    containsPii: false,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["diagnosis_code", "diagnosis_description", "body_part", "notes"],
  },
  {
    asset: "treatment_records",
    type: "table",
    classification: "restricted_phi",
    containsPii: false,
    containsPhi: true,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["description", "procedure_codes", "provider_name", "facility_name"],
  },
  {
    asset: "bills",
    type: "table",
    classification: "confidential",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["billed_amount", "paid_amount"],
  },
  {
    asset: "liability_facts",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["fact_text"],
  },
  {
    asset: "insurance_policies",
    type: "table",
    classification: "confidential",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "derived_working",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["policy_number", "coverage_limit"],
  },

  // ─── Platform Configuration Zone ──────────────────────────────────────
  {
    asset: "audit_events",
    type: "table",
    classification: "confidential",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
    notes: "before_value / after_value JSON may incidentally contain PII. Audit records are append-only.",
  },
  {
    asset: "profiles",
    type: "table",
    classification: "restricted_pii",
    containsPii: true,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
    sensitiveFields: ["email", "display_name"],
  },
  {
    asset: "tenants",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: false,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "user_roles",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: false,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "intake_jobs",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
    notes: "error_message field may contain file names. Should not contain PHI content.",
  },
  {
    asset: "jobs",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "module_completions",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "module_completion_snapshots",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "module_dependencies",
    type: "table",
    classification: "public",
    containsPii: false,
    containsPhi: false,
    tenantScoped: false,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "module_dependency_state",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "tenant_module_entitlements",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
  {
    asset: "duplicate_document_flags",
    type: "table",
    classification: "internal",
    containsPii: false,
    containsPhi: false,
    tenantScoped: true,
    trustZone: "platform_config",
    retention: "indefinite",
    mayLeaveboundary: false,
  },
];

// ── Compliance boundary guards ──────────────────────────────────────────

/**
 * Returns all assets that contain PHI and may leave the primary trust boundary.
 * These are the assets that require subprocessor agreements (BAA).
 */
export function getPhiBoundaryAssets(): DataAssetDescriptor[] {
  return DATA_ASSET_INVENTORY.filter((a) => a.containsPhi && a.mayLeaveboundary);
}

/**
 * Returns all assets classified at restricted_pii or restricted_phi.
 * These require special handling under HIPAA and privacy regulations.
 */
export function getRestrictedAssets(): DataAssetDescriptor[] {
  return DATA_ASSET_INVENTORY.filter(
    (a) => a.classification === "restricted_pii" || a.classification === "restricted_phi"
  );
}

/**
 * Guard: asserts that no non-production zone asset contains real PII/PHI.
 * Used as a developer sanity check — NOT a runtime enforcement mechanism.
 */
export function validateNonProductionZone(): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const asset of DATA_ASSET_INVENTORY) {
    if (asset.trustZone === "non_production" && (asset.containsPii || asset.containsPhi)) {
      violations.push(
        `${asset.asset}: non_production zone asset is marked as containing ${asset.containsPhi ? "PHI" : "PII"}`
      );
    }
  }
  return { valid: violations.length === 0, violations };
}
