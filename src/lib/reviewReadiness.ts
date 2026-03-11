/**
 * ReviewerIQ — Medical Review Readiness Engine
 *
 * Generates actionable issue flags from treatment records and computes
 * a readiness status for case triage. This is a first-pass review layer —
 * not AMA/Medicare medical necessity analysis.
 */

import { differenceInDays, parseISO } from "date-fns";
import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";

// ─── Flag Types ─────────────────────────────────────────

export type ReviewFlagSeverity = "error" | "warning" | "info";

export type ReviewFlagCategory =
  | "missing_date"
  | "missing_provider"
  | "duplicate_visit"
  | "bill_no_treatment"
  | "treatment_no_bill"
  | "inconsistent_provider"
  | "chronology_gap"
  | "ambiguous_extraction"
  | "unsupported_code_format"
  | "low_confidence";

export interface ReviewFlag {
  id: string;
  category: ReviewFlagCategory;
  severity: ReviewFlagSeverity;
  title: string;
  description: string;
  /** ID of the treatment record this flag is attached to, if any */
  recordId: string | null;
  /** Provider name for provider-level flags */
  providerName?: string;
  /** Actionable — what the reviewer should do */
  action: string;
}

export type ReadinessStatus = "not_ready" | "partially_ready" | "review_ready";

export interface ReadinessAssessment {
  status: ReadinessStatus;
  score: number; // 0–100
  flags: ReviewFlag[];
  summary: string;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  /** Breakdown by category for the summary panel */
  categoryCounts: Record<ReviewFlagCategory, number>;
}

// ─── Labels ─────────────────────────────────────────────

export const READINESS_STATUS_LABEL: Record<ReadinessStatus, string> = {
  not_ready: "Not Ready",
  partially_ready: "Partially Ready",
  review_ready: "Review Ready",
};

export const FLAG_CATEGORY_LABEL: Record<ReviewFlagCategory, string> = {
  missing_date: "Missing Visit Date",
  missing_provider: "Missing Provider",
  duplicate_visit: "Duplicate Visit",
  bill_no_treatment: "Bill Without Treatment",
  treatment_no_bill: "Treatment Without Bill",
  inconsistent_provider: "Inconsistent Provider Name",
  chronology_gap: "Treatment Gap",
  ambiguous_extraction: "Ambiguous Extraction",
  unsupported_code_format: "Unsupported Code Format",
  low_confidence: "Low Confidence",
};

export const FLAG_SEVERITY_LABEL: Record<ReviewFlagSeverity, string> = {
  error: "Error",
  warning: "Warning",
  info: "Info",
};

// ─── Configuration ──────────────────────────────────────

export interface ReadinessConfig {
  /** Days between visits to flag as a gap */
  gapThresholdDays: number;
  /** Confidence score below which to flag */
  lowConfidenceThreshold: number;
  /** Provider similarity score to flag inconsistency */
  providerSimilarityThreshold: number;
}

export const DEFAULT_READINESS_CONFIG: ReadinessConfig = {
  gapThresholdDays: 30,
  lowConfidenceThreshold: 0.5,
  providerSimilarityThreshold: 0.7,
};

// ─── Flag Generation ────────────────────────────────────

let flagSeq = 0;
function flagId(): string {
  return `rf-${++flagSeq}`;
}

/** Simple provider name normalization for comparison */
function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(dr\.?|m\.?d\.?|d\.?o\.?|ph\.?d\.?|rn|np|pa-c|pt|dpt|dc)\b/gi, "")
    .replace(/[,.\-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Dice coefficient for string similarity */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bi = s.substring(i, i + 2);
      m.set(bi, (m.get(bi) || 0) + 1);
    }
    return m;
  };
  const aB = bigrams(a);
  const bB = bigrams(b);
  let inter = 0;
  for (const [k, c] of aB) inter += Math.min(c, bB.get(k) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}

/** ICD-10 pattern: letter + 2+ digits, optional dot + more chars */
const ICD10_PATTERN = /^[A-Z]\d{2}(\.\d{1,4})?([A-Z]{1,2})?$/i;
/** CPT pattern: 5 digits, optional modifier */
const CPT_PATTERN = /^\d{5}(-\d{2})?$/;

