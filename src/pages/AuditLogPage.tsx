import { mockAuditEvents, mockUsers } from "@/data/mock/index";
import { ActionType } from "@/types";

const actionLabel: Record<ActionType, string> = {
  [ActionType.Created]: "created",
  [ActionType.Updated]: "updated",
  [ActionType.StatusChanged]: "status_changed",
  [ActionType.Deleted]: "deleted",
  [ActionType.Exported]: "exported",
  [ActionType.Uploaded]: "uploaded",
  [ActionType.Assigned]: "assigned",
};

const AuditLogPage = () => {
  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">System-wide activity and change history</p>
      </div>

      <div className="card-elevated overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left bg-muted/30">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actor</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Entity</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Changes</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mockAuditEvents.map((entry) => {
              const actor = mockUsers.find((u) => u.id === entry.actor_user_id);
              return (
                <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <code className="text-[10px] bg-accent px-2 py-0.5 rounded-full text-muted-foreground font-medium">
                      {entry.entity_type}.{actionLabel[entry.action_type]}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-foreground">{actor?.display_name ?? entry.actor_user_id}</td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{entry.entity_type}:{entry.entity_id}</td>
                  <td className="px-5 py-3.5 text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.after_value && (
                      <code className="text-[10px]">{JSON.stringify(entry.after_value)}</code>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs">{entry.created_at}</td>
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
