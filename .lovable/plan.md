

## Plan: Canonical Parsed Document Representation

### Problem
The current `document_pages` table stores raw extracted text per page but has no concept of parse versioning, provider metadata, or structured content blocks (headings, tables, lists). Downstream modules (chunking, extraction, citations) consume raw `extracted_text` strings with no normalized structure. Reprocessing overwrites page text in place, destroying prior parse output.

### Design

A new `parsed_document_pages` table serves as the canonical normalized representation. The existing `document_pages` table remains as the raw provider output layer. Downstream modules (chunking, extraction) will consume from `parsed_document_pages` instead.

```text
case_documents
  └── document_pages        (raw provider output, unchanged)
  └── parsed_document_pages  (NEW: canonical normalized format)
        ├── parse_version (integer, supports multiple parses)
        ├── page_number
        ├── page_text (full normalized text)
        ├── content_blocks (jsonb: headings, paragraphs, tables, lists in reading order)
        ├── provider / provider_model / provider_run_metadata
        ├── is_current (boolean, latest version flag)
        └── processing_run_id (links to document_processing_runs)
```

### 1. Schema Migration

**New table: `parsed_document_pages`**

```sql
CREATE TABLE public.parsed_document_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  case_id uuid NOT NULL REFERENCES public.cases(id),
  document_id uuid NOT NULL REFERENCES public.case_documents(id) ON DELETE CASCADE,
  parse_version integer NOT NULL DEFAULT 1,
  page_number integer NOT NULL,
  page_text text NOT NULL DEFAULT '',
  content_blocks jsonb NOT NULL DEFAULT '[]',
  -- content_blocks schema: [{ block_index, block_type (heading|paragraph|table|list|image_ref),
  --   text, level?, rows_cols?, char_start, char_end }]
  headings jsonb DEFAULT '[]',
  table_regions jsonb DEFAULT '[]',
  list_regions jsonb DEFAULT '[]',
  image_artifacts jsonb DEFAULT '[]',
  provider text NOT NULL DEFAULT 'unknown',
  provider_model text,
  provider_run_metadata jsonb DEFAULT '{}',
  confidence_score numeric,
  is_current boolean NOT NULL DEFAULT true,
  processing_run_id uuid REFERENCES public.document_processing_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(document_id, parse_version, page_number)
);
```

Indexes on `(document_id, is_current)` and `(document_id, parse_version)`. RLS matching existing tenant isolation pattern.

### 2. New Type: `src/types/parsed-document.ts`

Typed interfaces for `ParsedDocumentPage`, `ContentBlock` (discriminated union by `block_type`), and helper types for headings/tables/lists. Includes `ParseVersionSummary` for listing available versions per document.

### 3. Provider-to-Canonical Transformation: `src/lib/parseNormalizer.ts`

Pure functions:
- `normalizeProviderOutput(rawPages, provider, metadata) → ParsedDocumentPage[]` — transforms raw `document_pages` rows into canonical format, detecting headings (all-caps lines, numbered sections), table regions (tab/pipe-delimited patterns), and list regions (bullet/numbered patterns).
- `detectContentBlocks(pageText) → ContentBlock[]` — heuristic block detection in reading order.
- Each block gets `char_start` / `char_end` offsets relative to page text.

### 4. New Hook: `src/hooks/useParsedDocumentPages.ts`

- `useParsedDocumentPages(documentId, parseVersion?)` — fetches current (or specific version) canonical pages.
- `useDocumentParseVersions(documentId)` — lists available parse versions with metadata.
- `usePersistParsedPages()` — mutation that marks prior versions as `is_current = false`, inserts new version with incremented `parse_version`.

### 5. Edge Function Update: `process-document/index.ts`

After successful text extraction (existing flow), call the normalizer to produce canonical pages and persist them to `parsed_document_pages`. Store provider name and run metadata. On reprocess, increment `parse_version` rather than overwriting.

### 6. Chunk-Document Integration

Update `chunk-document/index.ts` to read from `parsed_document_pages` (current version) instead of `document_pages` when available, falling back to `document_pages` for backward compatibility.

### Files

| File | Action |
|------|--------|
| `supabase/migrations/` | Create — `parsed_document_pages` table |
| `src/types/parsed-document.ts` | Create — types for canonical format |
| `src/lib/parseNormalizer.ts` | Create — provider-to-canonical transformation |
| `src/hooks/useParsedDocumentPages.ts` | Create — query/persist hooks |
| `supabase/functions/process-document/index.ts` | Modify — persist canonical pages after extraction |
| `supabase/functions/chunk-document/index.ts` | Modify — read from canonical pages |

