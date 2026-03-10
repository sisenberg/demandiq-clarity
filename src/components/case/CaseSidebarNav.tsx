import type { Case, CaseDocument } from "@/types";
import { CaseStatus, DocumentStatus } from "@/types";

type WorkspaceTab = "chronology" | "documents" | "issues";

interface CaseSidebarNavProps {
  caseData: Case;
  documents: CaseDocument[];
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}

const statusLabel: Record<CaseStatus, string> = {
  [CaseStatus.Intake]: "Intake",
  [CaseStatus.Extraction]: "Extracting",
  [CaseStatus.Review]: "In Review",
  [CaseStatus.Approved]: "Approved",
  [CaseStatus.Exported]: "Exported",
  [CaseStatus.Archived]: "Archived",
};

const tabs: { key: WorkspaceTab; label: string }[] = [
  { key: "chronology", label: "Chronology" },
  { key: "documents", label: "Documents" },
  { key: "issues", label: "Issues" },
];

const CaseSidebarNav = ({
  caseData,
  documents,
  activeTab,
  onTabChange,
}: CaseSidebarNavProps) => {
  const extractedCount = documents.filter(
    (d) => d.status === DocumentStatus.Extracted
  ).length;
  const pendingCount = documents.filter(
    (d) => d.status === DocumentStatus.Pending || d.status === DocumentStatus.Processing
  ).length;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Case header */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm font-semibold text-foreground leading-tight">
          {caseData.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {caseData.caseNumber} · {statusLabel[caseData.status]}
        </p>
      </div>

      {/* Stats */}
      <div className="px-4 py-3 border-b border-border grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Documents
          </p>
          <p className="text-sm font-medium text-foreground">
            {extractedCount} extracted
            {pendingCount > 0 && (
              <span className="text-muted-foreground"> · {pendingCount} pending</span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Date of Loss
          </p>
          <p className="text-sm font-medium text-foreground">{caseData.dateOfLoss}</p>
        </div>
      </div>

      {/* Tab nav */}
      <nav className="flex flex-col px-2 py-2 gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`text-left px-3 py-2 rounded text-sm transition-colors ${
              activeTab === tab.key
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default CaseSidebarNav;
