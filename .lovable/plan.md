

## Plan: OCR/Extraction/Chunking Golden Test Harness & Validation Dashboard

### Architecture

Two deliverables: (1) a repeatable Vitest-based golden test suite with synthetic benchmark fixtures, and (2) a UI validation dashboard accessible from the Admin page to view run results.

### 1. Benchmark Corpus: `src/test/fixtures/ocrBenchmarkCorpus.ts`

Seven synthetic benchmark items, each with expected outcomes:

| ID | Scenario | Doc Type | Pages | Expected Labels |
|----|----------|----------|-------|-----------------|
| `bn-01` | Text-native PDF demand | `demand_letter` | 12 | liability, attorney_demand |
| `bn-02` | Scanned/image-only PDF demand | `demand_letter` | 8 | liability, treatment_chronology |
| `bn-03` | Multi-doc packet (bills + records) | mixed | 24 | specials_billing, treatment_chronology |
| `bn-04` | Poor-quality faxed records | `medical_record` | 6 | treatment_chronology, prior_injuries |
| `bn-05` | Photos + PDF packet | mixed | 4+3 | visual_evidence, treatment_chronology |
| `bn-06` | Oversized packet | `demand_letter` | 85 | all labels present |
| `bn-07` | Revised demand v2 | `demand_letter` | 14 | attorney_demand, settlement_posture |

Each fixture defines: `id`, `name`, `documentType`, `pageCount`, `pageTexts[]` (synthetic text simulating each scenario), `expectedLabels`, `expectedChunkStrategy`, `expectedExtractionPasses`, `isOcrRequired`, `expectedFailurePoints`.

### 2. Golden Test Suite: `src/test/ocr-golden-harness.test.ts`

Tests run the pipeline stages locally (no edge function calls) using the engines already in the codebase:

**Stage tests per benchmark item:**
1. **File validation** — verify file type/size within accepted bounds
2. **Provider routing** — `getChunkStrategy()` returns expected strategy
3. **Parse simulation** — synthetic pages produce non-empty text
4. **Page count integrity** — output page count matches input
5. **Canonical parse creation** — content blocks detected from page text
6. **Chunk creation** — `applyChunkStrategy()` produces expected chunk counts within variance tolerance
7. **Label assignment** — `labelChunk()` returns expected labels with confidence > 0.5
8. **Evidence link readiness** — chunks have content_hash, page ranges for anchor creation
9. **Extraction pass routing** — `getExtractionPasses()` returns correct passes per doc type
10. **DemandPackage structure** — validates package assembly has required fields
11. **EvaluateIQ launch eligibility** — validates eligibility check logic

**Metrics computed per run:**
- Parse success rate, page preservation rate, chunk count variance
- Label coverage (assigned vs expected), failed-field rate
- Rerun consistency (deterministic output across 2 runs)

### 3. Failure Classification Types: `src/types/benchmark-harness.ts`

```text
BenchmarkFailureClass:
  routing_failure | file_corruption | provider_error | parse_timeout |
  page_loss | chunking_failure | extraction_failure |
  evidence_link_failure | package_publication_failure | downstream_launch_failure

BenchmarkStageResult:
  stage, passed, duration_ms, failure_class?, error_message?, metrics?

BenchmarkItemResult:
  benchmark_id, stages[], overall_passed, failure_classes[], timestamp

BenchmarkRunSummary:
  run_id, items[], aggregate_metrics (parse_success_rate, page_preservation_rate, etc.)
```

### 4. Harness Runner: `src/lib/benchmarkHarnessRunner.ts`

Pure function that takes a benchmark corpus and runs all stage checks, returning `BenchmarkRunSummary`. Used by both tests and the UI dashboard. Imports chunk strategy, label engine, extraction pass routing from existing modules. No DB or network calls — fully deterministic.

### 5. Validation Dashboard Page: `src/pages/BenchmarkDashboardPage.tsx`

Admin-only page at `/admin/benchmarks`:
- "Run Harness" button executes the runner in-browser
- Results table: one row per benchmark item, columns for each stage (pass/fail icon)
- Expandable row detail showing failure class, error, and metrics
- Aggregate metrics panel at top: parse success %, page preservation %, label coverage %, chunk variance, rerun consistency
- Failure classification summary: grouped counts by failure class

### 6. Route + Navigation

- Add route `/admin/benchmarks` in `App.tsx` behind `RoleGuard` (admin)
- Add link in `AdminPage.tsx` or sidebar

### Files

| File | Action |
|------|--------|
| `src/types/benchmark-harness.ts` | Create — failure classes, result types, metrics |
| `src/test/fixtures/ocrBenchmarkCorpus.ts` | Create — 7 synthetic benchmark items with page texts |
| `src/lib/benchmarkHarnessRunner.ts` | Create — deterministic stage runner |
| `src/test/ocr-golden-harness.test.ts` | Create — golden test suite |
| `src/pages/BenchmarkDashboardPage.tsx` | Create — validation dashboard |
| `src/App.tsx` | Modify — add benchmark route |

