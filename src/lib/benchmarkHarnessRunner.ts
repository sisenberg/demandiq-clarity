/**
 * CasualtyIQ — Benchmark Harness Runner
 *
 * Deterministic, pure-function pipeline runner that validates the
 * OCR/chunking/labeling/extraction stack against the benchmark corpus.
 * No DB or network calls — fully in-browser.
 */

import type {
  BenchmarkCorpusItem,
  BenchmarkStage,
  BenchmarkStageResult,
  BenchmarkItemResult,
  BenchmarkRunSummary,
  BenchmarkAggregateMetrics,
  BenchmarkFailureClass,
} from "@/types/benchmark-harness";
import { normalizeProviderOutput, detectContentBlocks } from "@/lib/parseNormalizer";
import { labelChunk } from "@/lib/chunkLabelEngine";
import { createHash } from "@/lib/benchmarkHashUtil";

// ── Accepted File Constraints ──────────────────────────────

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
]);
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ── Chunk Strategy Mapping ─────────────────────────────────

type ChunkStrategy = "semantic_large" | "table_aware" | "section_page" | "paragraph";

function getChunkStrategy(documentType: string): ChunkStrategy {
  switch (documentType) {
    case "demand_letter":
      return "semantic_large";
    case "medical_bill":
    case "itemized_statement":
    case "billing_record":
      return "table_aware";
    case "medical_record":
    case "imaging_report":
      return "section_page";
    case "narrative_report":
      return "paragraph";
    default:
      return "paragraph";
  }
}

// ── Extraction Pass Mapping ────────────────────────────────

function getExtractionPasses(documentType: string): string[] {
  switch (documentType) {
    case "demand_letter":
      return ["demand_extraction"];
    case "medical_bill":
    case "itemized_statement":
    case "billing_record":
      return ["specials_extraction"];
    case "medical_record":
    case "imaging_report":
      return ["treatment_timeline_extraction", "injury_extraction"];
    case "narrative_report":
      return ["treatment_timeline_extraction", "injury_extraction"];
    default:
      return [];
  }
}

// ── Chunking Simulation ────────────────────────────────────

interface SimulatedChunk {
  id: string;
  chunk_text: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  content_hash: string;
}

function applyChunkStrategy(
  strategy: ChunkStrategy,
  pageTexts: string[],
  documentId: string
): SimulatedChunk[] {
  const chunks: SimulatedChunk[] = [];
  let chunkIndex = 0;

  const windowSize =
    strategy === "semantic_large" ? 4 :
    strategy === "table_aware" ? 2 :
    strategy === "section_page" ? 1 :
    1;

  for (let i = 0; i < pageTexts.length; i += windowSize) {
    const end = Math.min(i + windowSize, pageTexts.length);
    const text = pageTexts.slice(i, end).join("\n\n");
    if (text.trim().length === 0) continue;

    const hash = createHash(documentId, "1", chunkIndex);
    chunks.push({
      id: `chunk-${documentId}-${chunkIndex}`,
      chunk_text: text,
      chunk_index: chunkIndex,
      page_start: i + 1,
      page_end: end,
      content_hash: hash,
    });
    chunkIndex++;
  }

  return chunks;
}

// ── Stage Runners ──────────────────────────────────────────

function runStage(
  stage: BenchmarkStage,
  fn: () => { passed: boolean; failure_class?: BenchmarkFailureClass; error_message?: string; metrics?: Record<string, number | string> }
): BenchmarkStageResult {
  const start = performance.now();
  try {
    const result = fn();
    return { stage, ...result, duration_ms: Math.round(performance.now() - start) };
  } catch (e: any) {
    return {
      stage,
      passed: false,
      duration_ms: Math.round(performance.now() - start),
      failure_class: "provider_error",
      error_message: e.message || String(e),
    };
  }
}

