import React from "react";
import { Case, CaseDocument, DocumentStatus } from "@/types";

interface CaseSidebarNavProps {
  caseData: Case;
  documents: CaseDocument[];
  activeTab: "chronology" | "documents" | "issues";
  onTabChange: (tab: "chronology" | "documents" | "issues") => void;
}

const docStatusLabel: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploading]: "Uploading",
  [DocumentStatus.Processing]: "Processing",
  [DocumentStatus.Extracted]: "Extracted",
  [DocumentStatus.ReviewNeeded]: "Review Needed",
  [DocumentStatus.Verified]: "Verified",
  [DocumentStatus.Error]: "Error",
};

const docStatusClass: Record<DocumentStatus, string> = {
  [DocumentStatus.Uploading]: "status-badge-draft",
  [DocumentStatus.Processing]: "status-badge-draft",
  [DocumentStatus.Extracted]: "status-badge-draft",
  [DocumentStatus.ReviewNeeded]: "status-badge-review",
  [DocumentStatus.Verified]: "status-badge-approved",
  [DocumentStatus.Error]: "text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/30",
};

const tabs = [
  { key: "chronology" as const, label: "Chronology" },
  { key: "documents" as const, label: "Documents" },
  { key: "issues" as const, label: "Issues" },
];

const CaseSidebarNav: React.FC<CaseSidebarNavProps> = ({
  caseData,
  documents,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex flex-col h-full">
      {/* Case header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground leading-tight mb-1">
          {caseData.title}
        </h3>
        <span className="text-xs font-mono text-muted-foreground">
          {caseData.claimNumber}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Document list (shown when documents tab is active or always as secondary nav) */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Source Documents
          </span>
        </div>
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="px-4 py-2.5 border-b border-border hover:bg-accent/50 cursor-pointer"
          >
            <div className="text-xs font-medium text-foreground truncate mb-1">
              {doc.fileName}
            </div>
            <div className="flex items-center gap-2">
              <span className={docStatusClass[doc.status]}>
                {docStatusLabel[doc.status]}
              </span>
              {doc.pageCount && (
                <span className="text-xs text-muted-foreground">
                  {doc.pageCount} pages
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CaseSidebarNav;
