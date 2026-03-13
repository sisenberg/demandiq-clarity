/**
 * Severity-Banded Representation Comparison Card
 *
 * Normalized comparison of represented vs unrepresented vs transitioned
 * claims across severity bands. This is the primary tool for fair analysis.
 */

import { BarChart3, Shield } from "lucide-react";
import { useSeverityBandedRepresentationComparison } from "@/hooks/useRepresentationAnalytics";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

const statusColors: Record<string, string> = {
  represented: "text-primary",
  unrepresented: "text-[hsl(var(--status-review))]",
  transitioned: "text-[hsl(var(--status-attention))]",
  unknown: "text-muted-foreground",
};

const statusBg: Record<string, string> = {
  represented: "bg-primary/10",
  unrepresented: "bg-[hsl(var(--status-review))]/10",
  transitioned: "bg-[hsl(var(--status-attention))]/10",
  unknown: "bg-muted/50",
};

const SeverityBandedComparisonCard = () => {
  const { data: result, isLoading } = useSeverityBandedRepresentationComparison();
  const rows = result?.data ?? [];
  const isMock = result?.isMock ?? true;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-40" />
      </div>
    );
  }

  // Group by severity band
  const bands = [...new Set(rows.map((r) => r.severity_band))].sort();

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Severity-Banded Representation Comparison</h3>
            <p className="text-[10px] text-muted-foreground">Normalized analysis — controls for case complexity</p>
          </div>
        </div>
        {isMock && (
          <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
            Mock Data
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left py-1.5 pr-3 font-medium">Severity</th>
              <th className="text-left py-1.5 px-3 font-medium">Status</th>
              <th className="text-right py-1.5 px-3 font-medium">Claims</th>
              <th className="text-right py-1.5 px-3 font-medium">Avg Fact-Based Value</th>
              <th className="text-right py-1.5 px-3 font-medium">Avg Settlement</th>
              <th className="text-right py-1.5 px-3 font-medium">Settlement/Value Ratio</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            {bands.map((band) => {
              const bandRows = rows.filter((r) => r.severity_band === band);
              return bandRows.map((row, idx) => (
                <tr
                  key={`${band}-${row.representation_status_at_close}`}
                  className={idx === bandRows.length - 1 ? "border-b border-border" : "border-b border-border/30"}
                >
                  <td className="py-1.5 pr-3 font-medium">{idx === 0 ? band : ""}</td>
                  <td className="py-1.5 px-3">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        statusColors[row.representation_status_at_close] ?? "text-muted-foreground"
                      } ${statusBg[row.representation_status_at_close] ?? "bg-muted/50"}`}
                    >
                      {row.representation_status_at_close}
                    </span>
                  </td>
                  <td className="text-right py-1.5 px-3 font-mono">{row.claim_count}</td>
                  <td className="text-right py-1.5 px-3 font-mono">{fmt(row.avg_fact_based_value_mid)}</td>
                  <td className="text-right py-1.5 px-3 font-mono">{fmt(row.avg_final_settlement)}</td>
                  <td className="text-right py-1.5 px-3 font-mono">{pct(row.avg_settlement_to_fact_based_ratio)}</td>
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>

      {/* Guardrail */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-accent/50 rounded-lg p-2.5">
        <Shield className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          This view controls for severity band. Remaining variation may reflect specials composition, liability posture,
          venue, or documentation quality — not representation status alone. Transitioned claims are always reported
          as a separate segment.
        </span>
      </div>
    </div>
  );
};

export default SeverityBandedComparisonCard;
