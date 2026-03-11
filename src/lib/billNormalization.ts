/**
 * ReviewerIQ — Bill Normalization Pipeline
 *
 * Converts raw extracted bill data into structured, flagged, reviewable
 * bill headers and line items. Preserves raw values alongside normalized
 * outputs for auditability.
 *
 * Supports: UB-04, CMS-1500, provider ledger, pharmacy, and unknown formats.
 */

import { v4 as uuidV4 } from "crypto";
import type {
  RawBillInput,
  RawBillLineInput,
  ReviewerBillHeader,
  ReviewerBillLine,
  BillLineFlag,
  BillHeaderFlag,
  BillExtractionConfidence,
  BillFormat,
} from "@/types/reviewer-bills";
import { lookupReferencePrice, computeVariance } from "@/lib/referencePricing";

// ─── ID Generation ──────────────────────────────────────

let headerSeq = 0;
let lineSeq = 0;

function nextHeaderId(): string {
  return `bh-gen-${++headerSeq}`;
}

function nextLineId(): string {
  return `bl-gen-${++lineSeq}`;
}

export function resetIdCounters(): void {
  headerSeq = 0;
  lineSeq = 0;
}

// ─── Date Normalization ────────────────────────────────

/**
 * Parse common US date formats into ISO YYYY-MM-DD.
 * Returns null if unparseable. Preserves raw value via caller.
 */
export function normalizeDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);

  // MM/DD/YYYY or MM-DD-YYYY
  const mdyFull = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mdyFull) {
    const [, m, d, y] = mdyFull;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // MM/DD/YY
  const mdyShort = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (mdyShort) {
    const [, m, d, y] = mdyShort;
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${fullYear}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // "Month DD, YYYY"
  const textDate = s.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})$/i,
  );
  if (textDate) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };
    const [, mon, d, y] = textDate;
    return `${y}-${months[mon.toLowerCase()]}-${d.padStart(2, "0")}`;
  }

  return null;
}

// ─── Code Normalization ─────────────────────────────────

/** Validate and normalize a CPT code (5 digits) */
export function normalizeCptCode(raw: string): { code: string | null; valid: boolean } {
  if (!raw || !raw.trim()) return { code: null, valid: false };
  const cleaned = raw.trim().replace(/[^0-9]/g, "");
  if (/^\d{5}$/.test(cleaned)) return { code: cleaned, valid: true };
  // Partial or invalid
  return { code: cleaned || null, valid: false };
}

/** Validate and normalize an HCPCS code (letter + 4 digits) */
export function normalizeHcpcsCode(raw: string): { code: string | null; valid: boolean } {
  if (!raw || !raw.trim()) return { code: null, valid: false };
  const cleaned = raw.trim().toUpperCase();
  if (/^[A-Z]\d{4}$/.test(cleaned)) return { code: cleaned, valid: true };
  return { code: cleaned || null, valid: false };
}

/** Validate ICD-10 code format */
export function normalizeIcdCode(raw: string): { code: string | null; valid: boolean } {
  if (!raw || !raw.trim()) return { code: null, valid: false };
  const cleaned = raw.trim().toUpperCase().replace(/\s/g, "");
  // ICD-10: letter + 2 digits + optional period + up to 4 chars
  if (/^[A-Z]\d{2}\.?\w{0,4}$/.test(cleaned)) {
    // Add period after 3rd char if missing
    if (cleaned.length > 3 && !cleaned.includes(".")) {
      return { code: cleaned.slice(0, 3) + "." + cleaned.slice(3), valid: true };
    }
    return { code: cleaned, valid: true };
  }
  return { code: cleaned, valid: false };
}

/** Normalize modifier codes */
export function normalizeModifiers(raw: string[]): string[] {
  return raw
    .map(m => m.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .filter(m => m.length === 2);
}

/** Normalize revenue code (4 digits) */
export function normalizeRevenueCode(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/[^0-9]/g, "");
  return /^\d{3,4}$/.test(cleaned) ? cleaned.padStart(4, "0") : null;
}

// ─── Currency Normalization ─────────────────────────────

