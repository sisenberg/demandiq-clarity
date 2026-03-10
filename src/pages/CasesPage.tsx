import { useState } from "react";
import { Link } from "react-router-dom";
import { mockCases } from "@/data/mock/index";
import { CaseStatus } from "@/types";
import { CASE_STATUS_LABEL, CASE_STATUS_BADGE } from "@/lib/workflow";
import { Briefcase } from "lucide-react";

const STATUS_GROUPS = [
  {
    label: "Intake",
    statuses: [CaseStatus.Draft, CaseStatus.IntakeInProgress, CaseStatus.IntakeComplete],
  },
  {
    label: "Processing",
    statuses: [CaseStatus.ProcessingInProgress],
  },
  {
    label: "Ready to Export",
    statuses: [CaseStatus.Complete],
  },
  {
    label: "Completed",
    statuses: [CaseStatus.Exported, CaseStatus.Closed],
  },
  {
    label: "Failed",
    statuses: [CaseStatus.Failed],
  },
];

const CasesPage = () => {
  const [view, setView] = useState<"table" | "queue">("queue");
  const allCases = mockCases;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{allCases.length} cases</p>
        </div>
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

      {view === "queue" ? (
        <div className="flex flex-col gap-6">
          {STATUS_GROUPS.map((group) => {
            const cases = allCases.filter((c) => group.statuses.includes(c.case_status));
            if (cases.length === 0) return null;
            return (
              <div key={group.label}>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                  {group.label}
                  <span className="text-[10px] font-normal bg-muted px-1.5 py-0.5 rounded">{cases.length}</span>
                </h2>
                <div className="flex flex-col gap-1.5">
                  {cases.map((c) => (
                    <Link
                      key={c.id}
                      to={`/cases/${c.id}`}
                      className="border border-border rounded-lg bg-card px-4 py-3 hover:bg-accent/50 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.case_number} · {c.claimant} · DOL: {c.date_of_loss}
                          </p>
                        </div>
                      </div>
                      <span className={CASE_STATUS_BADGE[c.case_status]}>
                        {CASE_STATUS_LABEL[c.case_status]}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Case #</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Claimant</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Loss</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {allCases.map((c) => (
                <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-2 hover:text-primary transition-colors">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground">{c.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.case_number}</td>
                  <td className="px-4 py-3 text-foreground">{c.claimant}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.date_of_loss}</td>
                  <td className="px-4 py-3">
                    <span className={CASE_STATUS_BADGE[c.case_status]}>
                      {CASE_STATUS_LABEL[c.case_status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CasesPage;
