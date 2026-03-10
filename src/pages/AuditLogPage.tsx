import { ScrollText } from "lucide-react";

const auditEntries = [
  { action: "event.approved", actor: "James Chen", target: "evt-001 — Motor vehicle collision", timestamp: "2024-06-05T10:00:00Z" },
  { action: "event.approved", actor: "James Chen", target: "evt-002 — Emergency department presentation", timestamp: "2024-06-05T10:05:00Z" },
  { action: "case.status_changed", actor: "System", target: "case-004 — Park v. Summit Logistics → Approved", timestamp: "2024-10-01T16:00:00Z" },
  { action: "document.uploaded", actor: "Sarah Burke", target: "doc-006 — Wage_Loss_Statement.pdf", timestamp: "2024-09-10T08:00:00Z" },
  { action: "job.failed", actor: "System", target: "job-004 — Inspection_Report_Unit4B.pdf", timestamp: "2024-09-12T10:07:00Z" },
  { action: "issue.flagged", actor: "AI", target: "iss-001 — Pre-existing degenerative changes", timestamp: "2024-06-02T13:00:00Z" },
  { action: "case.created", actor: "Maria Santos", target: "case-003 — Nguyen v. Coastal Health Systems", timestamp: "2024-08-20T15:00:00Z" },
];

const AuditLogPage = () => {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          System-wide activity and change history
        </p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Target</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {auditEntries.map((entry, idx) => (
              <tr key={idx} className="hover:bg-accent/50 transition-colors">
                <td className="px-4 py-3">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                    {entry.action}
                  </code>
                </td>
                <td className="px-4 py-3 text-foreground">{entry.actor}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{entry.target}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{entry.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogPage;