function runItemStages(item: BenchmarkCorpusItem): BenchmarkStageResult[] {
  const stages: BenchmarkStageResult[] = [];
  const documentId = `bench-${item.id}`;

  // 1. File validation
  stages.push(runStage("file_validation", () => {
    const validType = ACCEPTED_TYPES.has(item.fileType);
    const validSize = item.fileSizeBytes <= MAX_FILE_SIZE;
    if (!validType) return { passed: false, failure_class: "file_corruption", error_message: `Invalid file type: ${item.fileType}` };
    if (!validSize) return { passed: false, failure_class: "file_corruption", error_message: `File too large: ${item.fileSizeBytes}` };
    return { passed: true, metrics: { file_size: item.fileSizeBytes, file_type: item.fileType } };
  }));

  // 2. Provider routing
  const strategy = getChunkStrategy(item.documentType);
  stages.push(runStage("provider_routing", () => {
    if (!strategy) return { passed: false, failure_class: "routing_failure", error_message: "No chunk strategy for document type" };
    return { passed: true, metrics: { strategy } };
  }));

  // 3. Parse success
  stages.push(runStage("parse_success", () => {
    const nonEmpty = item.pageTexts.filter(t => t.trim().length > 0).length;
    if (nonEmpty === 0) return { passed: false, failure_class: "provider_error", error_message: "No parseable pages" };
    return { passed: true, metrics: { pages_with_text: nonEmpty } };
  }));

  // 4. Page count integrity
  stages.push(runStage("page_count_integrity", () => {
    const actual = item.pageTexts.length;
    if (actual !== item.pageCount) return { passed: false, failure_class: "page_loss", error_message: `Expected ${item.pageCount} pages, got ${actual}` };
    return { passed: true, metrics: { expected: item.pageCount, actual } };
  }));

  // 5. Canonical parse creation
  const rawPages = item.pageTexts.map((text, i) => ({
    page_number: i + 1,
    extracted_text: text,
    confidence_score: item.isOcrRequired ? 0.72 : 0.98,
  }));
  const normalized = normalizeProviderOutput(rawPages);

  stages.push(runStage("canonical_parse", () => {
    const totalBlocks = normalized.reduce((sum, p) => sum + p.content_blocks.length, 0);
    if (totalBlocks === 0) return { passed: false, failure_class: "provider_error", error_message: "No content blocks detected" };
    return { passed: true, metrics: { pages_normalized: normalized.length, total_blocks: totalBlocks } };
  }));

  // 6. Chunk creation
  const chunks = applyChunkStrategy(strategy, item.pageTexts, documentId);
  stages.push(runStage("chunk_creation", () => {
    const count = chunks.length;
    if (count < item.expectedChunkCountMin || count > item.expectedChunkCountMax) {
      return {
        passed: false,
        failure_class: "chunking_failure",
        error_message: `Chunk count ${count} outside expected range [${item.expectedChunkCountMin}, ${item.expectedChunkCountMax}]`,
        metrics: { chunk_count: count, expected_min: item.expectedChunkCountMin, expected_max: item.expectedChunkCountMax },
      };
    }
    return { passed: true, metrics: { chunk_count: count } };
  }));

  // 7. Label assignment
  stages.push(runStage("label_assignment", () => {
    const allLabels = new Set<string>();
    for (const chunk of chunks) {
      const labels = labelChunk(chunk.chunk_text, item.documentType);
      labels.forEach(l => allLabels.add(l.label));
    }
    const matched = item.expectedLabels.filter(l => allLabels.has(l));
    const coverage = item.expectedLabels.length > 0 ? matched.length / item.expectedLabels.length : 1;
    return {
      passed: coverage >= 0.5,
      metrics: { label_coverage: Math.round(coverage * 100), labels_found: allLabels.size, labels_expected: item.expectedLabels.length },
      ...(coverage < 0.5 ? { failure_class: "extraction_failure" as BenchmarkFailureClass, error_message: `Label coverage ${Math.round(coverage * 100)}% below threshold` } : {}),
    };
  }));

  // 8. Evidence link readiness
  stages.push(runStage("evidence_link_readiness", () => {
    const ready = chunks.every(c => c.content_hash && c.page_start > 0 && c.page_end >= c.page_start);
    if (!ready) return { passed: false, failure_class: "evidence_link_failure", error_message: "Chunks missing hash or page range" };
    return { passed: true, metrics: { chunks_with_anchors: chunks.length } };
  }));

  // 9. Extraction routing
  const passes = getExtractionPasses(item.documentType);
  stages.push(runStage("extraction_routing", () => {
    const expected = new Set(item.expectedExtractionPasses);
    const actual = new Set(passes);
    const missing = [...expected].filter(p => !actual.has(p));
    if (missing.length > 0) return { passed: false, failure_class: "extraction_failure", error_message: `Missing passes: ${missing.join(", ")}` };
    return { passed: true, metrics: { extraction_passes: passes.join(", ") } };
  }));

  // 10. Package structure
  stages.push(runStage("package_structure", () => {
    const hasDemandFields = item.documentType === "demand_letter";
    const hasChunks = chunks.length > 0;
    const hasPages = normalized.length > 0;
    if (!hasChunks || !hasPages) return { passed: false, failure_class: "package_publication_failure", error_message: "Missing chunks or pages for package" };
    return { passed: true, metrics: { has_demand_fields: hasDemandFields ? 1 : 0, chunk_count: chunks.length, page_count: normalized.length } };
  }));

  // 11. EvaluateIQ eligibility
  stages.push(runStage("evaluate_eligibility", () => {
    const isDemand = item.documentType === "demand_letter";
    const hasPackage = chunks.length > 0 && normalized.length > 0;
    const eligible = isDemand && hasPackage;
    if (!eligible && isDemand) return { passed: false, failure_class: "downstream_launch_failure", error_message: "Package not ready for EvaluateIQ" };
    return { passed: true, metrics: { eligible: eligible ? 1 : 0 } };
  }));

  return stages;
}

