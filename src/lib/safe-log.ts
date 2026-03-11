/**
 * Runtime-safe logging sanitization & wrapper.
 *
 * Works in: Browser, Node/Bun, Deno edge functions.
 * No Node-only APIs. No DOM dependencies.
 *
 * COMPLIANCE: UUIDs are acceptable pseudonymous identifiers in logs.
 * Raw medical text, OCR payloads, extraction payloads, treatment notes,
 * and uploaded document text MUST NOT appear in logs.
 *
 * See docs/compliance/logging-and-masking.md for policy details.
 */

// ─── PII/PHI Field Patterns ────────────────────────────
// Any object key containing one of these substrings (case-insensitive)
// will have its value replaced with "[REDACTED]".
const PII_FIELD_PATTERNS: readonly string[] = [
  // Identity
  "claimant",
  "full_name",
  "display_name",
  "name",
  "ssn",
  "tax_id",
  "social_security",
  "dob",
  "date_of_birth",
  // Contact
  "phone",
  "contact_phone",
  "email",
  "contact_email",
  "address",
  // Identifiers
  "policy_number",
  "claim_number",
  "medical_record_number",
  "account_number",
  // Content / PHI payloads
  "extracted_text",
  "extracted_value",
  "fact_text",
  "source_snippet",
  "quoted_text",
  "diagnosis_description",
  "treatment_notes",
  "description",       // medical descriptions in treatment/injury records
  "notes",             // free-text notes may contain PHI
  "content",           // generic content fields
  "body",              // request/response bodies with PHI
] as const;

// Fields that are always safe to pass through, even if they partially match
// a PII pattern (e.g. "action_type" contains "action" but not PII).
const SAFE_FIELD_ALLOWLIST: readonly string[] = [
  "action_type",
  "entity_type",
  "file_type",
  "job_type",
  "document_type",
  "artifact_type",
  "module_id",
  "status",
  "case_status",
  "pipeline_stage",
  "intake_status",
  "document_status",
  "bill_status",
  "flag_status",
  "dependency_status",
  "relevance_type",
  "source_type",
  "linked_entity_type",
  "party_role",
  "severity",
  "confidence",
  "confidence_score",
  "page_number",
  "page_count",
  "file_size_bytes",
  "retry_count",
  "max_retries",
  "version",
  "created_at",
  "updated_at",
  "completed_at",
  "started_at",
] as const;

const safeSet = new Set(SAFE_FIELD_ALLOWLIST.map((f) => f.toLowerCase()));

function isPiiField(key: string): boolean {
  const lower = key.toLowerCase();
  if (safeSet.has(lower)) return false;
  return PII_FIELD_PATTERNS.some((p) => lower.includes(p));
}

// ─── Core Sanitizer ────────────────────────────────────

/**
 * Deep-sanitize an object for safe logging.
 * - Replaces known PII/PHI fields with "[REDACTED]".
 * - Truncates long strings (> 200 chars) to prevent accidental payload dumps.
 * - Returns a new object — never mutates input.
 * - Handles strings, arrays, nested objects, nulls, undefined, primitives.
 */
export function sanitizeForLogSafe(obj: unknown, depth = 0): unknown {
  if (depth > 10) return "[MAX_DEPTH]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return obj;

  if (typeof obj === "string") {
    // Truncate very long strings that could be OCR/medical text dumps
    if (obj.length > 200) {
      return obj.substring(0, 80) + `…[truncated ${obj.length} chars]`;
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    // Cap array output to avoid dumping huge page lists
    const capped = obj.slice(0, 20);
    const result = capped.map((item) => sanitizeForLogSafe(item, depth + 1));
    if (obj.length > 20) result.push(`…[${obj.length - 20} more items]`);
    return result;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (isPiiField(key)) {
        sanitized[key] = "[REDACTED]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = sanitizeForLogSafe(value, depth + 1);
      } else if (typeof value === "string" && value.length > 200) {
        sanitized[key] = value.substring(0, 80) + `…[truncated ${value.length} chars]`;
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return String(obj);
}

// ─── Logging Wrapper ────────────────────────────────────

type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Structured, sanitized logger safe for all runtimes.
 *
 * Usage:
 *   safeLog.info("[process-document]", "Job started", { job_id, document_id });
 *   safeLog.error("[classify-document]", "AI call failed", { status: 500 });
 *
 * Never pass raw OCR payloads, medical text, or extraction results as data.
 * If you must reference such data, pass only length/count summaries.
 */
function log(level: LogLevel, prefix: string, message: string, data?: unknown) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    prefix,
    message,
    ...(data !== undefined ? { data: sanitizeForLogSafe(data) } : {}),
  };

  // Use console methods that exist in all runtimes
  switch (level) {
    case "debug":
      console.debug(JSON.stringify(entry));
      break;
    case "info":
      console.log(JSON.stringify(entry));
      break;
    case "warn":
      console.warn(JSON.stringify(entry));
      break;
    case "error":
      console.error(JSON.stringify(entry));
      break;
  }
}

export const safeLog = {
  debug: (prefix: string, message: string, data?: unknown) => log("debug", prefix, message, data),
  info: (prefix: string, message: string, data?: unknown) => log("info", prefix, message, data),
  warn: (prefix: string, message: string, data?: unknown) => log("warn", prefix, message, data),
  error: (prefix: string, message: string, data?: unknown) => log("error", prefix, message, data),
};
