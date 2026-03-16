import { useState, useCallback } from "react";
import { Play, CheckCircle2, XCircle, ChevronDown, ChevronUp, BarChart3, AlertTriangle } from "lucide-react";
import { BENCHMARK_CORPUS } from "@/test/fixtures/ocrBenchmarkCorpus";
import { runBenchmarkSuite } from "@/lib/benchmarkHarnessRunner";
import type { BenchmarkRunSummary, BenchmarkStage, BenchmarkFailureClass } from "@/types/benchmark-harness";
import { STAGE_LABELS, FAILURE_CLASS_LABELS } from "@/types/benchmark-harness";

const BenchmarkDashboardPage = () => {
  const [summary, setSummary] = useState<BenchmarkRunSummary | null>(null);
  const [running, setRunning] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handleRun = useCallback(() => {
    setRunning(true);
    // Defer to allow UI to update
    requestAnimationFrame(() => {
      const result = runBenchmarkSuite(BENCHMARK_CORPUS);
      setSummary(result);
      setRunning(false);
    });
  }, []);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Pipeline Benchmark Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Golden test harness for OCR, chunking, labeling & extraction validation
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {running ? "Running…" : "Run Harness"}
        </button>
      </div>

      {/* Aggregate Metrics */}
      {summary && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            {([
              ["Parse Success", `${summary.aggregate_metrics.parse_success_rate}%`],
              ["Page Preservation", `${summary.aggregate_metrics.page_preservation_rate}%`],
              ["Label Coverage", `${summary.aggregate_metrics.label_coverage}%`],
              ["Chunk Variance", summary.aggregate_metrics.chunk_count_variance.toFixed(1)],
              ["Failed Fields", `${summary.aggregate_metrics.failed_field_rate}%`],
              ["Rerun Consistency", `${summary.aggregate_metrics.rerun_consistency}%`],
              ["Avg Latency", `${summary.aggregate_metrics.avg_latency_ms}ms`],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="card-elevated px-4 py-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="text-lg font-semibold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Failure Classification */}
          {Object.keys(summary.failure_class_counts).length > 0 && (
            <div className="card-elevated px-5 py-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-attention))]" />
                <span className="text-sm font-medium text-foreground">Failure Classification</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.failure_class_counts).map(([cls, count]) => (
                  <span
                    key={cls}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-destructive/10 text-destructive"
                  >
                    {FAILURE_CLASS_LABELS[cls as BenchmarkFailureClass]} — {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="card-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-muted/30">
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider w-8" />
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Benchmark</th>
                  <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Result</th>
                  {Object.keys(STAGE_LABELS).map(stage => (
                    <th key={stage} className="px-2 py-3 text-[9px] font-medium text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap">
                      {STAGE_LABELS[stage as BenchmarkStage].split(" ")[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.items.map(item => {
                  const isExpanded = expanded.has(item.benchmark_id);
                  return (
                    <ItemRow
                      key={item.benchmark_id}
                      item={item}
                      isExpanded={isExpanded}
                      onToggle={() => toggle(item.benchmark_id)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!summary && !running && (
        <div className="card-elevated px-8 py-16 text-center">
          <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Click "Run Harness" to execute the benchmark corpus</p>
        </div>
      )}
    </div>
  );
};

// ── Item Row ───────────────────────────────────────────────

interface ItemRowProps {
  item: BenchmarkRunSummary["items"][number];
  isExpanded: boolean;
  onToggle: () => void;
}

function ItemRow({ item, isExpanded, onToggle }: ItemRowProps) {
  const Icon = isExpanded ? ChevronUp : ChevronDown;
  return (
    <>
      <tr className="hover:bg-accent/30 transition-colors cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </td>
        <td className="px-4 py-3">
          <span className="font-medium text-foreground">{item.benchmark_name}</span>
          <span className="ml-2 text-[10px] text-muted-foreground font-mono">{item.benchmark_id}</span>
        </td>
        <td className="px-4 py-3 text-center">
          {item.overall_passed ? (
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))] mx-auto" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive mx-auto" />
          )}
        </td>
        {item.stages.map(s => (
          <td key={s.stage} className="px-2 py-3 text-center">
            {s.passed ? (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[hsl(var(--status-approved))]" />
            ) : (
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </td>
        ))}
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={3 + Object.keys(STAGE_LABELS).length} className="px-6 py-4 bg-muted/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {item.stages.filter(s => !s.passed).map(s => (
                <div key={s.stage} className="rounded-lg border border-destructive/20 bg-[hsl(var(--status-failed-bg))] px-4 py-3">
                  <p className="text-xs font-semibold text-destructive">{STAGE_LABELS[s.stage]}</p>
                  {s.failure_class && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Class: {FAILURE_CLASS_LABELS[s.failure_class]}
                    </p>
                  )}
                  {s.error_message && (
                    <p className="text-xs text-foreground mt-1 font-mono">{s.error_message}</p>
                  )}
                </div>
              ))}
              {item.stages.filter(s => s.passed && s.metrics).slice(0, 4).map(s => (
                <div key={s.stage} className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-xs font-semibold text-foreground">{STAGE_LABELS[s.stage]}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                    {Object.entries(s.metrics!).map(([k, v]) => (
                      <span key={k} className="text-[10px] text-muted-foreground">
                        {k}: <span className="font-mono text-foreground">{v}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default BenchmarkDashboardPage;
