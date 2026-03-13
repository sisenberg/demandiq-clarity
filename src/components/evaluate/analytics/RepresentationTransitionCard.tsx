/**
 * Representation Transition Analytics Card
 *
 * Shows metrics about claimants who transitioned from unrepresented
 * to represented during the claim lifecycle.
 */

import { ArrowRightLeft, Shield } from "lucide-react";
import { useRepresentationTransitionAnalytics } from "@/hooks/useRepresentationAnalytics";

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const RepresentationTransitionCard = () => {
  const { data: result, isLoading } = useRepresentationTransitionAnalytics();
  const d = result?.data;
  const isMock = result?.isMock ?? true;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 animate-pulse">
        <div className="h-28" />
      </div>
    );
  }

  if (!d) return null;

  const retentionRate =
    d.unrepresented_at_open_count > 0
      ? ((d.retained_counsel_later_count / d.unrepresented_at_open_count) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[hsl(var(--status-attention))]/10 flex items-center justify-center">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
          </div>
          <h3 className="text-xs font-semibold text-foreground">Representation Transitions</h3>
        </div>
        {isMock && (
          <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
            Mock Data
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Unrepresented at Open" value={d.unrepresented_at_open_count} />
        <KPI label="Retained Counsel Later" value={d.retained_counsel_later_count} sub={`${retentionRate}% retention rate`} />
        <KPI label="Retained After Initial Offer" value={d.retained_after_initial_offer_count} />
        <KPI label="Avg Days to Retention" value={d.avg_days_to_retention != null ? `${d.avg_days_to_retention}d` : "—"} />
      </div>

      {/* Settlement Comparison */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-accent/50 p-3 text-center">
          <p className="text-[9px] text-muted-foreground mb-1">Avg Settlement — Never Retained</p>
          <p className="text-sm font-bold font-mono text-foreground">{fmt(d.avg_settlement_if_never_retained)}</p>
        </div>
        <div className="rounded-lg bg-accent/50 p-3 text-center">
          <p className="text-[9px] text-muted-foreground mb-1">Avg Settlement — Retained Later</p>
          <p className="text-sm font-bold font-mono text-foreground">{fmt(d.avg_settlement_if_retained_later)}</p>
        </div>
      </div>

      {/* Guardrail */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-accent/50 rounded-lg p-2.5">
        <Shield className="h-3 w-3 mt-0.5 shrink-0" />
        <span>
          Settlement differences between retention groups are influenced by claim severity and complexity.
          Higher-value claims may correlate with attorney retention independently of representation impact.
        </span>
      </div>
    </div>
  );
};

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[8px] text-muted-foreground/70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default RepresentationTransitionCard;
