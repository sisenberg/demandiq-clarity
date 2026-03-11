import { mockAuditEvents, mockUsers } from "@/data/mock/index";
import { ActionType } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import { ScrollText } from "lucide-react";

const actionLabel: Record<ActionType, string> = {
  [ActionType.Created]: "created",
  [ActionType.Updated]: "updated",
  [ActionType.StatusChanged]: "status_changed",
  [ActionType.Deleted]: "deleted",
  [ActionType.Exported]: "exported",
  [ActionType.Uploaded]: "uploaded",
  [ActionType.Assigned]: "assigned",
};

const ACTION_BADGE: Record<string, string> = {
  created: "status-badge-approved",
  updated: "status-badge-processing",
  status_changed: "status-badge-review",
  deleted: "status-badge-failed",
  exported: "status-badge-draft",
  uploaded: "status-badge-processing",
  assigned: "status-badge-attention",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

const AuditLogPage = () => {
  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide activity and change history</p>
      </div>

      {mockAuditEvents.length === 0 ? (
        <div className="card-elevated">
          <EmptyState icon={ScrollText} title="No audit events" description="Activity will appear here as users interact with the platform." />
        </div>
      ) : (
        <div className="card-elevated overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Entity</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Changes</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {mockAuditEvents.map((entry) => {
                const actor = mockUsers.find((u) => u.id === entry.actor_user_id);
                const action = actionLabel[entry.action_type];
                return (
                  <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className={ACTION_BADGE[action] ?? "status-badge-draft"}>
                        {entry.entity_type}.{action}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-foreground text-xs font-medium">{actor?.display_name ?? entry.actor_user_id}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                      <code className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                        {entry.entity_type}:{entry.entity_id.substring(0, 8)}
                      </code>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate hidden lg:table-cell">
                      {entry.after_value && (
                        <code className="text-[10px] font-mono">{JSON.stringify(entry.after_value)}</code>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs whitespace-nowrap">{formatDate(entry.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLogPage;
