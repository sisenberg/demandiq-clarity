import { EvaluateModuleState, getEvaluateCTA } from "@/types/evaluateiq";
import {
  Save,
  RefreshCw,
  CheckCircle2,
  Eye,
  Play,
  RotateCcw,
  Send,
  Lock,
  ShieldCheck,
  Loader2,
} from "lucide-react";

interface Props {
  moduleState: EvaluateModuleState;
  onCTA: () => void;
  isPending: boolean;
  onAccept?: () => void;
  onPublish?: () => void;
  isAccepted?: boolean;
}

const EvalStickyActions = ({ moduleState, onCTA, isPending, onAccept, onPublish, isAccepted }: Props) => {
  const cta = getEvaluateCTA(moduleState);
  const isActive = moduleState !== EvaluateModuleState.NotStarted
    && moduleState !== EvaluateModuleState.Completed
    && moduleState !== EvaluateModuleState.Published;
  const isCompleted = moduleState === EvaluateModuleState.Completed;
  const isPublished = moduleState === EvaluateModuleState.Published;
  // Show accept/publish actions for active evaluations (valued or in-review)
  const canAcceptPublish = isActive || isCompleted;

  if (!isActive && !isCompleted && !isPublished) return null;

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
            </>
          )}

          {isCompleted && !isAccepted && (
            <button
              onClick={onAccept}
              className="btn-secondary"
            >
              <ShieldCheck className="h-3 w-3" /> Accept Package
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* State indicator */}
          {isPublished && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
              <Send className="h-3.5 w-3.5" /> Published
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[hsl(var(--status-approved))]">
              <CheckCircle2 className="h-3.5 w-3.5" /> Evaluation Complete
            </span>
          )}

          {/* Publish button */}
          {isCompleted && (
            <button
              onClick={onPublish}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Send className="h-3 w-3" /> Publish Package
            </button>
          )}

          {/* Primary CTA */}
          {cta && (
            <button
              onClick={onCTA}
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : cta.action === "start" ? (
                <Play className="h-3.5 w-3.5" />
              ) : cta.action === "resume" ? (
                <RotateCcw className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EvalStickyActions;
