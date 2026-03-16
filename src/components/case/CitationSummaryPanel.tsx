/**
 * Citation Summary Panel — shows total evidence anchors grouped by module and entity type.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnchorEntityType, AnchorModule } from "@/types/evidence-anchor";
import {
  Fingerprint,
  Layers,
  FileSearch,
  AlertTriangle,
  Clock,
  TrendingUp,
  MessageSquare,
  Scale,
  Sparkles,
} from "lucide-react";
import WorkspaceCard from "./WorkspaceCard";

// ─── Labels & icons ──────────────────────────────────

const MODULE_LABEL: Record<string, string> = {
  demandiq: "DemandIQ",
  revieweriq: "ReviewerIQ",
  evaluateiq: "EvaluateIQ",
  negotiateiq: "NegotiateIQ",
  intake: "Intake",
  platform: "Platform",
};

const MODULE_COLOR: Record<string, string> = {
  demandiq: "bg-primary/15 text-primary",
  revieweriq: "bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))]",
  evaluateiq: "bg-[hsl(var(--status-attention))]/15 text-[hsl(var(--status-attention))]",
  negotiateiq: "bg-[hsl(var(--status-review))]/15 text-[hsl(var(--status-review))]",
  intake: "bg-accent text-muted-foreground",
  platform: "bg-accent text-muted-foreground",
};

const ENTITY_ICON: Record<string, React.ElementType> = {
  extracted_fact: FileSearch,
  issue_flag: AlertTriangle,
  chronology_event: Clock,
  valuation_driver: TrendingUp,
  negotiation_rationale: MessageSquare,
  litigation_support: Scale,
  general: Sparkles,
};

const ENTITY_LABEL: Record<string, string> = {
  extracted_fact: "Extracted Facts",
  issue_flag: "Issue Flags",
  chronology_event: "Chronology Events",
  valuation_driver: "Valuation Drivers",
  negotiation_rationale: "Negotiation Rationale",
  litigation_support: "Litigation Support",
  general: "General",
};

// ─── Data hook ───────────────────────────────────────

interface AnchorSummary {
  totalAnchors: number;
  byModule: Record<string, number>;
  byEntityType: Record<string, number>;
}

function useCitationSummary(caseId: string | undefined) {
  return useQuery({
    queryKey: ["citation-summary", caseId],
    enabled: !!caseId,
    queryFn: async (): Promise<AnchorSummary> => {
      if (!caseId) return { totalAnchors: 0, byModule: {}, byEntityType: {} };

      const { data, error } = await (supabase.from("evidence_references") as any)
        .select("anchor_module, anchor_entity_type")
        .eq("case_id", caseId);

      if (error) throw error;

      const rows = (data ?? []) as { anchor_module: string | null; anchor_entity_type: string | null }[];

      const byModule: Record<string, number> = {};
      const byEntityType: Record<string, number> = {};

      for (const row of rows) {
        const mod = row.anchor_module ?? "platform";
        const ent = row.anchor_entity_type ?? "general";
        byModule[mod] = (byModule[mod] ?? 0) + 1;
        byEntityType[ent] = (byEntityType[ent] ?? 0) + 1;
      }

      return { totalAnchors: rows.length, byModule, byEntityType };
    },
    staleTime: 30_000,
  });
}

// ─── Component ───────────────────────────────────────

interface CitationSummaryPanelProps {
  caseId: string;
}

const CitationSummaryPanel = ({ caseId }: CitationSummaryPanelProps) => {
  const { data: summary, isLoading } = useCitationSummary(caseId);

  if (isLoading) {
    return (
      <WorkspaceCard icon={Fingerprint} title="Evidence Citations">
        <div className="px-5 py-6 text-center">
          <div className="h-4 w-32 bg-accent animate-pulse rounded mx-auto" />
        </div>
      </WorkspaceCard>
    );
  }

  if (!summary || summary.totalAnchors === 0) {
    return (
      <WorkspaceCard icon={Fingerprint} title="Evidence Citations">
        <div className="px-5 py-6 text-center">
          <p className="text-xs text-muted-foreground">No evidence anchors recorded for this case yet.</p>
        </div>
      </WorkspaceCard>
    );
  }

  const moduleEntries = Object.entries(summary.byModule).sort((a, b) => b[1] - a[1]);
  const entityEntries = Object.entries(summary.byEntityType).sort((a, b) => b[1] - a[1]);

  return (
    <WorkspaceCard
      icon={Fingerprint}
      title="Evidence Citations"
      count={summary.totalAnchors}
      tabs={[
        { key: "module", label: "By Module" },
        { key: "entity", label: "By Type" },
      ]}
    >
      {(tab: string) =>
        tab === "module" ? (
          <div className="px-5 py-4 space-y-2">
            {moduleEntries.map(([mod, count]) => {
              const pct = Math.round((count / summary.totalAnchors) * 100);
              return (
                <div key={mod} className="flex items-center gap-3">
                  <Layers className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${MODULE_COLOR[mod] ?? "bg-accent text-muted-foreground"}`}>
                    {MODULE_LABEL[mod] ?? mod}
                  </span>
                  <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground tabular-nums w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-5 py-4 space-y-2">
            {entityEntries.map(([ent, count]) => {
              const Icon = ENTITY_ICON[ent] ?? Sparkles;
              const pct = Math.round((count / summary.totalAnchors) * 100);
              return (
                <div key={ent} className="flex items-center gap-3">
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-foreground font-medium flex-shrink-0 w-36 truncate">
                    {ENTITY_LABEL[ent] ?? ent.replace(/_/g, " ")}
                  </span>
                  <div className="flex-1 h-1.5 bg-accent rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/40 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground tabular-nums w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        )
      }
    </WorkspaceCard>
  );
};

export default CitationSummaryPanel;