export function generateReviewFlags(
  records: ReviewerTreatmentRecord[],
  config: ReadinessConfig = DEFAULT_READINESS_CONFIG,
): ReviewFlag[] {
  flagSeq = 0;
  const flags: ReviewFlag[] = [];

  // ── Per-record flags ──────────────────────────────────

  for (const r of records) {
    // 1. Missing visit date
    if (!r.visit_date) {
      flags.push({
        id: flagId(), category: "missing_date", severity: "error",
        title: "Missing visit date",
        description: `Record from ${r.provider_name_raw || "unknown provider"} has no parseable visit date. Raw text: "${r.visit_date_text || "(empty)"}".`,
        recordId: r.id,
        action: "Manually enter or correct the visit date.",
      });
    }

    // 2. Missing provider
    if (!r.provider_name_raw && !r.provider_name_normalized) {
      flags.push({
        id: flagId(), category: "missing_provider", severity: "error",
        title: "Missing provider name",
        description: `Treatment record on ${r.visit_date || "unknown date"} has no provider or facility identified.`,
        recordId: r.id,
        action: "Review source document and enter provider name.",
      });
    }

    // 3. Duplicate visit (already flagged by extraction)
    if (r.is_duplicate_suspect) {
      flags.push({
        id: flagId(), category: "duplicate_visit", severity: "warning",
        title: "Possible duplicate visit",
        description: r.duplicate_reason || `Visit on ${r.visit_date || "unknown date"} may be a duplicate (${((r.duplicate_similarity ?? 0) * 100).toFixed(0)}% match).`,
        recordId: r.id,
        action: "Confirm or dismiss the duplicate flag.",
      });
    }

    // 4. Treatment with no linked bill
    if ((r.total_billed == null || r.total_billed === 0) && r.visit_type !== "ime") {
      flags.push({
        id: flagId(), category: "treatment_no_bill", severity: "warning",
        title: "No linked bill",
        description: `${VISIT_TYPE_LABELS[r.visit_type] || r.visit_type} visit on ${r.visit_date || "unknown date"} at ${r.facility_name || r.provider_name_raw || "unknown"} has no associated billing.`,
        recordId: r.id,
        action: "Link an existing bill or note as unbilled.",
      });
    }

    // 5. Ambiguous extraction fields
    if (r.is_date_ambiguous) {
      flags.push({
        id: flagId(), category: "ambiguous_extraction", severity: "warning",
        title: "Ambiguous date",
        description: `Visit date "${r.visit_date_text}" could not be unambiguously parsed. Resolved as ${r.visit_date || "null"}.`,
        recordId: r.id,
        action: "Verify and correct the visit date.",
      });
    }

    // 6. Low confidence
    if (r.overall_confidence != null && r.overall_confidence < config.lowConfidenceThreshold) {
      flags.push({
        id: flagId(), category: "low_confidence", severity: "warning",
        title: "Low extraction confidence",
        description: `Extraction confidence is ${(r.overall_confidence * 100).toFixed(0)}% — below the ${(config.lowConfidenceThreshold * 100).toFixed(0)}% threshold.`,
        recordId: r.id,
        action: "Review extracted data against the source document.",
      });
    }

    // 7. Unsupported code formats
    for (const dx of r.diagnoses) {
      if (dx.code && !ICD10_PATTERN.test(dx.code)) {
        flags.push({
          id: flagId(), category: "unsupported_code_format", severity: "info",
          title: "Non-standard diagnosis code",
          description: `Code "${dx.code}" (${dx.description}) does not match ICD-10 format.`,
          recordId: r.id,
          action: "Verify or correct the diagnosis code.",
        });
      }
    }
    for (const px of r.procedures) {
      if (px.code && !CPT_PATTERN.test(px.code)) {
        flags.push({
          id: flagId(), category: "unsupported_code_format", severity: "info",
          title: "Non-standard procedure code",
          description: `Code "${px.code}" (${px.description}) does not match CPT format.`,
          recordId: r.id,
          action: "Verify or correct the procedure code.",
        });
      }
    }
  }

  // ── Cross-record flags ────────────────────────────────

  // 8. Chronology gaps
  const dated = records.filter((r) => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
  for (let i = 1; i < dated.length; i++) {
    const days = differenceInDays(parseISO(dated[i].visit_date!), parseISO(dated[i - 1].visit_date!));
    if (days > config.gapThresholdDays) {
      flags.push({
        id: flagId(), category: "chronology_gap", severity: "warning",
        title: `${days}-day treatment gap`,
        description: `No visits recorded between ${dated[i - 1].visit_date} and ${dated[i].visit_date} (${days} days). Threshold: ${config.gapThresholdDays} days.`,
        recordId: null,
        action: "Verify if records are missing or if the gap is expected.",
      });
    }
  }

  // 9. Inconsistent provider naming
  const providerGroups = new Map<string, Set<string>>();
  for (const r of records) {
    const raw = r.provider_name_raw;
    if (!raw) continue;
    const norm = normalizeForMatch(raw);
    if (!norm) continue;

    let matched = false;
    for (const [key, variants] of providerGroups) {
      if (dice(norm, key) >= config.providerSimilarityThreshold) {
        variants.add(raw);
        matched = true;
        break;
      }
    }
    if (!matched) {
      providerGroups.set(norm, new Set([raw]));
    }
  }

  for (const [, variants] of providerGroups) {
    if (variants.size > 1) {
      const names = [...variants];
      flags.push({
        id: flagId(), category: "inconsistent_provider", severity: "info",
        title: "Inconsistent provider naming",
        description: `The same provider appears under ${variants.size} different names: ${names.map((n) => `"${n}"`).join(", ")}.`,
        recordId: null,
        providerName: names[0],
        action: "Merge provider aliases to a canonical name.",
      });
    }
  }

  return flags;
}

// ─── Readiness Scoring ──────────────────────────────────

export function assessReadiness(
  records: ReviewerTreatmentRecord[],
  config: ReadinessConfig = DEFAULT_READINESS_CONFIG,
): ReadinessAssessment {
  const flags = generateReviewFlags(records, config);

  const errorCount = flags.filter((f) => f.severity === "error").length;
  const warningCount = flags.filter((f) => f.severity === "warning").length;
  const infoCount = flags.filter((f) => f.severity === "info").length;

  // Category counts
  const categoryCounts = {} as Record<ReviewFlagCategory, number>;
  for (const cat of Object.keys(FLAG_CATEGORY_LABEL) as ReviewFlagCategory[]) {
    categoryCounts[cat] = flags.filter((f) => f.category === cat).length;
  }

  // Score: start at 100, deduct for issues
  let score = 100;
  score -= errorCount * 15;     // Errors are severe
  score -= warningCount * 5;    // Warnings are moderate
  score -= infoCount * 1;       // Info is minor
  score = Math.max(0, Math.min(100, score));

  // Status determination
  let status: ReadinessStatus;
  if (errorCount > 0 || score < 40) {
    status = "not_ready";
  } else if (warningCount > 3 || score < 75) {
    status = "partially_ready";
  } else {
    status = "review_ready";
  }

  // Summary
  const reasons: string[] = [];
  if (categoryCounts.missing_date > 0) reasons.push(`${categoryCounts.missing_date} record(s) missing visit dates`);
  if (categoryCounts.missing_provider > 0) reasons.push(`${categoryCounts.missing_provider} record(s) missing providers`);
  if (categoryCounts.duplicate_visit > 0) reasons.push(`${categoryCounts.duplicate_visit} possible duplicate(s)`);
  if (categoryCounts.treatment_no_bill > 0) reasons.push(`${categoryCounts.treatment_no_bill} treatment(s) without bills`);
  if (categoryCounts.chronology_gap > 0) reasons.push(`${categoryCounts.chronology_gap} treatment gap(s)`);
  if (categoryCounts.ambiguous_extraction > 0) reasons.push(`${categoryCounts.ambiguous_extraction} ambiguous extraction(s)`);
  if (categoryCounts.low_confidence > 0) reasons.push(`${categoryCounts.low_confidence} low-confidence record(s)`);

  const summary = reasons.length > 0
    ? reasons.join("; ") + "."
    : "All treatment records pass readiness checks.";

  return { status, score, flags, summary, errorCount, warningCount, infoCount, categoryCounts };
}

// ─── Helpers ────────────────────────────────────────────

const VISIT_TYPE_LABELS: Record<string, string> = {
  emergency: "Emergency", ems: "EMS", inpatient: "Inpatient", outpatient: "Outpatient",
  surgery: "Surgery", physical_therapy: "Physical Therapy", chiropractic: "Chiropractic",
  pain_management: "Pain Management", radiology: "Radiology", primary_care: "Primary Care",
  specialist: "Specialist", mental_health: "Mental Health", operative: "Operative",
  follow_up: "Follow-Up", ime: "IME", other: "Other",
};

/** Filter records that have at least one flag */
export function getRecordIdsWithFlags(flags: ReviewFlag[]): Set<string> {
  return new Set(flags.filter((f) => f.recordId).map((f) => f.recordId!));
}

/** Get flags for a specific record */
export function getFlagsForRecord(flags: ReviewFlag[], recordId: string): ReviewFlag[] {
  return flags.filter((f) => f.recordId === recordId);
}
