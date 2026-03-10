import React from "react";
import { Case, CaseStatus } from "@/types";

interface CaseListProps {
  cases: Case[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}

const statusLabel: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "Intake",
  [CaseStatus.Extraction]: "Extraction",
  [CaseStatus.Review]: "Review",
  [CaseStatus.Approved]: "Approved",
  [CaseStatus.Exported]: "Exported",
  [CaseStatus.Archived]: "Archived",
};

const statusClass: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "status-badge-draft",
  [CaseStatus.Extraction]: "status-badge-draft",
  [CaseStatus.Review]: "status-badge-review",
  [CaseStatus.Approved]: "status-badge-approved",
  [CaseStatus.Exported]: "status-badge-approved",
  [CaseStatus.Archived]: "status-badge-draft",
};

const CaseList: React.FC<CaseListProps> = ({ cases, selectedCaseId, onSelectCase }) => {
  return (
    <div className="flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cases
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cases.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCase(c.id)}
            className={`w-full text-left px-4 py-3 border-b border-border transition-colors ${
              selectedCaseId === c.id
                ? "bg-accent"
                : "hover:bg-accent/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-foreground leading-tight line-clamp-2">
                {c.title}
              </span>
              <span className={statusClass[c.status]}>
                {statusLabel[c.status]}
              </span>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {c.claimNumber}
            </span>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span>{c.documentCount} docs</span>
              <span>{c.eventCount} events</span>
              {c.issueCount > 0 && (
                <span className="text-status-review-foreground font-medium">
                  {c.issueCount} issues
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CaseList;