// ── Public API ─────────────────────────────────────────────

export function runBenchmarkItem(item: BenchmarkCorpusItem): BenchmarkItemResult {
  const stages = runItemStages(item);
  const failureClasses = stages
    .filter(s => !s.passed && s.failure_class)
    .map(s => s.failure_class!);

  return {
    benchmark_id: item.id,
    benchmark_name: item.name,
    stages,
    overall_passed: stages.every(s => s.passed),
    failure_classes: [...new Set(failureClasses)],
    timestamp: new Date().toISOString(),
  };
}

export function runBenchmarkSuite(corpus: BenchmarkCorpusItem[]): BenchmarkRunSummary {
  const startedAt = new Date().toISOString();
  const items = corpus.map(runBenchmarkItem);

  // Run twice for rerun consistency
  const items2 = corpus.map(runBenchmarkItem);
  const consistent = items.every((item, i) =>
    item.stages.every((s, j) => s.passed === items2[i].stages[j].passed)
  );

  const aggregate = computeAggregateMetrics(items, consistent);
  const failureCounts: Partial<Record<BenchmarkFailureClass, number>> = {};
  for (const item of items) {
    for (const fc of item.failure_classes) {
      failureCounts[fc] = (failureCounts[fc] ?? 0) + 1;
    }
  }

  return {
    run_id: `run-${Date.now()}`,
    items,
    aggregate_metrics: aggregate,
    failure_class_counts: failureCounts,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  };
}

function computeAggregateMetrics(
  items: BenchmarkItemResult[],
  rerunConsistent: boolean
): BenchmarkAggregateMetrics {
  const total = items.length;
  if (total === 0) {
    return { parse_success_rate: 0, page_preservation_rate: 0, chunk_count_variance: 0, label_coverage: 0, failed_field_rate: 0, rerun_consistency: 0, avg_latency_ms: 0 };
  }

  let parsePass = 0;
  let pagePass = 0;
  let labelCoverageSum = 0;
  let totalLatency = 0;
  let stageCount = 0;
  let failedStages = 0;
  let chunkCounts: number[] = [];

  for (const item of items) {
    for (const s of item.stages) {
      totalLatency += s.duration_ms;
      stageCount++;
      if (!s.passed) failedStages++;

      if (s.stage === "parse_success" && s.passed) parsePass++;
      if (s.stage === "page_count_integrity" && s.passed) pagePass++;
      if (s.stage === "label_assignment") {
        labelCoverageSum += Number(s.metrics?.label_coverage ?? 0);
      }
      if (s.stage === "chunk_creation") {
        chunkCounts.push(Number(s.metrics?.chunk_count ?? 0));
      }
    }
  }

  const mean = chunkCounts.length > 0 ? chunkCounts.reduce((a, b) => a + b, 0) / chunkCounts.length : 0;
  const variance = chunkCounts.length > 0
    ? chunkCounts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / chunkCounts.length
    : 0;

  return {
    parse_success_rate: Math.round((parsePass / total) * 100),
    page_preservation_rate: Math.round((pagePass / total) * 100),
    chunk_count_variance: Math.round(variance * 100) / 100,
    label_coverage: Math.round(labelCoverageSum / total),
    failed_field_rate: stageCount > 0 ? Math.round((failedStages / stageCount) * 100) : 0,
    rerun_consistency: rerunConsistent ? 100 : 0,
    avg_latency_ms: stageCount > 0 ? Math.round(totalLatency / stageCount) : 0,
  };
}