/** Parse currency string to number. Returns null if unparseable. */
export function normalizeCurrency(raw: string): number | null {
  if (!raw || !raw.trim()) return null;
  const cleaned = raw.trim().replace(/[$,\s]/g, "");
  // Handle parentheses for negatives
  const negative = cleaned.startsWith("(") && cleaned.endsWith(")");
  const num = parseFloat(negative ? cleaned.slice(1, -1) : cleaned);
  if (isNaN(num)) return null;
  return negative ? -num : Math.round(num * 100) / 100;
}

/** Normalize units string to number */
export function normalizeUnits(raw: string): number {
  if (!raw || !raw.trim()) return 1;
  const num = parseInt(raw.trim(), 10);
  return isNaN(num) || num < 1 ? 1 : num;
}

// ─── Provider Name Normalization ────────────────────────

/**
 * Normalize provider names for matching.
 * Strips titles, degrees, normalizes spacing, lowercases.
 */
export function normalizeProviderName(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let name = raw.trim();

  // Remove common prefixes/suffixes
  const stripPatterns = [
    /^(Dr\.?\s+)/i,
    /,?\s*(MD|DO|DPM|DC|DDS|PhD|PA-C|NP|RN|PT|OT|LCSW|PsyD)\s*$/gi,
    /,?\s*(Jr\.?|Sr\.?|III?|IV)\s*$/gi,
  ];

  for (const pattern of stripPatterns) {
    name = name.replace(pattern, "");
  }

  // Normalize whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

// ─── Confidence Tier ────────────────────────────────────

export function confidenceTier(score: number | null): BillExtractionConfidence {
  if (score == null) return "unknown";
  if (score >= 0.85) return "high";
  if (score >= 0.65) return "medium";
  return "low";
}

// ─── Full Normalization Pipeline ────────────────────────

export interface NormalizationResult {
  header: ReviewerBillHeader;
  lines: ReviewerBillLine[];
}

/**
 * Normalize a raw bill input into a structured header + line items.
 * Flags issues without discarding data.
 */
export function normalizeBill(
  raw: RawBillInput,
  tenantId: string,
  caseId: string,
): NormalizationResult {
  const now = new Date().toISOString();
  const headerId = nextHeaderId();
  const headerFlags: BillHeaderFlag[] = [];

  // Normalize header-level fields
  const statementDate = normalizeDate(raw.statement_date_raw);
  const billDate = normalizeDate(raw.bill_date_raw);
  const providerNorm = normalizeProviderName(raw.provider_name_raw);
  const statementTotal = normalizeCurrency(raw.statement_total_raw);

  if (!statementDate && !billDate) {
    headerFlags.push({ type: "missing_statement_date", severity: "warning", message: "No statement or bill date found" });
  }
  if (!providerNorm) {
    headerFlags.push({ type: "provider_name_ambiguous", severity: "warning", message: `Could not normalize provider name: "${raw.provider_name_raw}"` });
  }
  if (raw.lines.length === 0) {
    headerFlags.push({ type: "no_line_items", severity: "error", message: "No line items extracted from this bill" });
  }

  // Normalize each line
  const normalizedLines: ReviewerBillLine[] = [];
  let totalBilled = 0;
  let flaggedCount = 0;

  for (const rawLine of raw.lines) {
    const line = normalizeBillLine(rawLine, headerId, tenantId, caseId, raw.provider_name_raw, raw.facility_name_raw || raw.provider_name_raw, now);
    normalizedLines.push(line);
    totalBilled += line.billed_amount;
    if (line.flags.length > 0) flaggedCount++;
  }

  // Detect duplicate lines within the same bill
  detectDuplicateLines(normalizedLines);
  flaggedCount = normalizedLines.filter(l => l.flags.length > 0).length;

  // Check statement total mismatch
  if (statementTotal != null && Math.abs(statementTotal - totalBilled) > 0.01) {
    headerFlags.push({
      type: "total_mismatch",
      severity: "warning",
      message: `Statement total $${statementTotal.toFixed(2)} differs from line-item sum $${totalBilled.toFixed(2)} (Δ $${Math.abs(statementTotal - totalBilled).toFixed(2)})`,
    });
  }

  // Compute reference totals
  const totalReference = normalizedLines.reduce((s, l) => s + (l.reference_amount ?? 0), 0);

  const header: ReviewerBillHeader = {
    id: headerId,
    tenant_id: tenantId,
    case_id: caseId,
    upstream_bill_id: null,
    bill_format: raw.bill_format_hint,
    source_document_id: raw.source_document_id,
    source_page_start: raw.source_page_start,
    source_page_end: raw.source_page_end,
    source_snippet: raw.source_snippet,
    provider_name_raw: raw.provider_name_raw,
    provider_name_normalized: providerNorm || null,
    upstream_provider_id: null,
    provider_npi: null,
    facility_name: raw.facility_name_raw || raw.provider_name_raw,
    statement_date: statementDate,
    bill_date: billDate,
    total_billed: totalBilled,
    total_reference: totalReference,
    total_accepted: 0,
    total_reduced: 0,
    total_disputed: 0,
    statement_total_printed: statementTotal,
    extraction_confidence: confidenceTier(raw.extraction_confidence_score),
    extraction_confidence_score: raw.extraction_confidence_score,
    extraction_model: raw.extraction_model,
    extraction_version: raw.extraction_version,
    extracted_at: now,
    review_state: "draft",
    reviewed_by: null,
    reviewed_at: null,
    reviewer_notes: "",
    line_count: normalizedLines.length,
    flagged_line_count: flaggedCount,
    flags: headerFlags,
    created_at: now,
    updated_at: now,
  };

  return { header, lines: normalizedLines };
}

// ─── Line-Level Normalization ───────────────────────────

function normalizeBillLine(
  raw: RawBillLineInput,
  headerId: string,
  tenantId: string,
  caseId: string,
  providerName: string,
  facilityName: string,
  now: string,
): ReviewerBillLine {
  const flags: BillLineFlag[] = [];

  // Date normalization
  const serviceDate = normalizeDate(raw.service_date_raw);
  const serviceDateEnd = normalizeDate(raw.service_date_end_raw);
  if (!serviceDate) {
    flags.push({ type: "missing_dos", severity: "error", message: `Cannot parse date of service: "${raw.service_date_raw}"` });
  }

  // Code normalization
  const cpt = normalizeCptCode(raw.cpt_code_raw);
  const hcpcs = normalizeHcpcsCode(raw.hcpcs_code_raw);
  if (!cpt.code && !hcpcs.code) {
    flags.push({ type: "missing_code", severity: "warning", message: "No CPT or HCPCS code found" });
  } else if (cpt.code && !cpt.valid) {
    flags.push({ type: "invalid_code_format", severity: "warning", message: `Invalid CPT format: "${raw.cpt_code_raw}"` });
  }

  // ICD codes
  const icdCodes = raw.icd_codes_raw
    .map(normalizeIcdCode)
    .filter(r => r.code)
    .map(r => r.code!);

  // Modifiers
  const modifiers = normalizeModifiers(raw.modifiers_raw);

  // Revenue code
  const revenueCode = normalizeRevenueCode(raw.revenue_code_raw);

  // Amount normalization
  const billedAmount = normalizeCurrency(raw.billed_amount_raw);
  if (billedAmount == null || billedAmount <= 0) {
    flags.push({ type: "missing_billed_amount", severity: "error", message: `Cannot parse billed amount: "${raw.billed_amount_raw}"` });
  }
  const finalBilled = billedAmount ?? 0;

  // Units
  const units = normalizeUnits(raw.units_raw);
  if (units > 20) {
    flags.push({ type: "excessive_units", severity: "warning", message: `High unit count: ${units}` });
  }

  // Reference pricing
  const refCode = cpt.code ?? hcpcs.code;
  const ref = refCode ? lookupReferencePrice(refCode) : null;
  const refAmt = ref ? ref.adjusted_amount * units : null;
  const variance = refAmt ? computeVariance(finalBilled, refAmt) : null;

  // High variance flag
  if (variance && variance.variance_pct > 200) {
    flags.push({ type: "high_variance", severity: "warning", message: `Billed ${variance.variance_pct}% of reference ($${finalBilled} vs $${refAmt})` });
  }

  // Confidence
  const confidence = confidenceTier(raw.extraction_confidence_score);

  return {
    id: nextLineId(),
    tenant_id: tenantId,
    case_id: caseId,
    bill_header_id: headerId,
    service_date: serviceDate,
    service_date_end: serviceDateEnd,
    service_date_raw: raw.service_date_raw,
    cpt_code: cpt.code,
    cpt_code_raw: raw.cpt_code_raw,
    hcpcs_code: hcpcs.code,
    icd_codes: icdCodes,
    modifiers,
    revenue_code: revenueCode,
    units,
    billed_amount: finalBilled,
    billed_amount_raw: raw.billed_amount_raw,
    reference_amount: refAmt,
    reference_basis: ref?.basis ?? "No reference available",
    variance_amount: variance?.variance_amount ?? null,
    variance_pct: variance?.variance_pct ?? null,
    description: raw.description_raw.trim(),
    description_raw: raw.description_raw,
    upstream_treatment_id: raw.upstream_treatment_id,
    treatment_review_id: null,
    upstream_provider_id: null,
    provider_name: providerName,
    facility_name: facilityName,
    source_page: raw.source_page,
    source_snippet: raw.source_snippet,
    extraction_confidence: confidence,
    extraction_confidence_score: raw.extraction_confidence_score,
    disposition: "pending",
    accepted_amount: null,
    reduction_reason: "",
    reviewer_notes: "",
    reviewed_by: null,
    reviewed_at: null,
    flags,
    created_at: now,
    updated_at: now,
  };
}

// ─── Duplicate Detection ────────────────────────────────

function detectDuplicateLines(lines: ReviewerBillLine[]): void {
  const seen = new Map<string, ReviewerBillLine>();

  for (const line of lines) {
    if (!line.service_date || !line.cpt_code) continue;
    const key = `${line.service_date}|${line.cpt_code}|${line.units}|${line.billed_amount}`;
    const existing = seen.get(key);
    if (existing) {
      line.flags.push({
        type: "duplicate_line",
        severity: "warning",
        message: `Possible duplicate: same date, code, units, and amount as line ${existing.id}`,
      });
    } else {
      seen.set(key, line);
    }
  }
}

// ─── Treatment Linkage ──────────────────────────────────

import type { ReviewerTreatmentRecord } from "@/hooks/useReviewerTreatments";

/**
 * Attempt to auto-link bill lines to treatment records by matching
 * service dates and provider names. Does not overwrite existing links.
 */
export function linkBillLinesToTreatments(
  lines: ReviewerBillLine[],
  treatments: ReviewerTreatmentRecord[],
): { linked: number; unlinked: number } {
  let linked = 0;
  let unlinked = 0;

  for (const line of lines) {
    // Skip if already linked
    if (line.upstream_treatment_id) { linked++; continue; }

    // Match by date + provider
    const match = treatments.find(t => {
      if (!t.visit_date || !line.service_date) return false;
      if (t.visit_date !== line.service_date) return false;

      // Provider name fuzzy match
      const tName = (t.provider_name_normalized || t.provider_name_raw).toLowerCase();
      const lName = line.provider_name.toLowerCase();
      return tName.includes(lName) || lName.includes(tName) ||
        normalizeProviderName(t.provider_name_raw).toLowerCase() === normalizeProviderName(line.provider_name).toLowerCase();
    });

    if (match) {
      line.upstream_treatment_id = match.id;
      linked++;
    } else {
      // Flag unlinked lines (not pharmacy/misc)
      if (line.cpt_code) {
        const alreadyFlagged = line.flags.some(f => f.type === "no_linked_treatment");
        if (!alreadyFlagged) {
          line.flags.push({
            type: "no_linked_treatment",
            severity: "info",
            message: "No matching treatment record found for this bill line",
          });
        }
      }
      unlinked++;
    }
  }

  return { linked, unlinked };
}

/**
 * Check for provider name mismatches between bill lines and linked treatments.
 */
export function detectProviderMismatches(
  lines: ReviewerBillLine[],
  treatments: ReviewerTreatmentRecord[],
): void {
  const treatmentMap = new Map(treatments.map(t => [t.id, t]));

  for (const line of lines) {
    if (!line.upstream_treatment_id) continue;
    const treatment = treatmentMap.get(line.upstream_treatment_id);
    if (!treatment) continue;

    const billProvider = normalizeProviderName(line.provider_name).toLowerCase();
    const treatProvider = normalizeProviderName(treatment.provider_name_raw).toLowerCase();

    if (billProvider && treatProvider && billProvider !== treatProvider &&
        !billProvider.includes(treatProvider) && !treatProvider.includes(billProvider)) {
      line.flags.push({
        type: "provider_mismatch",
        severity: "warning",
        message: `Bill provider "${line.provider_name}" differs from treatment provider "${treatment.provider_name_raw}"`,
      });
    }
  }
}
