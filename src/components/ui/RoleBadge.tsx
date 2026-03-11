import type { AppRole } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";

const roleStyles: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  manager: "bg-primary/10 text-primary border-primary/20",
  reviewer: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.25)]",
  adjuster: "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-foreground))] border-[hsl(var(--status-draft)/0.25)]",
  readonly: "bg-muted text-muted-foreground border-border",
};

const RoleBadge = ({ role }: { role: AppRole | null }) => {
  if (!role) return null;
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${roleStyles[role]}`}>
      {ROLE_LABELS[role]}
    </span>
  );
};

export default RoleBadge;
