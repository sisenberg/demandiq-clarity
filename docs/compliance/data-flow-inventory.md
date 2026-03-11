# CasualtyIQ — Data Flow Inventory

> **Status**: Readiness hardening baseline.

## 1. Inbound Data Flows

| Flow | Source | Destination | Data Classes | Trigger |
|---|---|---|---|---|
| User signup | Browser form | `auth.users`, `profiles`, `user_roles` | L3 (email) | User action |
| Document upload | Browser file input | `case-documents` bucket + `case_documents` row | L4 (raw medical records) | User action |
| Case creation | Browser form | `cases` table | L3 (claimant/defendant names) | User action |
| Party creation | Browser form | `case_parties` table | L3 (names, contact info) | User action |

## 2. Internal Processing Flows

| Flow | Source | Destination | Data Classes | Trigger |
|---|---|---|---|---|
| OCR text extraction | `case-documents` bucket | `document_pages`, `case_documents.extracted_text` | L4 (medical text) | `process-document` edge fn |
| Document classification | `case_documents.extracted_text` | `document_type_suggestions`, `document_metadata_extractions` | L3–L4 | `classify-document` edge fn |
| Entity normalization | `document_metadata_extractions` | `entity_clusters`, `entity_cluster_members` | L3 (names) | `normalize-entities` edge fn |
| Chronology generation | Extracted text + metadata | `chronology_event_candidates`, `chronology_evidence_links` | L4 (medical events) | `generate-chronology` edge fn |
| Audit logging | User actions | `audit_events` | L2 (may contain PII in before/after) | Application code |

## 3. External Outbound Flows (Subprocessor)

| Flow | Destination | Data Sent | Data Classes | Protocol |
|---|---|---|---|---|
| OCR via AI | `ai.gateway.lovable.dev` → Google Gemini | Base64 document images/PDFs | L4 | HTTPS/TLS |
| Classification via AI | `ai.gateway.lovable.dev` → Google Gemini | Document text snippets (first ~4000 chars) | L3–L4 | HTTPS/TLS |
| Entity clustering via AI | `ai.gateway.lovable.dev` → Google Gemini | Extracted field values (names, numbers) | L3 | HTTPS/TLS |
| Chronology via AI | `ai.gateway.lovable.dev` → Google Gemini | Page text content | L4 | HTTPS/TLS |

## 4. Client-Side Data Presence

| Data | Present in Browser? | Persistence | Notes |
|---|---|---|---|
| Auth session token | Yes | Cookie/memory | Supabase-managed |
| Case list metadata | Yes | React state (session) | Names visible in UI |
| Document extracted text | Yes | React state (session) | PHI visible in review workspace |
| Signed storage URLs | Yes | React state (session, 600s TTL) | Auto-refreshed |
| Audit log entries | Yes | React state (session) | Visible to tenant users |
| User profile | Yes | React context (session) | Email, display name |

No PHI/PII is stored in `localStorage` or `sessionStorage`.

## 5. Log Data Flows

| Log Source | What May Be Logged | Risk Level |
|---|---|---|
| Edge function `console.log` | Document IDs, case IDs, error messages | ⚠️ L1–L2 (IDs are pseudonymous) |
| Edge function `console.error` | Error stack traces, partial error messages from AI | ⚠️ L2 (may contain file names) |
| Supabase platform logs | Query patterns, auth events | L1 |
| Browser console | React errors, query keys | L1 (no PHI in query keys) |

### ⚠️ Flagged Log Paths

The following edge function lines log content that could include sensitive references:

- `process-document/index.ts:425` — logs document ID (acceptable, pseudonymous)
- `process-document/index.ts:449` — logs classification result JSON (⚠️ may contain extracted type/snippet)
- `classify-document/index.ts:45` — logs invocation (acceptable)
- `generate-chronology/index.ts:20,38` — logs invocation + case_id (acceptable)

**Recommendation**: Ensure `console.log` of AI response payloads does not include full extracted text or PII fields. Log only summary metrics (counts, statuses).
