import { Link } from "react-router-dom";
import { mockCases } from "@/data/mock/index";
import { CaseStatus } from "@/types";
import { Briefcase } from "lucide-react";

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
  [CaseStatus.Review]: "status-badge-review",
  [CaseStatus.Approved]: "status-badge-approved",
  [CaseStatus.Exported]: "bg-muted text-muted-foreground",
  [CaseStatus.Archived]: "bg-muted text-muted-foreground",
};

const CasesPage = () => {
  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Cases</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{mockCases.length} cases</p>
        </div>
      </div>

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
            {mockCases.map((c) => (
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColor[c.case_status]}`}>
                    {statusLabel[c.case_status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CasesPage;
