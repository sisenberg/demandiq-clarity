import { EvaluateModuleState, getEvaluateCTA } from "@/types/evaluateiq";
import {
  Save,
  RefreshCw,
  CheckCircle2,
  Eye,
  Play,
  RotateCcw,
} from "lucide-react";

interface Props {
  moduleState: EvaluateModuleState;
  onCTA: () => void;
  isPending: boolean;
}

const EvalStickyActions = ({ moduleState, onCTA, isPending }: Props) => {
  const cta = getEvaluateCTA(moduleState);
  const isActive = moduleState !== EvaluateModuleState.NotStarted && moduleState !== EvaluateModuleState.Completed;

  if (!isActive && moduleState !== EvaluateModuleState.Completed) return null;

  return (
    <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur-md px-6 py-3">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          {isActive && (
            <>
              <button className="btn-secondary" disabled>
                <Save className="h-3 w-3" /> Save Draft
              </button>
              <button className="btn-ghost" disabled>
                <RefreshCw className="h-3 w-3" /> Refresh Inputs
              </button>
              <button className="btn-ghost" disabled>
                <Eye className="h-3 w-3" /> Mark Ready for Review
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {moduleState === EvaluateModuleState.Completed && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--status-approved))]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Evaluation Complete
            </span>
          )}

          {cta && (
            <button
              onClick={onCTA}
              disabled={isPending}
              className="btn-primary"
            >
              {cta.action === "start" && <Play className="h-3.5 w-3.5" />}
              {cta.action === "resume" && <RotateCcw className="h-3.5 w-3.5" />}
              {cta.action === "complete" && <CheckCircle2 className="h-3.5 w-3.5" />}
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvalStickyActions;
