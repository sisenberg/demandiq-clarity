import { CheckCircle, Circle, Loader2, XCircle } from "lucide-react";
import { PIPELINE_STAGES_ORDERED } from "@/lib/statuses";

const PIPELINE_STAGES = PIPELINE_STAGES_ORDERED;

interface ProcessingPipelineProps {
  currentStage: string;
  documentStatus: string;
}

const ProcessingPipeline = ({ currentStage, documentStatus }: ProcessingPipelineProps) => {
  const currentIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentStage);
  const isFailed = documentStatus === "failed";

  return (
    <div className="flex flex-col gap-0">
      {PIPELINE_STAGES.map((stage, idx) => {
        const isComplete = idx < currentIdx || (idx === currentIdx && !isFailed && documentStatus === "complete");
        const isCurrent = idx === currentIdx && !isFailed;
        const isFailedStage = idx === currentIdx && isFailed;
        const isPending = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-3 py-1.5">
            {isComplete ? (
              <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--status-approved))" }} />
            ) : isFailedStage ? (
              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
            ) : isCurrent ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: "hsl(var(--status-processing))" }} />
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
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export { PIPELINE_STAGES };
export default ProcessingPipeline;
