/**
 * DocumentProcessingStatePanel
 *
 * Shows the 8-state processing pipeline, state transition history,
 * processing runs with structured error details, and reprocess action.
 */

import { useState } from "react";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Clock,
  AlertTriangle,
  History,
} from "lucide-react";
import {
  PROCESSING_STATES,
  PROCESSING_STATE_LABEL,
  getStateIndex,
  type ProcessingRun,
  type StateTransition,
} from "@/lib/documentStateMachine";
import {
  useDocumentStateHistory,
  useDocumentProcessingRuns,
  useReprocessDocument,
} from "@/hooks/useDocumentProcessingState";

interface DocumentProcessingStatePanelProps {
  documentId: string;
  caseId: string;
  currentStage: string;
  documentStatus: string;
}

const RUN_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  queued: { bg: "bg-accent", text: "text-muted-foreground", label: "Queued" },
  running: { bg: "bg-[hsl(var(--status-processing-bg))]", text: "text-[hsl(var(--status-processing-foreground))]", label: "Running" },
  completed: { bg: "bg-[hsl(var(--status-approved-bg))]", text: "text-[hsl(var(--status-approved-foreground))]", label: "Completed" },
  failed: { bg: "bg-destructive/10", text: "text-destructive", label: "Failed" },
  partial: { bg: "bg-[hsl(var(--status-attention-bg))]", text: "text-[hsl(var(--status-attention-foreground))]", label: "Partial" },
};

// Map pipeline_stage values to our processing states for display
function mapToProcessingState(stage: string): string {
  const stageMap: Record<string, string> = {
    upload_received: "uploaded",
    ocr_queued: "queued",
    ocr_complete: "parsed",
    document_classified: "parsed",
    extraction_complete: "extraction_ready",
    evidence_links_created: "extraction_ready",
    review_items_generated: "extraction_ready",
    // Direct matches
    uploaded: "uploaded",
    validated: "validated",
    queued: "queued",
    processing: "processing",
    parsed: "parsed",
    chunked: "chunked",
    indexed: "indexed",
    extraction_ready: "extraction_ready",
  };
  return stageMap[stage] || stage;
}

const DocumentProcessingStatePanel = ({
  documentId,
  caseId,
  currentStage,
  documentStatus,
}: DocumentProcessingStatePanelProps) => {
  const [showHistory, setShowHistory] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  const { data: transitions = [] } = useDocumentStateHistory(documentId);
  const { data: runs = [] } = useDocumentProcessingRuns(documentId);
  const reprocess = useReprocessDocument();

  const mappedStage = mapToProcessingState(currentStage);
  const currentIdx = getStateIndex(mappedStage);
  const isFailed = documentStatus === "failed" || mappedStage === "failed";
  const activeStates = PROCESSING_STATES.filter((s) => s !== "failed");

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Processing Pipeline
        </h2>
        {isFailed && (
          <button
            onClick={() =>
              reprocess.mutate({ documentId, caseId, currentStage })
            }
            disabled={reprocess.isPending}
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {reprocess.isPending ? "Reprocessing…" : "Reprocess"}
          </button>
        )}
      </div>

      {/* State Pipeline */}
      <div className="px-5 py-4">
        <div className="flex flex-col gap-0">
          {activeStates.map((state, idx) => {
            const stateIdx = getStateIndex(state);
            const isComplete = stateIdx < currentIdx && !isFailed;
            const isCurrent = stateIdx === currentIdx && !isFailed;
            const isFailedStage = stateIdx === currentIdx && isFailed;
            const isPending = stateIdx > currentIdx || (isFailed && stateIdx > currentIdx);

            return (
              <div key={state} className="flex items-center gap-3 py-1.5">
                {isComplete ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-[hsl(var(--status-approved))]" />
                ) : isFailedStage ? (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                ) : isCurrent ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[hsl(var(--status-processing))]" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <span
                  className={`text-xs ${
                    isComplete
                      ? "text-foreground"
                      : isCurrent
                      ? "text-foreground font-medium"
                      : isFailedStage
                      ? "text-destructive font-medium"
                      : "text-muted-foreground"
                  }`}
                >
                  {PROCESSING_STATE_LABEL[state]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* State Transition History (collapsible) */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-accent/30 transition-colors"
        >
          {showHistory ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <History className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            State History ({transitions.length})
          </span>
        </button>
        {showHistory && (
          <div className="px-5 pb-4">
            {transitions.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No state transitions recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {transitions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 py-1 text-[10px]"
                  >
                    <Clock className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                    <span className="text-muted-foreground shrink-0">
                      {new Date(t.created_at).toLocaleString()}
                    </span>
                    <span className="text-muted-foreground">
                      {t.from_status || "—"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">
                      {t.to_status}
                    </span>
                    <span className="text-muted-foreground/60 truncate">
                      by {t.triggered_by === "system" ? "system" : "user"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Processing Runs (collapsible) */}
      <div className="border-t border-border">
        <button
          onClick={() => setShowRuns(!showRuns)}
          className="w-full px-5 py-3 flex items-center gap-2 text-left hover:bg-accent/30 transition-colors"
        >
          {showRuns ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Processing Runs ({runs.length})
          </span>
        </button>
        {showRuns && (
          <div className="px-5 pb-4">
            {runs.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic">
                No processing runs recorded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto">
                {runs.map((run) => (
                  <RunCard key={run.id} run={run} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function RunCard({ run }: { run: ProcessingRun }) {
  const style = RUN_STATUS_STYLES[run.run_status] ?? RUN_STATUS_STYLES.queued;
  const hasFailed = run.run_status === "failed";

  return (
    <div
      className={`rounded-lg border p-3 ${
        hasFailed ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-foreground">
            Run #{run.run_number}
          </span>
          <span
            className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}
          >
            {style.label}
          </span>
          <span className="text-[9px] text-muted-foreground capitalize">
            {run.trigger_reason}
          </span>
        </div>
        <span className="text-[9px] text-muted-foreground">
          {new Date(run.created_at).toLocaleString()}
        </span>
      </div>

      {hasFailed && (
        <div className="mt-2 space-y-1">
          {run.error_code && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
              <code className="text-[10px] text-destructive font-mono">
                {run.error_code}
              </code>
            </div>
          )}
          {run.error_message && (
            <p className="text-[10px] text-destructive/80">
              {run.error_message}
            </p>
          )}
          {run.failure_stage && (
            <p className="text-[9px] text-muted-foreground">
              Failed at: <span className="font-medium">{run.failure_stage}</span>
            </p>
          )}
          {run.provider && (
            <p className="text-[9px] text-muted-foreground">
              Provider: <span className="font-medium">{run.provider}</span>
            </p>
          )}
        </div>
      )}

      {run.started_at && run.completed_at && (
        <p className="text-[9px] text-muted-foreground mt-1">
          Duration:{" "}
          {(
            (new Date(run.completed_at).getTime() -
              new Date(run.started_at).getTime()) /
            1000
          ).toFixed(1)}
          s
        </p>
      )}
    </div>
  );
}

export default DocumentProcessingStatePanel;
