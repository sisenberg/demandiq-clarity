# ReviewerIQ Read Contract — Developer Guide

**Contract version:** 1.0.0  
**Module ID:** `revieweriq`  
**Upstream dependency:** `demandiq` (completed snapshot)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    DemandIQ (upstream)                          │
│  case_record, parties, injuries, providers, treatments,        │
│  billing_lines, documents, evidence_refs, chronology,          │
│  liability_facts, issue_flags, demand_summary                  │
│                                                                │
│  ──── Completed snapshot (versioned, immutable) ────           │
└──────────────────────────┬──────────────────────────────────────┘
                           │ READ-ONLY
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ReviewerIQ (downstream)                      │
│                                                                │
│  INPUT:  ReviewerIQInputContract  (read-only upstream data)    │
│  OUTPUT: Module-owned tables (treatment reviews, provider      │
│          reviews, bill links, medical flags, case state)       │
│                                                                │
│  Hook:   useReviewerIQInput(caseId) → contract                │
│  Types:  src/types/revieweriq.ts                               │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Input Contract Shape

The `ReviewerIQInputContract` interface (defined in `src/types/revieweriq.ts`) contains:

| Field | Type | Source |
|---|---|---|
| `contract_version` | string | Hardcoded `"1.0.0"` |
| `upstream_snapshot` | object \| undefined | From `module_completion_snapshots` |
| `case_record` | Case | `cases` table |
| `parties` | Party[] | `case_parties` table |
| `documents` | ReviewerDocumentRef[] | `case_documents` (slim, no raw text) |
| `source_pages` | SourcePage[] | `document_pages` |
| `injuries` | Injury[] | `injuries` table |
| `providers` | Provider[] | Derived from `case_parties` + provider data |
| `treatments` | TreatmentRecord[] | `treatment_records` (platform-wide) |
| `billing_lines` | BillingLine[] | `bills` table |
| `insurance_policies` | InsurancePolicy[] | `insurance_policies` table |
| `liability_facts` | LiabilityFact[] | `liability_facts` table |
| `timeline_events` | TimelineEvent[] | `chronology_event_candidates` |
| `evidence_refs` | EvidenceReference[] | `chronology_evidence_links` + mock |
| `issue_flags` | IssueFlag[] | DemandIQ-generated flags |
| `demand_summary` | DemandSummary | DemandIQ completion output |

### Key invariant

**ReviewerIQ never writes to upstream tables.** All derived analysis, corrections, and flags are stored in ReviewerIQ-owned tables (prefixed `reviewer_*`).

## 3. Module-Owned Tables

| Table | Purpose | Key columns |
|---|---|---|
| `reviewer_case_state` | Per-case review lifecycle | `review_status`, upstream snapshot ref, summary counters |
| `reviewer_treatment_reviews` | Treatment reasonableness assessment | `upstream_treatment_id`, `ai_decision`, `accepted_decision`, guideline refs |
| `reviewer_provider_reviews` | Provider normalization tracking | `upstream_provider_id`, `normalization_status`, canonical values |
| `reviewer_bill_links` | Bill-to-treatment linkage | `upstream_bill_id`, `upstream_treatment_id`, `linkage_status` |
| `reviewer_medical_flags` | Medical review flags | `category`, `severity`, `status`, evidence traceability |

All tables:
- Have RLS enabled (tenant-scoped)
- Include `source_document_id`, `source_page`, `source_snippet` for evidence traceability
- Use `updated_at` triggers
- Store `upstream_*_id` foreign references (not foreign keys to prevent cross-module coupling)

## 4. Evidence Traceability

Every ReviewerIQ output record preserves a link to its source:

```
ReviewerIQ record
  ├── upstream_treatment_id → Treatment record from DemandIQ
  │     └── evidence_refs[] → EvidenceReference[]
  │           ├── source_document_id
  │           ├── source_page
  │           └── quoted_text
  ├── source_document_id (direct document reference)
  ├── source_page (page number)
  └── source_snippet (quoted text from source)
```

## 5. Hook Usage

```tsx
import { useReviewerIQInput } from "@/hooks/useReviewerIQContract";

function ReviewerWorkspace({ caseId }: { caseId: string }) {
  const { contract, isLoading, isFromSnapshot, snapshotVersion } =
    useReviewerIQInput(caseId);

  if (isLoading || !contract) return <Loading />;

  // Access upstream data (read-only)
  const { treatments, injuries, providers, billing_lines } = contract;

  // Build review workspace from contract...
}
```

### Utility functions

- `groupEvidenceByTreatment(contract)` — Map of treatment_id → evidence refs
- `groupEvidenceByProvider(contract)` — Map of provider_id → evidence refs
- `buildDocumentLookup(contract)` — Map of document_id → document ref

## 6. Versioning

The contract uses semantic versioning:

- **Patch** (1.0.x): New optional fields added to existing interfaces
- **Minor** (1.x.0): New top-level sections added to the contract
- **Major** (x.0.0): Breaking changes to existing field types or removals

Downstream consumers should check `contract.contract_version` and handle unknown fields gracefully.

## 7. Data Flow Rules

1. ReviewerIQ initializes from `useReviewerIQInput(caseId)` — never from raw PDFs
2. Treatment reviews reference upstream treatments by ID, snapshot key fields locally
3. Provider reviews link to entity clusters for cross-document normalization
4. Bill links connect upstream bills to treatment reviews for cost analysis
5. Medical flags reference source documents for auditability
6. When the upstream DemandIQ module is reopened and re-completed, ReviewerIQ detects staleness via `module_dependency_state` and prompts for refresh

## 8. Security

- All tables use tenant-scoped RLS (`tenant_id = get_user_tenant_id(auth.uid())`)
- No DELETE policies — review records are preserved for audit
- PHI fields (treatment descriptions, medical notes) follow the platform masking policy
- Audit events track all review decisions via `useAuditLog`
