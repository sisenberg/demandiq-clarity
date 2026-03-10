import type { WorkflowPhase, PhaseState } from "@/lib/workflow";
import { getPhaseStates, CASE_STATUS_LABEL, CASE_STATUS_BADGE } from "@/lib/workflow";
import type { CaseStatus } from "@/types";
import { FileText, Cog, ClipboardCheck, Package } from "lucide-react";

const phaseConfig: Record<WorkflowPhase, { label: string; icon: React.ElementType }> = {
  intake: { label: "Intake", icon: FileText },
  processing: { label: "Processing", icon: Cog },
  review: { label: "Review", icon: ClipboardCheck },
  package: { label: "Package", icon: Package },
};

const stateStyles: Record<PhaseState, { dot: string; line: string; text: string }> = {
  pending: {
    dot: "border-border bg-background",
    line: "bg-border",
    text: "text-muted-foreground",
  },
  active: {
    dot: "border-primary bg-primary",
    line: "bg-primary/30",
    text: "text-foreground",
  },
  complete: {
    dot: "border-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved))]",
    line: "bg-[hsl(var(--status-approved))]",
    text: "text-foreground",
  },
  failed: {
    dot: "border-destructive bg-destructive",
    line: "bg-destructive/30",
    text: "text-destructive",
  },
};

const stateLabel: Record<PhaseState, string> = {
  pending: "Pending",
  active: "Active",
  complete: "Complete",
  failed: "Failed",
};

const WorkflowPanel = ({ caseStatus }: { caseStatus: CaseStatus }) => {
  const phases = getPhaseStates(caseStatus);
  const phaseOrder: WorkflowPhase[] = ["intake", "processing", "review", "package"];

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Workflow Progress</h3>
        <span className={CASE_STATUS_BADGE[caseStatus]}>{CASE_STATUS_LABEL[caseStatus]}</span>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-start justify-between relative">
          {/* Connecting line */}
          <div className="absolute top-[14px] left-[28px] right-[28px] h-px bg-border" />

          {phaseOrder.map((phase, i) => {
            const state = phases[phase];
            const styles = stateStyles[state];
            const config = phaseConfig[phase];
            const Icon = config.icon;

            return (
              <div key={phase} className="flex flex-col items-center gap-2 relative z-10 flex-1">
                {/* Progress dot */}
                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center ${styles.dot}`}>
                  <Icon className={`h-3 w-3 ${state === "pending" ? "text-muted-foreground" : "text-background"}`} />
                </div>
                {/* Label */}
                <div className="text-center">
                  <p className={`text-xs font-medium ${styles.text}`}>{config.label}</p>
                  <p className="text-[10px] text-muted-foreground">{stateLabel[state]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkflowPanel;
