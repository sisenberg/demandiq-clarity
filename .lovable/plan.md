

## Plan: Retrieval Foundation & Claim-Aware Chunk Labeling

### Current State

`document_chunks` stores chunked text with `chunk_type`, `chunk_index`, page ranges, and `extraction_pass` — but has no labeling, no search service, no retrieval logging. Chunks are fetched by document or case ID only, with no text search or metadata filtering.

### Design

```text
document_chunks (existing)
  └── chunk_labels (NEW join table)
        ├── chunk_id → document_chunks
        ├── label (enum: liability, treatment_chronology, specials_billing, ...)
        ├── confidence, source (heuristic|ai|manual)
        └── tenant_id, case_id

retrieval_events (NEW audit table)
        ├── query, mode (lexical|semantic|metadata), filters
        ├── result_chunk_ids[], result_count
        ├── triggered_by (user|system), module
        └── latency_ms, tenant_id, case_id
```

### Changes

#### 1. Schema Migration

**New table: `chunk_labels`**
- `id`, `tenant_id`, `case_id`, `chunk_id` (FK → document_chunks), `document_id`
- `label text NOT NULL` — one of the 10 claim-aware labels
- `confidence numeric` — 0–1 score from heuristic/AI
- `source text` — `heuristic`, `ai`, `manual`
- `created_at`
- Unique on `(chunk_id, label)` to prevent duplicates
- Indexes on `(case_id, label)` and `(chunk_id)`

**New table: `retrieval_events`**
- `id`, `tenant_id`, `case_id`
- `query_text text`, `retrieval_mode text` (lexical/semantic/metadata)
- `filters jsonb` — labels, document IDs, page ranges used
- `result_chunk_ids uuid[]`, `result_count integer`
- `triggered_by text`, `module text`
- `latency_ms integer`
- `created_at`
- Append-only, tenant-scoped RLS

#### 2. Types: `src/types/chunk-retrieval.ts`

- `ChunkLabel` — the 10 claim-aware label values as a union type
- `CHUNK_LABELS` — ordered array with display names
- `ChunkLabelRow` — DB row interface
- `RetrievalMode` — `lexical | semantic | metadata`
- `RetrievalQuery` — params interface (query, labels, documentIds, pageRange, limit)
- `RetrievalResult` — chunk + labels + score
- `RetrievalEventRow` — audit log row

#### 3. Label Heuristics: `src/lib/chunkLabelEngine.ts`

First-pass keyword/pattern heuristics to auto-label chunks:
- `liability` — negligence, fault, liability, comparative, proximate cause
- `treatment_chronology` — visit, treatment, therapy, diagnosis, MRI, surgery
- `specials_billing` — CPT, billed, charges, invoice, balance, co-pay
- `wage_loss` — income, wages, lost earnings, employment, salary
- `future_damages` — future, life care plan, prognosis, ongoing
- `policy_coverage` — policy, coverage, limits, UM/UIM, deductible
- `attorney_demand` — demand, settlement, offer, compensation
- `settlement_posture` — counteroffer, negotiate, authority, reserve
- `visual_evidence` — photo, image, exhibit, radiograph, scan
- `prior_injuries` — pre-existing, prior, degenerative, history of

`labelChunk(chunkText, documentType): { label, confidence }[]` — returns all matching labels with confidence. Multiple labels per chunk allowed.

`labelChunksForDocument(chunks[]): Map<chunkId, labels[]>` — batch labeling.

#### 4. Retrieval Service: `src/lib/chunkRetrievalService.ts`

**Lexical retrieval**: `searchChunksLexical(caseId, query, filters)` — uses Postgres `ilike` / `to_tsvector` pattern on `chunk_text`, filtered by labels, document IDs, page ranges. Returns ranked results.

**Metadata retrieval**: `searchChunksByMetadata(caseId, filters)` — pure filter queries by label, document type, page range, chunk type.

**Semantic retrieval**: `searchChunksSemantic(caseId, query, filters)` — calls a `search-chunks` edge function that uses Lovable AI to re-rank chunk candidates by relevance to the query. Takes top N lexical candidates and re-ranks via AI.

**Unified entry point**: `retrieveChunks(caseId, query)` — dispatches to the right mode, logs a `retrieval_events` row with timing, returns results.

#### 5. Edge Function: `supabase/functions/search-chunks/index.ts`

AI-powered semantic re-ranking:
- Accepts `{ case_id, query, candidate_chunk_ids, top_k }`
- Fetches chunk texts for candidates
- Calls Lovable AI (gemini-3-flash-preview) with a ranking prompt
- Returns re-ranked chunk IDs with relevance scores

#### 6. Label Assignment Integration

Update `chunk-document/index.ts` to run heuristic labeling after chunk creation and insert `chunk_labels` rows. This makes labels available immediately after chunking.

#### 7. Hooks: `src/hooks/useChunkRetrieval.ts`

- `useChunkLabels(chunkId)` — fetch labels for a chunk
- `useCaseChunkLabels(caseId)` — fetch all labels for a case
- `useAssignChunkLabel()` — manual label assignment mutation
- `useChunkSearch(caseId)` — retrieval hook accepting query + filters, returns ranked chunks with labels
- `useRetrievalEvents(caseId)` — audit log query

### Files

| File | Action |
|------|--------|
| `supabase/migrations/` | Create — `chunk_labels` + `retrieval_events` tables |
| `src/types/chunk-retrieval.ts` | Create — label taxonomy, retrieval types |
| `src/lib/chunkLabelEngine.ts` | Create — heuristic labeling |
| `src/lib/chunkRetrievalService.ts` | Create — lexical/metadata/semantic search |
| `supabase/functions/search-chunks/index.ts` | Create — AI re-ranking |
| `src/hooks/useChunkRetrieval.ts` | Create — search + label hooks |
| `supabase/functions/chunk-document/index.ts` | Modify — add label assignment after chunking |
| `src/hooks/useDocumentChunks.ts` | Modify — extend row type with labels |

