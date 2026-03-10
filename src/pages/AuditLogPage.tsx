import { mockAuditEvents, mockUsers } from "@/data/mock/index";
import { ActionType } from "@/types";

const actionLabel: Record<ActionType, string> = {
  [ActionType.Created]: "created",
  [ActionType.Updated]: "updated",
  [ActionType.StatusChanged]: "status_changed",
  [ActionType.Approved]: "approved",
  [ActionType.Rejected]: "rejected",
  [ActionType.Deleted]: "deleted",
  [ActionType.Exported]: "exported",
  [ActionType.Uploaded]: "uploaded",
  [ActionType.Assigned]: "assigned",
};

const AuditLogPage = () => {
  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide activity and change history</p>
      </div>

      <div className="border border-border rounded-lg bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entity</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Changes</th>
              <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockAuditEvents.map((entry) => {
              const actor = mockUsers.find((u) => u.id === entry.actor_user_id);
              return (
                <tr key={entry.id} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-3">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                      {entry.entity_type}.{actionLabel[entry.action_type]}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-foreground">{actor?.display_name ?? entry.actor_user_id}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{entry.entity_type}:{entry.entity_id}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {entry.after_value && (
                      <code className="text-[10px]">{JSON.stringify(entry.after_value)}</code>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{entry.created_at}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogPage;
