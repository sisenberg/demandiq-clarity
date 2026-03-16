/**
 * CasualtyIQ — OCR/Extraction/Chunking Golden Test Suite
 *
 * Runs the benchmark corpus through the deterministic harness runner
 * and validates aggregate metrics and per-item stage results.
 */

import { describe, it, expect } from "vitest";
import { BENCHMARK_CORPUS } from "./fixtures/ocrBenchmarkCorpus";
import { runBenchmarkItem, runBenchmarkSuite } from "@/lib/benchmarkHarnessRunner";

describe("OCR Golden Harness — Per-Item Stages", () => {
  for (const item of BENCHMARK_CORPUS) {
    describe(item.name, () => {
      const result = runBenchmarkItem(item);

      it("passes file validation", () => {
        const stage = result.stages.find(s => s.stage === "file_validation");
        expect(stage?.passed).toBe(true);
      });

      it("routes to correct provider/strategy", () => {
        const stage = result.stages.find(s => s.stage === "provider_routing");
        expect(stage?.passed).toBe(true);
      });

      it("produces non-empty parse output", () => {
        const stage = result.stages.find(s => s.stage === "parse_success");
        expect(stage?.passed).toBe(true);
      });

      it("preserves page count", () => {
        const stage = result.stages.find(s => s.stage === "page_count_integrity");
        expect(stage?.passed).toBe(true);
      });

      it("creates canonical parse with content blocks", () => {
        const stage = result.stages.find(s => s.stage === "canonical_parse");
        expect(stage?.passed).toBe(true);
      });

      it("creates chunks within expected range", () => {
        const stage = result.stages.find(s => s.stage === "chunk_creation");
        expect(stage?.passed).toBe(true);
      });

      it("assigns expected labels with ≥50% coverage", () => {
        const stage = result.stages.find(s => s.stage === "label_assignment");
        expect(stage?.passed).toBe(true);
      });

      it("has evidence-link-ready chunks", () => {
        const stage = result.stages.find(s => s.stage === "evidence_link_readiness");
        expect(stage?.passed).toBe(true);
      });

      it("routes to correct extraction passes", () => {
        const stage = result.stages.find(s => s.stage === "extraction_routing");
        expect(stage?.passed).toBe(true);
      });

      it("produces valid package structure", () => {
        const stage = result.stages.find(s => s.stage === "package_structure");
        expect(stage?.passed).toBe(true);
      });
    });
  }
});

describe("OCR Golden Harness — Aggregate Metrics", () => {
  const summary = runBenchmarkSuite(BENCHMARK_CORPUS);

  it("achieves ≥85% parse success rate", () => {
    expect(summary.aggregate_metrics.parse_success_rate).toBeGreaterThanOrEqual(85);
  });

  it("achieves ≥85% page preservation rate", () => {
    expect(summary.aggregate_metrics.page_preservation_rate).toBeGreaterThanOrEqual(85);
  });

  it("achieves ≥50% label coverage", () => {
    expect(summary.aggregate_metrics.label_coverage).toBeGreaterThanOrEqual(50);
  });

  it("achieves 100% rerun consistency", () => {
    expect(summary.aggregate_metrics.rerun_consistency).toBe(100);
  });

  it("has < 20% failed field rate", () => {
    expect(summary.aggregate_metrics.failed_field_rate).toBeLessThan(20);
  });
});
