import { useState } from "react";
import { Link } from "react-router-dom";
import { useCases, type CaseRow } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import CreateCaseDialog from "@/components/case/CreateCaseDialog";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Briefcase, Plus, ChevronRight, Inbox } from "lucide-react";

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

const PRIORITY_BADGE: Record<string, string> = {
  low: "status-badge-draft",
  normal: "status-badge-draft",
  high: "status-badge-review",
  urgent: "status-badge-failed",
};

const STATUS_GROUPS = [
  { label: "Intake", statuses: ["draft", "intake_in_progress", "intake_complete"] },
  { label: "Processing", statuses: ["processing_in_progress"] },
  { label: "Ready to Complete", statuses: ["complete"] },
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">Cases</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {isLoading ? "Loading…" : `${cases.length} cases`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission(role, "create_case") && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="h-3.5 w-3.5" /> New Case
            </button>
          )}
          <div className="flex gap-px border border-border rounded-lg overflow-hidden p-0.5 bg-accent">
            <button
              onClick={() => setView("queue")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                view === "queue" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setView("table")}
              className={`px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all ${
                view === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <PageLoading message="Loading cases…" />
      ) : view === "queue" ? (
        <div className="flex flex-col gap-5">
          {STATUS_GROUPS.map((group) => {
            const groupCases = cases.filter((c) => group.statuses.includes(c.case_status));
            if (groupCases.length === 0) return null;
            return (
              <div key={group.label}>
                <h2 className="section-label mb-2 flex items-center gap-2">
                  {group.label}
                  <span className="text-[10px] font-semibold bg-accent text-muted-foreground px-1.5 py-0.5 rounded-md">{groupCases.length}</span>
                </h2>
                <div className="flex flex-col gap-1.5">
                  {groupCases.map((c) => (
                    <Link
                      key={c.id}
                      to={`/cases/${c.id}`}
                      className="card-elevated-hover px-4 py-3 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-foreground truncate group-hover:text-primary transition-colors">{c.title || `${c.claimant} v. ${c.insured}`}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {c.case_number} · {c.claimant} · DOI: {c.date_of_loss ?? "—"}
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
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {cases.length === 0 && (
            <div className="card-elevated">
              <EmptyState icon={Inbox} title="No cases yet" description="Create your first case to get started." />
            </div>
          )}
        </div>
      ) : (
        <div className="card-elevated overflow-hidden overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th>
                <th className="hidden sm:table-cell">Case #</th>
                <th className="hidden md:table-cell">Claimant</th>
                <th className="hidden lg:table-cell">DOI</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground text-[13px]">{c.title || `${c.claimant} v. ${c.insured}`}</span>
                    </Link>
                  </td>
                  <td className="text-muted-foreground hidden sm:table-cell text-[12px]">{c.case_number}</td>
                  <td className="text-foreground hidden md:table-cell text-[13px]">{c.claimant}</td>
                  <td className="text-muted-foreground hidden lg:table-cell text-[12px]">{c.date_of_loss ?? "—"}</td>
                  <td>
                    <span className={PRIORITY_BADGE[c.priority] ?? "status-badge-draft"}>{c.priority}</span>
                  </td>
                  <td>
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
