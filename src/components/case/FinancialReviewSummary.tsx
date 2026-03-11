/**
 * ReviewerIQ — Financial Review Summary
 * Shows totals with drill-down by provider, date range, and code category.
 */

import { useState, useMemo } from "react";
import {
  DollarSign, TrendingDown, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, BarChart3,
} from "lucide-react";
import type { ReviewerBillLine } from "@/types/reviewer-bills";
import type { ReviewIssue } from "@/types/reviewer-issues";

interface FinancialReviewSummaryProps {
  billLines: ReviewerBillLine[];
  issues: ReviewIssue[];
}

export default function FinancialReviewSummary({ billLines, issues }: FinancialReviewSummaryProps) {
  const [drillDown, setDrillDown] = useState<"provider" | "code" | null>(null);

  const totals = useMemo(() => {
    let billed = 0, reference = 0, accepted = 0, reduced = 0, disputed = 0, questioned = 0;

    for (const l of billLines) {
      billed += l.billed_amount;
      if (l.reference_amount) reference += l.reference_amount;
      if (l.disposition === "accepted") accepted += l.accepted_amount ?? l.billed_amount;
      if (l.disposition === "reduced") reduced += (l.billed_amount - (l.accepted_amount ?? 0));
      if (l.disposition === "denied" || l.disposition === "disputed") disputed += l.billed_amount;
    }

    questioned = issues.reduce((s, i) => s + i.questioned_amount, 0);

    return { billed, reference, accepted, reduced, disputed, questioned };
  }, [billLines, issues]);

  const byProvider = useMemo(() => {
    const map = new Map<string, { billed: number; reference: number; accepted: number; lines: number; issues: number }>();
    for (const l of billLines) {
      const key = l.provider_name || "Unknown";
      const cur = map.get(key) || { billed: 0, reference: 0, accepted: 0, lines: 0, issues: 0 };
      cur.billed += l.billed_amount;
      if (l.reference_amount) cur.reference += l.reference_amount;
      if (l.accepted_amount) cur.accepted += l.accepted_amount;
      cur.lines++;
      map.set(key, cur);
    }
    for (const i of issues) {
      if (i.affected_provider) {
        const cur = map.get(i.affected_provider);
        if (cur) cur.issues++;
      }
    }
    return [...map.entries()].sort((a, b) => b[1].billed - a[1].billed);
  }, [billLines, issues]);

  const byCode = useMemo(() => {
    const map = new Map<string, { billed: number; reference: number; lines: number; category: string }>();
    for (const l of billLines) {
      const code = l.cpt_code || "No Code";
      const cur = map.get(code) || { billed: 0, reference: 0, lines: 0, category: l.description };
      cur.billed += l.billed_amount;
      if (l.reference_amount) cur.reference += l.reference_amount;
      cur.lines++;
      map.set(code, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].billed - a[1].billed);
  }, [billLines]);

  const variancePct = totals.reference > 0
    ? Math.round((totals.billed / totals.reference) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Top-line totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <TotalCard icon={DollarSign} label="Total Billed" value={`$${totals.billed.toLocaleString()}`} />
        <TotalCard icon={BarChart3} label="Reference Total" value={`$${totals.reference.toLocaleString()}`} sub={variancePct > 0 ? `${variancePct}% of ref` : undefined} />
        <TotalCard icon={AlertTriangle} label="Questioned" value={`$${totals.questioned.toLocaleString()}`} alert={totals.questioned > 0} />
        <TotalCard icon={CheckCircle2} label="Accepted" value={`$${totals.accepted.toLocaleString()}`} />
        <TotalCard icon={TrendingDown} label="Reduced" value={`$${totals.reduced.toLocaleString()}`} />
        <TotalCard icon={AlertTriangle} label="Disputed" value={`$${totals.disputed.toLocaleString()}`} alert={totals.disputed > 0} />
      </div>

      {/* Drill-down toggles */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDrillDown(drillDown === "provider" ? null : "provider")}
          className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            drillDown === "provider" ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
          }`}
        >
          By Provider
        </button>
        <button
          onClick={() => setDrillDown(drillDown === "code" ? null : "code")}
          className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
            drillDown === "code" ? "border-primary/30 bg-primary/5 text-primary" : "border-border bg-card text-muted-foreground"
          }`}
        >
          By CPT Code
        </button>
      </div>

      {/* Provider drill-down */}
      {drillDown === "provider" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th className="text-right">Lines</th>
                <th className="text-right">Billed</th>
                <th className="text-right">Reference</th>
                <th className="text-right">Variance</th>
                <th className="text-right">Issues</th>
              </tr>
            </thead>
            <tbody>
              {byProvider.map(([name, data]) => {
                const v = data.reference > 0 ? Math.round((data.billed / data.reference) * 100) : 0;
                return (
                  <tr key={name}>
                    <td className="text-[11px] font-medium">{name}</td>
                    <td className="text-right text-[11px]">{data.lines}</td>
                    <td className="text-right text-[11px] font-mono">${data.billed.toLocaleString()}</td>
                    <td className="text-right text-[11px] font-mono">${data.reference.toLocaleString()}</td>
                    <td className={`text-right text-[11px] font-mono ${v > 200 ? "text-[hsl(var(--status-failed))]" : v > 150 ? "text-[hsl(var(--status-review))]" : ""}`}>
                      {v > 0 ? `${v}%` : "—"}
                    </td>
                    <td className="text-right text-[11px]">{data.issues > 0 ? data.issues : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="font-semibold">Total</td>
                <td className="text-right">{billLines.length}</td>
                <td className="text-right font-mono">${totals.billed.toLocaleString()}</td>
                <td className="text-right font-mono">${totals.reference.toLocaleString()}</td>
                <td className="text-right font-mono">{variancePct > 0 ? `${variancePct}%` : "—"}</td>
                <td className="text-right">{issues.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Code drill-down */}
      {drillDown === "code" && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>CPT Code</th>
                <th>Description</th>
                <th className="text-right">Lines</th>
                <th className="text-right">Billed</th>
                <th className="text-right">Reference</th>
                <th className="text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {byCode.map(([code, data]) => {
                const v = data.reference > 0 ? Math.round((data.billed / data.reference) * 100) : 0;
                return (
                  <tr key={code}>
                    <td className="text-[11px] font-mono font-medium">{code}</td>
                    <td className="text-[10px] text-muted-foreground truncate max-w-[200px]">{data.category}</td>
                    <td className="text-right text-[11px]">{data.lines}</td>
                    <td className="text-right text-[11px] font-mono">${data.billed.toLocaleString()}</td>
                    <td className="text-right text-[11px] font-mono">${data.reference.toLocaleString()}</td>
                    <td className={`text-right text-[11px] font-mono ${v > 200 ? "text-[hsl(var(--status-failed))]" : v > 150 ? "text-[hsl(var(--status-review))]" : ""}`}>
                      {v > 0 ? `${v}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TotalCard({ icon: Icon, label, value, sub, alert }: { icon: React.ElementType; label: string; value: string; sub?: string; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${alert ? "text-[hsl(var(--status-review))]" : "text-muted-foreground"}`} />
        <span className="text-[9px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-[14px] font-semibold text-foreground font-mono leading-tight">{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
