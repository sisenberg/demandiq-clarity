import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { EvaluateModuleState, EVALUATE_STATE_LABEL, EVALUATE_STATE_BADGE_CLASS } from "@/types/evaluateiq";
import { Calculator, Clock } from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
  moduleState: EvaluateModuleState;
  caseNumber: string;
  claimVsInsured: string;
}

const EvalSummaryHeader = ({ snapshot, moduleState, caseNumber, claimVsInsured }: Props) => {
  const claimantName = snapshot.claimant.claimant_name.value || "Unknown Claimant";
  const lossDate = snapshot.accident.date_of_loss.value;
  const sourceLabel = snapshot.source_module === "revieweriq" ? "ReviewerIQ" : "DemandIQ";

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Calculator className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-foreground truncate">{claimantName}</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {claimVsInsured} · {caseNumber}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md border ${EVALUATE_STATE_BADGE_CLASS[moduleState]} border-current/15 bg-current/5`}>
            {EVALUATE_STATE_LABEL[moduleState]}
          </span>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
        <MetaChip label="Loss Date" value={lossDate ? new Date(lossDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
        <MetaChip label="Source" value={`${sourceLabel} v${snapshot.source_package_version}`} />
        <MetaChip label="Jurisdiction" value={snapshot.venue_jurisdiction.jurisdiction_state.value || "—"} />
        <MetaChip label="Completeness" value={`${snapshot.overall_completeness_score}%`} />
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Updated {new Date(snapshot.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
};

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium text-foreground">{value}</span>
    </div>
  );
}

export default EvalSummaryHeader;
