/**
 * PHI/PII Masking & Sanitization Utilities
 *
 * COMPLIANCE: These helpers produce display-safe variants of sensitive values.
 * They are NOT cryptographic — do not treat masked output as de-identified
 * under HIPAA Safe Harbor. They prevent casual exposure in logs, list views,
 * and admin summaries.
 *
 * See docs/compliance/data-handling-matrix.md for field-level rules.
 */

// ─── Display Masking ────────────────────────────────────

/** Mask a person's name: "Elena Martinez" → "E**** M*******" */
export function maskName(name: string | null | undefined): string {
  if (!name?.trim()) return "—";
  return name
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? part : part[0] + "*".repeat(part.length - 1)))
    .join(" ");
}

/** Mask SSN: "123-45-6789" → "***-**-6789" */
export function maskSSN(ssn: string | null | undefined): string {
  if (!ssn?.trim()) return "—";
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "***-**-" + digits.slice(-4);
}

/** Mask phone: "(555) 123-4567" → "(***) ***-4567" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return "(***) ***-" + digits.slice(-4);
}

/** Mask email: "elena@example.com" → "e****@e******.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email?.trim()) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return "****";
  const domParts = domain.split(".");
  const maskedLocal = local.length <= 1 ? local : local[0] + "*".repeat(Math.min(local.length - 1, 4));
  const maskedDomain =
    domParts[0].length <= 1
      ? domParts[0]
      : domParts[0][0] + "*".repeat(Math.min(domParts[0].length - 1, 6));
  return `${maskedLocal}@${maskedDomain}.${domParts.slice(1).join(".")}`;
}

/** Mask address to city/state only: "123 Main St, Los Angeles, CA 90001" → "***, Los Angeles, CA" */
export function maskAddress(address: string | null | undefined): string {
  if (!address?.trim()) return "—";
  // Attempt to extract city/state from common formats
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    // "street, city, state zip" → "***, city, state"
    const stateZip = parts[parts.length - 1].replace(/\d{5}(-\d{4})?/, "").trim();
    return `***, ${parts[parts.length - 2]}, ${stateZip}`;
  }
  if (parts.length === 2) {
    return `***, ${parts[1].replace(/\d{5}(-\d{4})?/, "").trim()}`;
  }
  return "***";
}

/** Mask identifier showing last 4: "POL-2024-1234" → "***-****-1234" */
export function maskIdentifier(id: string | null | undefined): string {
  if (!id?.trim()) return "—";
  if (id.length <= 4) return id;
  return "*".repeat(Math.min(id.length - 4, 8)) + id.slice(-4);
}

/** Alias for policy numbers */
export const maskPolicyNumber = maskIdentifier;

/** Alias for claim numbers */
export const maskClaimNumber = maskIdentifier;

// ─── Log Sanitization ───────────────────────────────────

/** Known PII field names that must be redacted in logs */
const PII_FIELD_PATTERNS = [
  "claimant",
  "claimant_name",
  "full_name",
  "display_name",
  "name",
  "ssn",
  "tax_id",
  "social_security",
  "dob",
  "date_of_birth",
  "phone",
  "contact_phone",
  "email",
  "contact_email",
  "address",
  "policy_number",
  "claim_number",
  "medical_record_number",
  "account_number",
  "extracted_text",
  "extracted_value",
  "fact_text",
  "source_snippet",
  "quoted_text",
] as const;

/**
 * Deep-sanitize an object for safe logging. Replaces known PII fields with "[REDACTED]".
 * Returns a new object — does not mutate the input.
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLog(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = key.toLowerCase();
    if (PII_FIELD_PATTERNS.some((pattern) => keyLower.includes(pattern))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Create a log-safe summary of a case for debugging.
 * Includes case_id and status but no PII.
 */
export function safeLogCase(caseData: {
  id?: string;
  case_number?: string;
  case_status?: string;
  tenant_id?: string;
}): string {
  return `[case:${caseData.id?.slice(0, 8) ?? "?"}|${caseData.case_status ?? "?"}|tenant:${caseData.tenant_id?.slice(0, 8) ?? "?"}]`;
}
