# CasualtyIQ — Data Handling Matrix

> **Status**: Readiness hardening baseline. Not a certification claim.

## 1. Sensitive Field Inventory

This matrix defines how each sensitive field type may be stored, displayed, logged, and transmitted across trust zones.

### Legend

| Symbol | Meaning |
|---|---|
| ✅ Full | Full value permitted in this zone |
| 🔶 Masked | Display-safe masked variant only (e.g., `J*** D**`, `***-**-1234`) |
| 🔑 Tokenized | Surrogate identifier only; original value not present |
| 🔴 Synthetic | Fictional/generated value only; no real data |
| ❌ Prohibited | Must not appear in this zone under any circumstance |

### Field Handling Rules

| Field | Canonical Evidence Zone | Derived Working Tables | UI Display (Lists/Summaries) | Logs (Edge/Server) | Analytics / Telemetry | Non-Production (Seed/Dev) | AI Model Requests |
|---|---|---|---|---|---|---|---|
| **Claimant Full Name** | ✅ Full | ✅ Full | ✅ Full (case detail) / 🔶 Masked (admin lists) | ❌ Prohibited | 🔑 Tokenized | 🔴 Synthetic | ✅ Full (required for entity resolution) |
| **Date of Birth** | ✅ Full | 🔶 Masked (year only) | 🔶 Masked | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited (not needed for current AI tasks) |
| **SSN / Tax ID** | ✅ Full | ❌ Prohibited | 🔶 Masked (last 4 only) | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Phone Number** | ✅ Full | ✅ Full | 🔶 Masked | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Email Address** | ✅ Full | ✅ Full | 🔶 Masked | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Physical Address** | ✅ Full | ✅ Full | 🔶 Masked (city/state only) | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Policy Number** | ✅ Full | ✅ Full | 🔶 Masked (last 4) | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Claim Number** | ✅ Full | ✅ Full | ✅ Full | 🔶 Masked (last 4) | 🔑 Tokenized | 🔴 Synthetic | ✅ Full (used for case context) |
| **Medical Record Number** | ✅ Full | 🔶 Masked | 🔶 Masked | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Account / Billing Number** | ✅ Full | 🔶 Masked | 🔶 Masked | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ❌ Prohibited |
| **Provider Name** | ✅ Full | ✅ Full | ✅ Full | ✅ Full (not PII) | ✅ Full | 🔴 Synthetic | ✅ Full |
| **Facility Name** | ✅ Full | ✅ Full | ✅ Full | ✅ Full (not PII) | ✅ Full | 🔴 Synthetic | ✅ Full |
| **Extracted Medical Text** | ✅ Full | ✅ Full (evidence traceability) | ✅ Full (case detail only) | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ✅ Full (required for extraction/classification) |
| **OCR Raw Text** | ✅ Full | ✅ Full (document_pages) | ✅ Full (case detail only) | ❌ Prohibited | ❌ Prohibited | 🔴 Synthetic | ✅ Full (OCR input) |

## 2. Zone Definitions

### Canonical Evidence Zone
- **Tables**: `case_documents`, `document_pages`, `extracted_facts`, `chronology_event_candidates`, `chronology_evidence_links`
- **Storage**: `case-documents` bucket
- **Rule**: Full PHI/PII permitted. Tenant-scoped RLS enforced. No field-level encryption yet (see GAP-001).

### Derived Working Zone
- **Tables**: `entity_clusters`, `entity_cluster_members`, `document_metadata_extractions`, `document_type_suggestions`, `bills`, `treatment_records`, `injuries`, `case_parties`, `liability_facts`
- **Rule**: PHI/PII permitted where necessary for workflow. Prefer masked variants where full value adds no workflow value.

### Secondary/Non-Production Zone
- **Locations**: `src/data/mock/`, seed scripts, dev databases
- **Rule**: Only synthetic/fictional data. Never copy from production.

## 3. Application of Masking Functions

Use `src/lib/phi-utils.ts` for all masking operations:

| Function | Input | Output |
|---|---|---|
| `maskName(name)` | `"Elena Martinez"` | `"E**** M*******"` |
| `maskSSN(ssn)` | `"123-45-6789"` | `"***-**-6789"` |
| `maskPhone(phone)` | `"(555) 123-4567"` | `"(***) ***-4567"` |
| `maskEmail(email)` | `"elena@example.com"` | `"e****@e******.com"` |
| `maskAddress(address)` | `"123 Main St, LA, CA"` | `"***, LA, CA"` |
| `maskPolicyNumber(num)` | `"POL-2024-1234"` | `"***-****-1234"` |
| `maskClaimNumber(num)` | `"CLM-2024-5678"` | `"***-****-5678"` |
| `sanitizeForLog(obj)` | Any object | Object with all PII fields redacted |
