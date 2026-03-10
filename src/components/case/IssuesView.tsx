import React from "react";
import { Issue, IssueSeverity, IssueStatus } from "@/types";

interface IssuesViewProps {
  issues: Issue[];
}

const severityClass: Record<IssueSeverity, string> = {
  [IssueSeverity.Low]: "status-badge-draft",
  [IssueSeverity.Medium]: "status-badge-review",
  [IssueSeverity.High]:
    "text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30",
  [IssueSeverity.Critical]:
    "text-xs font-medium px-2 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/40 font-semibold",
};

const issueStatusLabel: Record<IssueStatus, string> = {
  [IssueStatus.Open]: "Open",
  [IssueStatus.UnderReview]: "Under Review",
  [IssueStatus.Resolved]: "Resolved",
  [IssueStatus.Dismissed]: "Dismissed",
};

const IssuesView: React.FC<IssuesViewProps> = ({ issues }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border">
        <h1 className="text-lg font-semibold text-foreground">Issues</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {issues.length} flagged issues
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="px-6 py-4 border-b border-border"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-medium text-foreground">
                {issue.title}
              </h3>
              <span className={severityClass[issue.severity]}>
                {issue.severity}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              {issue.description}
            </p>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
              <span>{issueStatusLabel[issue.status]}</span>
              <span>·</span>
              <span>Flagged {new Date(issue.flaggedAt).toLocaleDateString()}</span>
              <span>·</span>
              <span className="capitalize">{issue.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IssuesView;
