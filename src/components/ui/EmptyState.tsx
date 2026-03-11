import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="h-11 w-11 rounded-xl bg-accent/60 flex items-center justify-center mb-3.5">
      <Icon className="h-5 w-5 text-muted-foreground/50" />
    </div>
    <h3 className="text-[13px] font-semibold text-foreground mb-1">{title}</h3>
    {description && (
      <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
