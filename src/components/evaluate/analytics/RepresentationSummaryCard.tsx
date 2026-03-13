/**
 * Representation Summary Card
 *
 * Shows represented, unrepresented, and transitioned case counts
 * alongside average valuation and settlement metrics per segment.
 *
 * Guardrail: does NOT present simplistic conclusions that
 * representation alone changes value.
 */

import { Users, Shield } from "lucide-react";
import { useRepresentedVsUnrepresentedSummary } from "@/hooks/useRepresentationAnalytics";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const RepresentationSummaryCard = () => {
  const { data: result, isLoading } = useRepresentedVsUnrepresentedSummary();
  const d = result?.data;
  const isMock = result?.isMock ?? true;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-32" />
      </div>
    );
  }

  if (!d) return null;

  const total = d.represented_case_count + d.unrepresented_case_count + d.transitioned_case_count;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Represented vs Unrepresented Summary</h3>
        </div>
        {isMock && (
          <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
            Mock Data
          </span>
        )}
      </div>

      {/* Segment Counts */}
      <div className="grid grid-cols-4 gap-3">
        <CountCell label="Total Claims" value={total} />
        <CountCell label="Represented" value={d.represented_case_count} color="text-primary" />
        <CountCell label="Unrepresented" value={d.unrepresented_case_count} color="text-[hsl(var(--status-review))]" />
        <CountCell label="Transitioned" value={d.transitioned_case_count} color="text-[hsl(var(--status-attention))]" />
      </div>

      {/* Metric Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Metric</th>
              <th className="text-right py-1.5 px-3 font-medium">Represented</th>
              <th className="text-right py-1.5 px-3 font-medium">Unrepresented</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            <tr className="border-b border-border/50">
              <td className="py-1.5 pr-3">Avg Fact-Based Value (Mid)</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_fact_based_value_mid_represented)}</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_fact_based_value_mid_unrepresented)}</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-1.5 pr-3">Avg Expected Resolution (Mid)</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_expected_resolution_mid_represented)}</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_expected_resolution_mid_unrepresented)}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-3">Avg Final Settlement</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_final_settlement_represented)}</td>
              <td className="text-right py-1.5 px-3 font-mono">{fmt(d.avg_final_settlement_unrepresented)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Guardrail */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-accent/50 rounded-lg p-2.5">
        <Shield className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Differences in settlement averages reflect case-mix composition (severity, specials, liability, venue).
          Representation status alone does not determine claim value. Use severity-banded comparisons for normalized analysis.
        </span>
      </div>
    </div>
  );
};

function CountCell({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default RepresentationSummaryCard;
