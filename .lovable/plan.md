

## Plan: Formal DemandPackage Contract & Downstream Launch Rules

### Problem
There is no formal `DemandPackageV1` type contract. The existing `intake_evaluation_packages` table and `publish-intake-package` edge function act as a de facto demand package, but the concept is implicit — there's no typed contract, no formal version referencing from downstream modules, and the eligibility check in `useEvaluateEligibility` gates on `module_completions` status rather than the existence of a published DemandPackage.

### What Exists Today
- **`intake_evaluation_packages` table** — stores assembled intake data (demand, specials, treatments, injuries, providers, flags) with status (`draft`, `ready_for_review`, `published_to_evaluateiq`) and versioning
- **`publish-intake-package` edge function** — assembles data from extraction tables into `intake_evaluation_packages`
- **`useEvaluateEligibility`** — gates on `module_completions.status === "completed"` for demandiq, not on DemandPackage existence
- **`DemandIQOutput`** in `src/types/index.ts` — unstructured string arrays, no evidence links or processing references

### Design: DemandPackage = Formalized Intake Evaluation Package

The `intake_evaluation_packages` table already contains the right data. We formalize it with a typed contract and wire downstream launch rules to require a published package.

---

### 1. New Type File: `src/types/demand-package-v1.ts`

Defines the typed DemandPackage contract:

```text
DemandPackageV1
├── contract_version: "1.0.0"
├── package_id, case_id, tenant_id
├── package_version (integer)
├── package_status: draft | ready_for_review | published
├── processing_run_id (nullable, links to intake job)
│
├── case_header
│   ├── claimant_name, date_of_loss, claim_number
│   ├── represented_status, attorney_name, law_firm
│   └── demand_amount, demand_deadline, demand_date
│
├── source_document_registry[]
│   ├── document_id, filename, document_type
│   ├── page_count, ocr_status, classification
│   └── processing_stage
│
├── extraction_summary
│   ├── total_documents, total_pages_processed
│   ├── total_extracted_facts, extraction_confidence_avg
│   └── extraction_completed_at
│
├── evidence_linked_fields[]
│   ├── field_name, extracted_value, confidence
│   ├── source_document_id, source_page, source_snippet
│   └── evidence_reference_id
│
├── chronology_seeds[]
│   ├── event_date, event_type, description
│   └── source_document_id, source_page
│
├── damages_seeds
│   ├── specials_summary (total_billed, bill_count, provider_count)
│   ├── injury_summary[] (body_part, severity, diagnosis)
│   ├── treatment_summary (total_events, duration_days, first/last date)
│   └── provider_list[]
│
├── clinical_indicators
│   ├── objective_support_flags[]
│   ├── invasive_treatment_flags[]
│   ├── residual_symptom_flags[]
│   └── functional_impact_flags[]
│
├── review_needed_flags[]
│   ├── field, message, severity (blocker | warning)
│   └── is_blocker
│
├── completeness
│   ├── quality_score (0-100)
│   ├── verified_sections (demand, specials, injuries, treatments)
│   └── missing_data_flags[]
│
└── metadata
    ├── assembled_at, assembled_by
    ├── published_at, published_by
    └── engine_version
```

Also exports:
- `validateDemandPackage(pkg): DemandPackageValidation` — checks required fields, blocker flags
- `isDemandPackagePublished(pkg): boolean`

### 2. New Hook: `src/hooks/useDemandPackage.ts`

- `useDemandPackage(caseId)` — fetches latest `intake_evaluation_packages` row and maps it to `DemandPackageV1`
- `useDemandPackagePublished(caseId)` — returns only if status is `published_to_evaluateiq`, with `package_version`
- `useDemandPackageLaunchEligibility(caseId)` — returns `{ eligible, package_version, blockers[] }` for downstream modules

### 3. Update `useEvaluateEligibility` 

Replace the current `module_completions`-based check with DemandPackage-based gating:

```typescript
// Current: gates on module_completions status
if (demandCompletion?.status === ModuleCompletionStatus.Completed) { ... }

// New: gates on published DemandPackage existence
const { data: demandPkg } = useDemandPackagePublished(caseId);
if (demandPkg) {
  return { eligible: true, inputSource: "demandiq", 
           sourceVersion: demandPkg.package_version, ... };
}
```

ReviewerIQ remains optional enrichment — if ReviewerIQ is completed, it's preferred but not required.

### 4. Update `useStartEvaluate` (in `useEvaluateState.ts`)

Add a pre-flight check: before creating the evaluation case, verify a published DemandPackage exists. Store `source_demand_package_version` in the `evaluation_cases` record so downstream always knows which package version launched it.

### 5. Schema Migration

Add column to `evaluation_cases` to track the source package:

```sql
ALTER TABLE public.evaluation_cases
  ADD COLUMN IF NOT EXISTS source_demand_package_id uuid 
    REFERENCES public.intake_evaluation_packages(id),
  ADD COLUMN IF NOT EXISTS source_demand_package_version integer;
```

### 6. Update `EvaluateInlineWorkspace` UI

Show DemandPackage eligibility status:
- If no published DemandPackage: show blocker with "Publish DemandPackage first" message
- If published: show package version badge and "Ready to evaluate" state
- The existing `eligibility.blockerReason` string handles this naturally

### 7. Update `publish-intake-package` Edge Function

When `action === "publish"`:
- Also upsert a `module_completions` record for `demandiq` with status `completed` (if not already)
- This ensures the module completion lifecycle stays in sync with the package publication

### Files Created/Modified

| File | Action |
|------|--------|
| `src/types/demand-package-v1.ts` | **Create** — typed contract, validator, helpers |
| `src/hooks/useDemandPackage.ts` | **Create** — fetch, map, eligibility hooks |
| `src/hooks/useEvaluateEligibility.ts` | **Modify** — gate on published DemandPackage |
| `src/hooks/useEvaluateState.ts` | **Modify** — store source package version |
| `src/components/case/EvaluateInlineWorkspace.tsx` | **Modify** — show package version in UI |
| `supabase/migrations/` | **Create** — add source_demand_package columns to evaluation_cases |
| `supabase/functions/publish-intake-package/index.ts` | **Modify** — sync module_completions on publish |

No changes to existing table structures — the `intake_evaluation_packages` table already has all the data fields. The typed contract is a client-side formalization of what's already stored.

