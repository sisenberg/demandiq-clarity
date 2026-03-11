import {
  CheckCircle2,
  Clock,
  User,
  ArrowRight,
  Lock,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import { useState } from "react";
import {
  useModuleCompletion,
  useModuleSnapshots,
  COMPLETION_STATUS_LABEL,
  COMPLETION_STATUS_BADGE,
  MODULE_COMPLETION_LABELS,
} from "@/hooks/useModuleCompletion";
import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleCompletionStatus } from "@/types";

interface ModuleCompletionStatusPanelProps {
  caseId: string;
  moduleId: string;
  onCompleteClick?: () => void;
}

const DOWNSTREAM_MODULES = [
  { id: "revieweriq", label: "ReviewerIQ", desc: "Medical review & billing analysis" },
  { id: "evaluateiq", label: "EvaluateIQ", desc: "Case valuation & assessment" },
  { id: "negotiateiq", label: "NegotiateIQ", desc: "Settlement negotiation support" },
  { id: "litiq", label: "LitIQ", desc: "Litigation preparation & strategy" },
];

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
  const [showHistory, setShowHistory] = useState(false);

  const labels = MODULE_COMPLETION_LABELS[moduleId] ?? { action: "Complete", noun: moduleId };
  const isCompleted = completion?.status === ModuleCompletionStatus.Completed;
  const isReopened = completion?.status === ModuleCompletionStatus.Reopened;
  const hasCompletion = !!completion;
  const status = completion?.status ?? ModuleCompletionStatus.NotStarted;

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

        {/* Downstream handoff */}
        <div className="border-t border-border pt-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Downstream Modules
          </p>
          <div className="space-y-1.5">
            {DOWNSTREAM_MODULES.map((mod) => {
              const isEntitled = isEntitlementActive(entitlements, mod.id);
              const isAvailable = isCompleted && isEntitled;
              return (
                <div
                  key={mod.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs ${
                    isAvailable
                      ? "bg-[hsl(var(--status-approved))]/8 border border-[hsl(var(--status-approved))]/15"
                      : "bg-accent/30"
                  }`}
                >
                  {isAvailable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))] shrink-0" />
                  ) : isEntitled ? (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`font-medium ${isAvailable ? "text-foreground" : "text-muted-foreground"}`}>
                      {mod.label}
                    </span>
                    {!isEntitled && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">· Not licensed</span>
                    )}
                    {isEntitled && !isCompleted && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">· Awaiting {labels.noun} completion</span>
                    )}
                    {isAvailable && (
                      <span className="ml-1.5 text-[10px] text-[hsl(var(--status-approved))]">· Ready</span>
                    )}
                  </div>
                  {isAvailable && <ArrowRight className="h-3 w-3 text-[hsl(var(--status-approved))] shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

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
