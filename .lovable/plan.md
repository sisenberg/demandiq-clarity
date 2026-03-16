

## Plan: Evidence Anchoring & Citation Model

### Current State

Three overlapping, incomplete evidence concepts exist:
- **`evidence_references`** — document+page+char-offset citations, no chunk_id, no parse_version, no processing_run linkage
- **`fact_evidence_links`** — links facts to arbitrary entities, no document/page/chunk coordinates
- **`EvidenceLink` (legacy mock)** — has source_chunk_id but only used in mock data, no DB table
- **`SourceDrawer`** — resolves citations using hardcoded mock `MOCK_SOURCE_PAGES`, never reads real DB data
- **`CitationSource`** — UI-level interface uses string `docName`/`page`, not database IDs

**Gaps:** No version-awareness, no chunk linkage, no generalized anchor model, SourceDrawer is mock-only.

### Design

Unify around a single enhanced `evidence_references` table as the platform-wide citation anchor. Every module (extraction, review, evaluation, negotiation) attaches citations by inserting rows that point to document + page + chunk + parse version + provider run, and optionally link to a consuming entity.

```text
evidence_references (enhanced)
├── id, tenant_id, case_id
├── document_id, page_number, quoted_text
├── character_start, character_end
├── chunk_id (NEW → document_chunks)
├── parse_version (NEW)
├── processing_run_id (NEW → document_processing_runs)
├── bounding_box (NEW, jsonb, optional)
├── evidence_type (direct|corroborating|contradicting|contextual)
├── anchor_entity_type (NEW: extracted_fact|issue_flag|chronology_event|valuation_driver|negotiation_rationale|general)
├── anchor_entity_id (NEW: uuid of the consuming record)
├── anchor_module (NEW: demandiq|revieweriq|evaluateiq|negotiateiq)
├── created_by, created_at
```

This replaces the need for `fact_evidence_links` as a separate join table — facts just have evidence_references with `anchor_entity_type = 'extracted_fact'`.

### Changes

#### 1. Schema Migration
- Add columns to `evidence_references`: `chunk_id`, `parse_version`, `processing_run_id`, `bounding_box`, `anchor_entity_type`, `anchor_entity_id`, `anchor_module`
- Add indexes on `(anchor_entity_type, anchor_entity_id)` and `(chunk_id)`
- All new columns nullable for backward compatibility

#### 2. Types: `src/types/evidence-anchor.ts`
- `EvidenceAnchor` interface matching the enhanced row
- `AnchorEntityType` union type
- `AnchorModule` union type
- `BoundingBox` interface (x, y, width, height in page-relative coordinates)
- `ResolvedCitation` — enriched type that includes document filename, parsed page text, and chunk context for UI display
- Helper: `toCitationSource(anchor, docLookup): CitationSource` — converts DB row to UI format

#### 3. Citation Service: `src/lib/citationService.ts`
- `createEvidenceAnchor(params)` — validates and inserts an evidence_references row with full provenance
- `resolveAnchorsForEntity(entityType, entityId)` — fetches all citations for a given entity
- `resolveAnchorToPage(anchor)` — looks up parsed_document_pages to get the actual page text for display
- `buildCitationFromAnchor(anchor, docs, pages)` — transforms an anchor + context into a `ResolvedCitation` with navigable coordinates

#### 4. Hook: `src/hooks/useEvidenceAnchors.ts`
- `useEntityEvidenceAnchors(entityType, entityId)` — generic hook any module can use
- `useCreateEvidenceAnchor()` — mutation with full provenance fields
- `useResolvedCitations(entityType, entityId)` — joins anchors with document metadata + parsed pages for display-ready data
- `useBulkEvidenceAnchors(entityType, entityIds[])` — batch fetch for list views

#### 5. SourceDrawer Update: `src/components/case/SourceDrawer.tsx`
- Replace `MOCK_SOURCE_PAGES` / `findSourcePage` with real data resolution
- New `openSourceFromAnchor(anchor: EvidenceAnchor)` method on context that fetches parsed page content from `parsed_document_pages`
- Keep `openSource(CitationSource)` for backward compat, but resolve via DB when document_id is available
- Show parse version badge and chunk context when available

#### 6. Update `useEvidenceReferences.ts`
- Extend `EvidenceReferenceRow` with the new fields
- Add `useEntityEvidenceRefs(entityType, entityId)` query
- Update `useCreateEvidenceRef` to accept optional chunk_id, parse_version, processing_run_id, anchor fields

#### 7. Integration: `EvidenceCitation.tsx`
- Extend `CitationSource` with optional `documentId`, `anchorId`, `parseVersion`, `chunkId` for deep-link resolution
- `CitationBadge` passes these through to SourceDrawer for real page lookup

### Files

| File | Action |
|------|--------|
| `supabase/migrations/` | Create — extend evidence_references |
| `src/types/evidence-anchor.ts` | Create — anchor types, bounding box, resolved citation |
| `src/lib/citationService.ts` | Create — anchor CRUD and resolution |
| `src/hooks/useEvidenceAnchors.ts` | Create — generic entity citation hooks |
| `src/hooks/useEvidenceReferences.ts` | Modify — extend row type, add anchor fields |
| `src/components/case/SourceDrawer.tsx` | Modify — real data resolution, parse version display |
| `src/components/case/EvidenceCitation.tsx` | Modify — extend CitationSource with IDs |

