# Logging & Masking Policy

> **Status**: Active — SC-7 hardening  
> **Last updated**: 2026-03-11  
> **Applies to**: Browser client, Edge Functions, any future server-side code

---

## 1. Logging Principles

| Principle | Rule |
|-----------|------|
| **UUIDs are OK** | UUIDs (`id`, `tenant_id`, `case_id`, `document_id`, `job_id`) are pseudonymous identifiers and MAY appear in logs. |
| **No raw PHI/PII** | Claimant names, SSNs, phone numbers, email addresses, DOBs, addresses, policy numbers, claim numbers, and medical record numbers MUST NOT appear in structured or unstructured log output. |
| **No payload dumps** | OCR text, extracted treatment notes, medical bill descriptions, diagnosis descriptions, source snippets, and uploaded document text MUST NOT appear in logs. Log only character counts or page counts when referencing content volume. |
| **Structured logging** | Prefer `safeLog.*()` wrapper or `sanitizeForLogSafe()` over raw `console.log()` for any object containing database rows or API responses. |
| **Truncation** | Strings > 200 characters are automatically truncated by the sanitizer to prevent accidental content leaks. |

## 2. Utilities

### `sanitizeForLogSafe(obj)` — `src/lib/safe-log.ts`

Runtime-safe deep sanitizer. Works in browser, Node/Bun, and Deno edge functions.

- Replaces known PII/PHI field values with `[REDACTED]`
- Truncates long strings
- Caps arrays at 20 items
- Handles nested objects to depth 10
- Never mutates input

### `safeLog.info(prefix, message, data?)` — `src/lib/safe-log.ts`

Structured logging wrapper with levels: `debug`, `info`, `warn`, `error`.

All data passed through `sanitizeForLogSafe()` automatically.

```typescript
import { safeLog } from "@/lib/safe-log";
safeLog.info("[process-document]", "Job started", { job_id, document_id });
```

### `maskName()`, `maskSSN()`, `maskPhone()`, `maskEmail()` etc. — `src/lib/phi-utils.ts`

Display-level masking for UI list views. NOT cryptographic de-identification.

## 3. PII Field Detection

The sanitizer treats any object key containing these substrings (case-insensitive) as PII:

- Identity: `claimant`, `full_name`, `display_name`, `name`, `ssn`, `tax_id`, `dob`, `date_of_birth`
- Contact: `phone`, `email`, `address`
- Identifiers: `policy_number`, `claim_number`, `medical_record_number`, `account_number`
- Content: `extracted_text`, `extracted_value`, `fact_text`, `source_snippet`, `quoted_text`, `diagnosis_description`, `treatment_notes`, `notes`, `description`, `content`, `body`

### Safe-listed fields (pass through even if partially matching):

`action_type`, `entity_type`, `file_type`, `job_type`, `document_type`, `status`, `case_status`, `pipeline_stage`, `severity`, `confidence`, `page_number`, `page_count`, etc.

## 4. UI Masking Policy

Compact list views (case lists, document lists, activity timelines, search results) display masked PII:

| Field | Masking | Example |
|-------|---------|---------|
| Claimant name | `maskName()` | `E**** M*******` |
| Claim number | `maskClaimNumber()` | `****-1234` |
| Phone | `maskPhone()` | `(***) ***-4567` |
| Email | `maskEmail()` | `e****@e******.com` |
| SSN | `maskSSN()` | `***-**-6789` |

**Full values** remain accessible in intentional detail views where claim handlers need them for case work.

## 5. Edge Function Logging

Edge functions MUST NOT:
- Log `extracted_text`, AI prompt content, or AI response payloads
- Log `file_name` (may contain claimant PII)
- Log full database row objects without sanitization

Edge functions MAY log:
- UUIDs (document_id, case_id, job_id, tenant_id truncated to 8 chars)
- Counts (pages extracted, characters processed, suggestions generated)
- Status codes and error messages (without PII context)
- Timing/performance data

## 6. Enforcement

- **Automated**: `sanitizeForLogSafe()` enforces field-level redaction
- **Code review**: PR checklist item in `docs/compliance/change-management-notes.md`
- **Not yet automated**: No linter rule preventing raw `console.log(dbRow)` — future improvement
