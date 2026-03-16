

## Plan: Demand-to-Case Intake Orchestration

### Current State Assessment

The pipeline pieces exist individually but are **not connected end-to-end**:

1. **Upload** — `useUploadDocuments` uploads files, creates `case_documents`, auto-triggers `process-document`
2. **OCR/Parse** — `process-document` extracts text, creates `document_pages` + `parsed_document_pages`, triggers `chunk-document` + `classify-document`
3. **Classification** — `classify-document` sets `document_type`, enqueues workflow jobs (e.g., `demand_extraction`)
4. **Extraction** — `extract-demand`, `extract-specials`, `extract-injuries`, `extract-treatment-timeline` exist but are **never auto-triggered** — classification enqueues jobs as "queued" but nothing fires them
5. **Entity normalization** — `normalize-entities` exists, called manually
6. **Package assembly/publish** — `publish-intake-package` exists, called manually via UI buttons
7. **Evidence linking** — `extract-demand` creates `demand_field_extractions` with page+snippet but does **not** write to `evidence_references`

**Key gaps:**
- Queued extraction jobs are never auto-invoked after classification
- No evidence_references created during extraction (only field_extractions tables)
- No orchestration to auto-run the full pipeline from upload through extraction
- demand `is_active` is set to `false` by `extract-demand`, requiring manual activation — no auto-activate for the first demand
- Case fields (claimant, claim_number, date_of_loss) are not synced back from demand extraction
- No auto-assemble of intake package after extractions complete

### Changes

#### 1. New Edge Function: `orchestrate-intake`

Server-side orchestrator that fires after classification completes. Takes `{ document_id, case_id, tenant_id }` and:

1. Reads the document's `document_type` and queued extraction jobs
2. Invokes the appropriate extraction function(s) based on type:
   - `demand_letter` → `extract-demand` → then auto-activate first demand, sync case fields (claimant, claim_number, loss_date), create evidence_references from `demand_field_extractions`
   - `medical_bill`/`itemized_statement`/`billing_record` → `extract-specials`
   - `medical_record`/`narrative_report`/`imaging_report` → `extract-treatment-timeline` + `extract-injuries`
3. After extraction succeeds, triggers `normalize-entities` for the case
4. Auto-assembles the intake package via `publish-intake-package` (action=assemble, not publish)
5. Creates evidence_references from extraction outputs with chunk_id, parse_version, and page references

#### 2. Modify `classify-document` — Auto-trigger orchestrator

After classification + workflow job enqueue (line ~336), fire `orchestrate-intake` with the document context. This connects classification → extraction automatically.

#### 3. Modify `extract-demand` — Evidence anchoring + first-demand activation

- After inserting `demand_field_extractions`, create `evidence_references` rows for each extracted field with `anchor_entity_type = 'extracted_fact'`, including `source_page`, `quoted_text`, and confidence
- Auto-activate the first demand for a case (set `is_active = true` when no other active demand exists)
- Sync extracted `claimant_name`, `claim_number`, `loss_date` back to the `cases` row

#### 4. Modify `extract-specials` — Evidence anchoring

After inserting specials records, create `evidence_references` for each line with source page, snippet, and confidence.

#### 5. Modify `extract-injuries` — Evidence anchoring

Same pattern: create `evidence_references` for each injury record.

#### 6. Modify `extract-treatment-timeline` — Evidence anchoring

Same pattern: create `evidence_references` for each treatment event.

#### 7. New Hook: `useIntakeOrchestration`

Client-side hook providing:
- `useIntakeProgress(caseId)` — polls intake_jobs to show extraction status per document type
- `useRetriggerOrchestration(documentId)` — manually retrigger the orchestration for a document
- `useAutoAssemblePackage(caseId)` — mutation to trigger package assembly when all extractions are done

#### 8. Update `IntakeWorkflowDashboard` — Orchestration status

Add a "Processing" section showing which extraction jobs are running/completed/failed per document, replacing the current generic "Processing…" text with specific step statuses.

### Files

| File | Action |
|------|--------|
| `supabase/functions/orchestrate-intake/index.ts` | Create — orchestration coordinator |
| `src/hooks/useIntakeOrchestration.ts` | Create — client hooks for orchestration status |
| `supabase/functions/classify-document/index.ts` | Modify — auto-trigger orchestrator |
| `supabase/functions/extract-demand/index.ts` | Modify — evidence anchoring, first-demand activation, case sync |
| `supabase/functions/extract-specials/index.ts` | Modify — evidence anchoring |
| `supabase/functions/extract-injuries/index.ts` | Modify — evidence anchoring |
| `supabase/functions/extract-treatment-timeline/index.ts` | Modify — evidence anchoring |
| `supabase/config.toml` | Modify — add orchestrate-intake function |
| `src/components/case/IntakeWorkflowDashboard.tsx` | Modify — show extraction step detail |

