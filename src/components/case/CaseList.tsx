import type { Case } from "@/types";
import { CaseStatus } from "@/types";

interface CaseListProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

const statusLabel: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "Intake",
  [CaseStatus.Extraction]: "Extracting",
  [CaseStatus.Review]: "In Review",
  [CaseStatus.Approved]: "Approved",
  [CaseStatus.Exported]: "Exported",
  [CaseStatus.Archived]: "Archived",
};

const statusColor: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "bg-muted text-muted-foreground",
  [CaseStatus.Extraction]: "bg-primary/10 text-primary",
  [CaseStatus.Review]: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  [CaseStatus.Approved]: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  [CaseStatus.Exported]: "bg-muted text-muted-foreground",
  [CaseStatus.Archived]: "bg-muted text-muted-foreground",
};

const CaseList = ({ cases, selectedCaseId, onSelectCase }: CaseListProps) => {
  return (
    <div className="flex flex-col overflow-hidden flex-1">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cases
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          return (
            <button
              key={c.id}
              onClick={() => onSelectCase(c.id)}
              className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
                isSelected
                  ? "bg-accent"
                  : "hover:bg-accent/50"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.caseNumber}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${statusColor[c.status]}`}
                >
                  {statusLabel[c.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.claimant} v. {c.defendant}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CaseList;
