# CasualtyIQ — Data Classification Policy

> **Status**: Readiness hardening baseline. Not a formal policy adoption — a working reference for developers and future compliance work.

## 1. Classification Levels

| Level | Label | Description | Examples |
|---|---|---|---|
| **L0** | `public` | Non-sensitive, safe for public exposure | App version, feature flags, UI labels, module IDs |
| **L1** | `internal` | Business data, not personally identifiable | Case status, job types, pipeline stages, module dependency graph |
| **L2** | `confidential` | Business-sensitive, tenant-scoped | Case numbers, document counts, billing totals, audit events |
| **L3** | `restricted_pii` | Personally Identifiable Information | Claimant names, attorney names, email, phone, address |
| **L4** | `restricted_phi` | Protected Health Information (HIPAA-relevant) | Medical records text, diagnosis codes, treatment descriptions, injury details, provider notes, OCR-extracted medical content |

## 2. Handling Rules by Level

| Rule | L0 public | L1 internal | L2 confidential | L3 restricted_pii | L4 restricted_phi |
|---|---|---|---|---|---|
| May appear in client state | ✅ | ✅ | ✅ (tenant-scoped) | ✅ (tenant-scoped, session only) | ✅ (tenant-scoped, session only) |
| May appear in server logs | ✅ | ✅ | ⚠️ IDs only | ❌ Values prohibited | ❌ Values prohibited |
| May be sent to AI gateway | ✅ | ✅ | ✅ | ⚠️ Required for function | ⚠️ Required for function |
| May appear in error messages | ✅ | ✅ | ⚠️ Redact where possible | ❌ | ❌ |
| May appear in seed/demo data | ✅ | ✅ | ✅ (synthetic only) | ❌ Must be synthetic | ❌ Must be synthetic |
| May leave primary trust boundary | ✅ | ✅ | ⚠️ Encrypted transit | ⚠️ AI processing only | ⚠️ AI processing only |
| Requires tenant isolation | N/A | ✅ | ✅ | ✅ | ✅ |
| Requires audit trail on mutation | N/A | N/A | ⚠️ Recommended | ✅ | ✅ |

## 3. Classification by Table

See [data-flow-inventory.md](./data-flow-inventory.md) for the complete table-level mapping.

### Summary

| Table | Highest Data Class |
|---|---|
| `cases` | L3 — restricted_pii (claimant, defendant, insured names) |
| `case_documents` | L4 — restricted_phi (extracted_text contains medical content) |
| `document_pages` | L4 — restricted_phi (page-level OCR text) |
| `document_metadata_extractions` | L3 — restricted_pii (names, phones, emails, addresses) |
| `document_type_suggestions` | L2 — confidential (source snippets may contain PII) |
| `extracted_facts` | L4 — restricted_phi (medical facts, diagnoses, treatments) |
| `fact_evidence_links` | L1 — internal (link metadata only) |
| `entity_clusters` | L3 — restricted_pii (normalized names) |
| `entity_cluster_members` | L3 — restricted_pii (raw name variants, source snippets) |
| `chronology_event_candidates` | L4 — restricted_phi (medical event descriptions) |
| `chronology_evidence_links` | L3 — restricted_pii (quoted text snippets) |
| `injuries` | L4 — restricted_phi (diagnosis codes, body parts, severity) |
| `treatment_records` | L4 — restricted_phi (treatment details, provider info) |
| `bills` | L2 — confidential (financial amounts) |
| `liability_facts` | L3 — restricted_pii (fact text may reference individuals) |
| `insurance_policies` | L2 — confidential (policy numbers, coverage limits) |
| `case_parties` | L3 — restricted_pii (names, contact info) |
| `profiles` | L3 — restricted_pii (email, display name) |
| `audit_events` | L2 — confidential (before/after values may contain PII) |
| `tenants` | L1 — internal |
| `user_roles` | L1 — internal |
| `module_*` tables | L1 — internal |
| `jobs` / `intake_jobs` | L1 — internal (error messages may contain file names) |

### Storage Buckets

| Bucket | Highest Data Class |
|---|---|
| `case-documents` | L4 — restricted_phi (raw uploaded medical records, PDFs, images) |
| `derived-artifacts` | L4 — restricted_phi (generated demand letters contain PHI) |

## 4. AI Gateway Data Flows

When edge functions call `ai.gateway.lovable.dev`:

- **OCR (process-document)**: Sends base64-encoded document images/PDFs. **Contains L4 PHI.**
- **Classification (classify-document)**: Sends extracted text snippets. **Contains L3–L4 PII/PHI.**
- **Entity normalization (normalize-entities)**: Sends extracted name/field values. **Contains L3 PII.**
- **Chronology generation (generate-chronology)**: Sends extracted text + metadata. **Contains L4 PHI.**

These are identified as subprocessor data flows. See [subprocessor-boundaries.md](./subprocessor-boundaries.md).
