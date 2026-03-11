# CasualtyIQ — Subprocessor & Trust Boundaries

> **Status**: Readiness hardening baseline.

## 1. Subprocessor Inventory

| Subprocessor | Service | Data Received | Data Classes | BAA Status |
|---|---|---|---|---|
| **Lovable Cloud** | Hosting, database, storage, auth, edge functions | All platform data | L0–L4 | ⚠️ TBD — required for HIPAA |
| **Lovable AI Gateway** | AI inference proxy | Document text, images, extracted fields | L3–L4 | ⚠️ TBD — required for HIPAA |
| **Google (Gemini)** | AI model inference (via gateway) | Document text, images, extracted fields | L3–L4 | ⚠️ TBD — required for HIPAA |

## 2. Trust Zones

### Zone 1 — Primary Evidence Zone (Highest Sensitivity)

Contains raw source material and first-pass extractions.

| Asset | Location |
|---|---|
| Uploaded documents (PDFs, images) | `case-documents` storage bucket |
| OCR-extracted text | `case_documents.extracted_text`, `document_pages.extracted_text` |
| Raw metadata extractions | `document_metadata_extractions` |
| Extracted facts | `extracted_facts` |

**Rules**:
- Data must remain within Lovable Cloud primary boundary.
- External transmission only to AI gateway for processing (required for function).
- No export to non-production environments with real data.
- Tenant isolation enforced by RLS.

### Zone 2 — Derived Working Data Zone

Contains AI-generated structured data derived from Zone 1.

| Asset | Location |
|---|---|
| Document type suggestions | `document_type_suggestions` |
| Entity clusters | `entity_clusters`, `entity_cluster_members` |
| Chronology candidates | `chronology_event_candidates` |
| Evidence links | `chronology_evidence_links`, `fact_evidence_links` |
| Generated artifacts | `generated_artifacts`, `derived-artifacts` bucket |

**Rules**:
- Still tenant-scoped and RLS-protected.
- May contain PII/PHI in derived form (names, medical event descriptions).
- Same handling rules as Zone 1 for PHI content.

### Zone 3 — Platform Configuration Zone

Contains system configuration and non-sensitive operational data.

| Asset | Location |
|---|---|
| Tenant records | `tenants` |
| Module entitlements | `tenant_module_entitlements` |
| Module dependencies | `module_dependencies` |
| Job execution metadata | `intake_jobs`, `jobs` (status, timing, counts) |

**Rules**:
- L1 internal data.
- Error messages in job tables should not contain PHI (⚠️ gap: error messages may contain document-related details).

### Zone 4 — Non-Production / Development

| Asset | Location |
|---|---|
| Mock/seed data | `src/data/mock/*` |
| Test fixtures | `src/test/*` |

**Rules**:
- **MUST NOT** contain production PII/PHI.
- All names, dates, and medical details in seed data must be synthetic/fictional.
- See guardrail in `src/lib/compliance.ts`.

## 3. Data Flow Across Boundaries

```
  Zone 4 (Dev/Seed)          Zone 3 (Config)
  ──────────────────         ──────────────────
  NO real PII/PHI            Job status, module config
        ╳ (prohibited)              │
        │                           │
  Zone 1 (Primary Evidence)  ◄──────┘
  ──────────────────────────
  Raw docs, OCR text, extractions
        │
        │  AI processing (HTTPS)
        ▼
  ┌─────────────────────────┐
  │ EXTERNAL: AI Gateway    │  Zone boundary crossing
  │ (subprocessor)          │
  └─────────────────────────┘
        │
        ▼
  Zone 2 (Derived Working Data)
  ──────────────────────────
  Classifications, entities, chronology
```
