import {
  CheckCircle2,
  Clock,
  ArrowRight,
  Lock,
  ChevronDown,
  ChevronUp,
  Package,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import {
  useModuleCompletion,
  useModuleSnapshots,
  COMPLETION_STATUS_LABEL,
  COMPLETION_STATUS_BADGE,
  MODULE_COMPLETION_LABELS,
} from "@/hooks/useModuleCompletion";
import {
  useModuleDependencies,
  useCaseDependencyStates,
  getDependencyStatus,
  getDownstreamModules,
} from "@/hooks/useModuleDependencies";
import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { getModule } from "@/lib/modules";
import { ModuleCompletionStatus, DependencyStatus } from "@/types";

interface ModuleCompletionStatusPanelProps {
  caseId: string;
  moduleId: string;
  onCompleteClick?: () => void;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
  );
}

const ModuleCompletionStatusPanel = ({
  caseId,
  moduleId,
  onCompleteClick,
}: ModuleCompletionStatusPanelProps) => {
  const { entitlements, profile } = useAuth();
  const { data: completion } = useModuleCompletion(caseId, moduleId);
  const { data: snapshots = [] } = useModuleSnapshots(caseId, moduleId);
  const { data: depStates = [] } = useCaseDependencyStates(caseId);
  const { data: allDeps = [] } = useModuleDependencies();
  const [showHistory, setShowHistory] = useState(false);

  const labels = MODULE_COMPLETION_LABELS[moduleId] ?? { action: "Complete", noun: moduleId };
  const isCompleted = completion?.status === ModuleCompletionStatus.Completed;
  const isReopened = completion?.status === ModuleCompletionStatus.Reopened;
  const hasCompletion = !!completion;
  const status = completion?.status ?? ModuleCompletionStatus.NotStarted;

  // Derive downstream modules from the dependency graph — not hardcoded
  const downstreamIds = getDownstreamModules(allDeps, moduleId);
  const downstreamModules = downstreamIds
    .map((id) => {
      const def = getModule(id);
      return def ? { id: def.id, label: def.label, desc: def.description } : null;
    })
    .filter(Boolean) as { id: string; label: string; desc: string }[];

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">{labels.noun} Status</h3>
        </div>
        <span className={COMPLETION_STATUS_BADGE[status] ?? "status-badge-draft"}>
          {COMPLETION_STATUS_LABEL[status] ?? status}
        </span>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Summary row */}
        {hasCompletion ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Version</p>
              <p className="text-sm font-semibold text-foreground">v{completion!.version}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
                {isReopened ? "Reopened" : "Completed"}
              </p>
              <p className="text-xs text-foreground">
                {isReopened
                  ? formatDateTime(completion!.reopened_at)
                  : formatDateTime(completion!.completed_at)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">By</p>
              <p className="text-xs text-foreground truncate">
                {profile?.display_name ?? "—"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Not yet completed. {labels.action} to finalize and enable downstream modules.</span>
          </div>
        )}

        {/* Reopened warning with stale downstream notice */}
        {isReopened && (
          <div className="rounded-lg bg-[hsl(var(--status-attention))]/10 border border-[hsl(var(--status-attention))]/20 px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))] shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-medium text-foreground">{labels.noun} has been reopened</p>
              <p className="text-muted-foreground mt-0.5">
                Downstream modules consuming the previous snapshot are now stale. Re-complete to update them.
              </p>
            </div>
          </div>
        )}

        {/* Version history */}
        {snapshots.length > 1 && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {snapshots.length} version{snapshots.length !== 1 ? "s" : ""}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-1">
                {snapshots.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-xs px-3 py-1.5 rounded-md bg-accent/40"
                  >
                    <span className="font-medium text-foreground">v{s.version}</span>
                    <span className="text-muted-foreground">{formatDateTime(s.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Downstream handoff — derived from dependency graph */}
        {downstreamModules.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
              Downstream Modules
            </p>
            <div className="space-y-1.5">
              {downstreamModules.map((mod) => {
                const isEntitled = isEntitlementActive(entitlements, mod.id);
                const isAvailable = isCompleted && isEntitled;
                const depState = getDependencyStatus(depStates, mod.id, moduleId);
                const isStale = depState?.dependency_status === DependencyStatus.StaleDueToUpstreamChange;
                const needsRefresh = depState?.dependency_status === DependencyStatus.RefreshNeeded;
                const isCurrent = depState?.dependency_status === DependencyStatus.Current;

                return (
                  <div
                    key={mod.id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                      isStale || needsRefresh
                        ? "bg-[hsl(var(--status-attention))]/8 border border-[hsl(var(--status-attention))]/15"
                        : isAvailable
                          ? "bg-[hsl(var(--status-approved))]/8 border border-[hsl(var(--status-approved))]/15"
                          : "bg-accent/30"
                    }`}
                  >
                    {/* Status icon */}
                    {isStale ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))] shrink-0" />
                    ) : needsRefresh ? (
                      <RefreshCw className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : isAvailable ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))] shrink-0" />
                    ) : isEntitled ? (
                      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}

                    {/* Label + status text */}
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium ${isAvailable || isStale ? "text-foreground" : "text-muted-foreground"}`}>
                        {mod.label}
                      </span>
                      {!isEntitled && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">· Not licensed</span>
                      )}
                      {isEntitled && !isCompleted && !isReopened && (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">· Awaiting completed snapshot</span>
                      )}
                      {isStale && (
                        <span className="ml-1.5 text-[10px] text-[hsl(var(--status-attention))]">
                          · Stale — upstream changed
                          {depState?.upstream_snapshot_version && ` (using v${depState.upstream_snapshot_version})`}
                        </span>
                      )}
                      {needsRefresh && (
                        <span className="ml-1.5 text-[10px] text-destructive">· Refresh needed</span>
                      )}
                      {isCurrent && isAvailable && (
                        <span className="ml-1.5 text-[10px] text-[hsl(var(--status-approved))]">
                          · Current (v{depState?.upstream_snapshot_version})
                        </span>
                      )}
                      {isAvailable && !depState && (
                        <span className="ml-1.5 text-[10px] text-[hsl(var(--status-approved))]">· Ready</span>
                      )}
                    </div>

                    {isAvailable && isCurrent && <ArrowRight className="h-3 w-3 text-[hsl(var(--status-approved))] shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA if not completed */}
        {!isCompleted && onCompleteClick && (
          <button
            onClick={onCompleteClick}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {labels.action}
          </button>
        )}
      </div>
    </div>
  );
};

export default ModuleCompletionStatusPanel;
