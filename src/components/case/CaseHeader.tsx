import { Link } from "react-router-dom";
import type { CaseRow } from "@/hooks/useCases";
import {
  ArrowLeft,
  Hash,
  Calendar,
  MapPin,
  User,
} from "lucide-react";

const CASE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake_in_progress: "Intake In Progress",
  intake_complete: "Intake Complete",
  processing_in_progress: "Processing",
  complete: "Complete",
  exported: "Demand Completed",
  closed: "Closed",
  failed: "Failed",
};

const CASE_STATUS_BADGE: Record<string, string> = {
  draft: "status-badge-draft",
  intake_in_progress: "status-badge-processing",
  intake_complete: "status-badge-approved",
  processing_in_progress: "status-badge-processing",
  complete: "status-badge-approved",
  exported: "status-badge-approved",
  closed: "status-badge-draft",
  failed: "status-badge-failed",
};

interface CaseHeaderProps {
  caseData: CaseRow;
  children?: React.ReactNode;
}

const CaseHeader = ({ caseData, children }: CaseHeaderProps) => {
  return (
    <header className="bg-card border-b border-border px-5 py-2.5 shrink-0">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {/* Back + Title */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/cases"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-100 shrink-0"
              title="Back to Cases"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <h1 className="text-[14px] font-semibold text-foreground tracking-tight truncate leading-none">
              {caseData.title || `${caseData.claimant} v. ${caseData.insured}`}
            </h1>
            <span className={CASE_STATUS_BADGE[caseData.case_status] ?? "status-badge-draft"}>
              {CASE_STATUS_LABEL[caseData.case_status] ?? caseData.case_status}
            </span>
          </div>

          {/* Meta chips */}
          <div className="flex items-center gap-3.5 ml-9 mt-1 flex-wrap">
            <MetaChip icon={Hash} label={caseData.case_number} />
            {caseData.claim_number && <MetaChip label={`Claim: ${caseData.claim_number}`} />}
            <MetaChip icon={User} label={caseData.claimant} />
            {caseData.date_of_loss && <MetaChip icon={Calendar} label={`DOI: ${caseData.date_of_loss}`} />}
            {caseData.jurisdiction_state && <MetaChip icon={MapPin} label={caseData.jurisdiction_state} />}
            {caseData.priority !== "normal" && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  caseData.priority === "urgent" || caseData.priority === "high"
                    ? "text-destructive"
                    : "text-muted-foreground"
                }`}
              >
                {caseData.priority}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 ml-4">
          {children}
        </div>
      </div>
    </header>
  );
};

function MetaChip({
  icon: Icon,
  label,
}: {
  icon?: React.ElementType;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {label}
    </span>
  );
}

export default CaseHeader;
