/**
 * EvaluateIQ — Stale Data Warning Component
 *
 * Displays a banner when the upstream package (DemandIQ or ReviewerIQ) has
 * been modified after the current valuation was computed. Allows the user
 * to acknowledge and trigger a refresh/recompute.
 */

import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  isStale: boolean;
  staleReason: string;
  upstreamModule: string;
  upstreamVersion: number | null;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

const EvalStaleDataBanner = ({
  isStale,
  staleReason,
  upstreamModule,
  upstreamVersion,
  onRefresh,
  isRefreshing = false,
}: Props) => {
  if (!isStale) return null;

  const moduleName = upstreamModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ";

  return (
    <div className="rounded-lg border border-[hsl(var(--status-attention)/0.4)] bg-[hsl(var(--status-attention)/0.08)] px-4 py-3 mb-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Upstream Data Changed
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staleReason || `The ${moduleName} package${upstreamVersion ? ` (v${upstreamVersion})` : ""} has been updated since this valuation was computed. Results may no longer reflect the latest data.`}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
          {isRefreshing ? "Refreshing…" : "Refresh Inputs"}
        </button>
      </div>
    </div>
  );
};

export default EvalStaleDataBanner;
