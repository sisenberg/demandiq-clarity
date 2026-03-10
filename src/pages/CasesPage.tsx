import { useState } from "react";
import { Link } from "react-router-dom";
import { useCases, type CaseRow } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import CreateCaseDialog from "@/components/case/CreateCaseDialog";
import { Briefcase, Plus } from "lucide-react";

const CASE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake_in_progress: "Intake In Progress",
  intake_complete: "Intake Complete",
  processing_in_progress: "Processing",
  complete: "Complete",
  exported: "Exported",
  closed: "Closed",
  failed: "Failed",
};

const CASE_STATUS_BADGE: Record<string, string> = {
  draft: "status-badge-draft",
  intake_in_progress: "status-badge-processing",
  intake_complete: "status-badge-approved",
  processing_in_progress: "status-badge-processing",
  complete: "status-badge-approved",
  exported: "status-badge-draft",
  closed: "status-badge-draft",
  failed: "status-badge-failed",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "status-badge-draft",
  normal: "status-badge-draft",
  high: "status-badge-review",
  urgent: "status-badge-failed",
};

const STATUS_GROUPS = [
  { label: "Intake", statuses: ["draft", "intake_in_progress", "intake_complete"] },
  { label: "Processing", statuses: ["processing_in_progress"] },
  { label: "Ready to Export", statuses: ["complete"] },
  { label: "Completed", statuses: ["exported", "closed"] },
  { label: "Failed", statuses: ["failed"] },
];

const CasesPage = () => {
  const { role } = useAuth();
  const { data: cases = [], isLoading } = useCases();
  const [view, setView] = useState<"table" | "queue">("queue");
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${cases.length} cases`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission(role, "create_case") && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Case
            </button>
          )}
          <div className="flex gap-1 border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setView("queue")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "queue" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Work Queue
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "table" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {view === "queue" ? (
        <div className="flex flex-col gap-6">
          {STATUS_GROUPS.map((group) => {
            const groupCases = cases.filter((c) => group.statuses.includes(c.case_status));
            if (groupCases.length === 0) return null;
            return (
              <div key={group.label}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  {group.label}
                  <span className="text-[10px] font-normal bg-muted px-1.5 py-0.5 rounded">{groupCases.length}</span>
                </h2>
                <div className="flex flex-col gap-1.5">
                  {groupCases.map((c) => (
                    <Link
                      key={c.id}
                      to={`/cases/${c.id}`}
                      className="border border-border rounded-lg bg-card px-4 py-3 hover:bg-accent/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.title || `${c.claimant} v. ${c.insured}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.case_number} · {c.claimant} · DOL: {c.date_of_loss ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.priority !== "normal" && (
                          <span className={PRIORITY_BADGE[c.priority]}>{c.priority}</span>
                        )}
                        <span className={CASE_STATUS_BADGE[c.case_status] ?? "status-badge-draft"}>
                          {CASE_STATUS_LABEL[c.case_status] ?? c.case_status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {!isLoading && cases.length === 0 && (
            <div className="text-center py-12 border border-border rounded-lg bg-card">
              <Briefcase className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No cases yet. Create your first case to get started.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case #</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Claimant</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">DOL</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{c.title || `${c.claimant} v. ${c.insured}`}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.case_number}</td>
                  <td className="px-4 py-3 text-foreground">{c.claimant}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.date_of_loss ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={PRIORITY_BADGE[c.priority] ?? "status-badge-draft"}>{c.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={CASE_STATUS_BADGE[c.case_status] ?? "status-badge-draft"}>
                      {CASE_STATUS_LABEL[c.case_status] ?? c.case_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateCaseDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};

export default CasesPage;
