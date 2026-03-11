import { useState } from "react";
import { CheckCircle2, AlertTriangle, RotateCcw, Package, X } from "lucide-react";
import {
  useModuleCompletion,
  useCompleteModule,
  useReopenModule,
  validateDemandCompletion,
  MODULE_COMPLETION_LABELS,
  COMPLETION_STATUS_LABEL,
  COMPLETION_STATUS_BADGE,
  useModuleSnapshots,
} from "@/hooks/useModuleCompletion";
import { useUpdateCaseStatus } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { ModuleCompletionStatus } from "@/types";

interface CompleteDemandDialogProps {
  caseId: string;
  caseStatus: string;
  documents: { document_status: string; file_name: string }[];
  open: boolean;
  onClose: () => void;
}

const CompleteDemandDialog = ({
  caseId,
  caseStatus,
  documents,
  open,
  onClose,
}: CompleteDemandDialogProps) => {
  const { role } = useAuth();
  const moduleId = "demandiq";
  const labels = MODULE_COMPLETION_LABELS[moduleId];

  const { data: completion } = useModuleCompletion(caseId, moduleId);
  const { data: snapshots = [] } = useModuleSnapshots(caseId, moduleId);
  const completeModule = useCompleteModule();
  const reopenModule = useReopenModule();
  const updateCaseStatus = useUpdateCaseStatus();

  const [confirming, setConfirming] = useState(false);

  const validation = validateDemandCompletion(documents, caseStatus);
  const isCompleted = completion?.status === ModuleCompletionStatus.Completed;
  const isReopened = completion?.status === ModuleCompletionStatus.Reopened;
  const canComplete = hasPermission(role, "complete_module");
  const canReopen = hasPermission(role, "complete_module");

  const handleComplete = async () => {
    if (!validation.valid || !canComplete) return;

    // Build typed snapshot payload
    const snapshotData = {
      contract_version: "1.0.0",
      module_id: moduleId,
      completed_at: new Date().toISOString(),
      case_summary: {
        case_status: caseStatus,
        document_count: documents.length,
        completed_documents: documents.filter(
          (d) => d.document_status === "complete" || d.document_status === "extracted"
        ).length,
        injury_count: 0,
        provider_count: 0,
        total_billed: 0,
        total_paid: 0,
      },
      module_output: {
        document_names: documents.map((d) => d.file_name),
      },
    };

    await completeModule.mutateAsync({ caseId, moduleId, snapshotData });
    // Also transition the case status to "exported" (Demand Completed)
    await updateCaseStatus.mutateAsync({ caseId, status: "exported" });
    setConfirming(false);
    onClose();
  };

  const handleReopen = async () => {
    if (!canReopen) return;
    await reopenModule.mutateAsync({ caseId, moduleId });
    // Revert case status back to "complete"
    await updateCaseStatus.mutateAsync({ caseId, status: "complete" });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Package className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">{labels.noun} Completion</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current status */}
          {completion && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Status</span>
              <div className="flex items-center gap-2">
                <span className={COMPLETION_STATUS_BADGE[completion.status] ?? "status-badge-draft"}>
                  {COMPLETION_STATUS_LABEL[completion.status] ?? completion.status}
                </span>
                {completion.version > 1 && (
                  <span className="text-[10px] text-muted-foreground font-medium">v{completion.version}</span>
                )}
              </div>
            </div>
          )}

          {/* Validation checks */}
          {!isCompleted && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completion Requirements</p>
              <div className="space-y-1.5">
                {[
                  { label: "Case status is Complete", met: caseStatus === "complete" || caseStatus === "exported" },
                  { label: "At least one document uploaded", met: documents.length > 0 },
                  {
                    label: "At least one document fully processed",
                    met: documents.some((d) => d.document_status === "complete" || d.document_status === "extracted"),
                  },
                ].map((req) => (
                  <div key={req.label} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
                    )}
                    <span className={req.met ? "text-foreground" : "text-muted-foreground"}>{req.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Validation errors */}
          {!isCompleted && validation.errors.length > 0 && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
              <p className="text-xs font-medium text-destructive mb-1">Cannot complete:</p>
              <ul className="text-xs text-destructive/80 space-y-0.5">
                {validation.errors.map((e) => (
                  <li key={e}>• {e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Completed state info */}
          {isCompleted && (
            <div className="rounded-lg bg-[hsl(var(--status-approved))]/10 border border-[hsl(var(--status-approved))]/20 px-4 py-3">
              <p className="text-sm font-medium text-foreground mb-1">
                {labels.noun} completed — v{completion!.version}
              </p>
              <p className="text-xs text-muted-foreground">
                Completed {completion!.completed_at ? new Date(completion!.completed_at).toLocaleString() : ""}
              </p>
              {snapshots.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} available for downstream modules.
                </p>
              )}
            </div>
          )}

          {/* Snapshot history */}
          {snapshots.length > 1 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Version History</p>
              {snapshots.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-accent/50">
                  <span className="font-medium text-foreground">v{s.version}</span>
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          {isCompleted && canReopen ? (
            <>
              <button
                onClick={handleReopen}
                disabled={reopenModule.isPending}
                className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reopen
              </button>
              <button onClick={onClose} className="text-xs font-medium px-3.5 py-2 rounded-lg bg-accent text-foreground hover:bg-accent/80 transition-colors">
                Close
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="text-xs font-medium px-3.5 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors">
                Cancel
              </button>
              {!confirming ? (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!validation.valid || !canComplete || isCompleted}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> {labels.action}
                </button>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={completeModule.isPending || updateCaseStatus.isPending}
                  className="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-lg bg-[hsl(var(--status-approved))] text-white hover:opacity-90 transition-colors disabled:opacity-50 shadow-sm"
                >
                  {completeModule.isPending ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Confirm Completion
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompleteDemandDialog;
