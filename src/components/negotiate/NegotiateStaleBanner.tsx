/**
 * NegotiateIQ — Stale package refresh banner
 */

import type { NegotiateStaleInfo } from "@/hooks/useNegotiateStaleDetection";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface NegotiateStaleBannerProps {
  staleInfo: NegotiateStaleInfo;
  onRefresh: () => void;
}

const NegotiateStaleBanner = ({ staleInfo, onRefresh }: NegotiateStaleBannerProps) => {
  if (!staleInfo.isStale) return null;

  const completedLabel = staleInfo.latestCompletedAt
    ? new Date(staleInfo.latestCompletedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "recently";

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[hsl(var(--status-attention))]/10 border border-[hsl(var(--status-attention))]/20">
      <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-attention))] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground">
          Newer EvaluatePackage Available
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          You are viewing v{staleInfo.currentVersion}, but v{staleInfo.latestVersion} was published {completedLabel}.
          Re-sync to update your negotiation context.
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))] hover:bg-[hsl(var(--status-attention))]/25 transition-colors shrink-0"
      >
        <RefreshCw className="h-3 w-3" />
        Re-sync
      </button>
    </div>
  );
};

export default NegotiateStaleBanner;
