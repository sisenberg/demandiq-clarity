import type { AppRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";

const roleStyles: Record<AppRole, string> = {
  admin: "bg-destructive/8 text-destructive border-destructive/15",
  manager: "bg-primary/8 text-primary border-primary/15",
  reviewer: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.15)]",
  adjuster: "bg-accent text-muted-foreground border-border",
  readonly: "bg-accent text-muted-foreground border-border",
};

const RoleBadge = ({ role }: { role: AppRole | null }) => {
  if (!role) return null;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${roleStyles[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
};

export default RoleBadge;
