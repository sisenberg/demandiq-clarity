import type { Issue } from "@/types";
import { IssueSeverity, IssueStatus } from "@/types";

interface IssuesViewProps {
  issues: Issue[];
}

const severityConfig: Record<IssueSeverity, { label: string; className: string }> = {
  [IssueSeverity.Critical]: {
    label: "Critical",
    className: "bg-destructive/10 text-destructive",
  },
  [IssueSeverity.High]: {
    label: "High",
    className: "bg-destructive/10 text-destructive",
  },
  [IssueSeverity.Medium]: {
    label: "Medium",
    className: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  },
  [IssueSeverity.Low]: {
    label: "Low",
    className: "bg-muted text-muted-foreground",
  },
};

const issueStatusLabel: Record<IssueStatus, string> = {
  [IssueStatus.Open]: "Open",
  [IssueStatus.Acknowledged]: "Acknowledged",
  [IssueStatus.Resolved]: "Resolved",
  [IssueStatus.Dismissed]: "Dismissed",
};

const IssuesView = ({ issues }: IssuesViewProps) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground">Issues</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {issues.filter((i) => i.status === IssueStatus.Open).length} open ·{" "}
          {issues.length} total
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
        {issues.map((issue) => {
          const sev = severityConfig[issue.severity];
          return (
            <div
              key={issue.id}
              className="border border-border rounded-md px-4 py-3 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {issue.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {issue.description}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sev.className}`}
                  >
                    {sev.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {issueStatusLabel[issue.status]}
                  </span>
                </div>
              </div>
              {issue.source === "ai_flagged" && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  AI-flagged · {issue.evidenceRefs.length} evidence ref
                  {issue.evidenceRefs.length !== 1 && "s"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IssuesView;
