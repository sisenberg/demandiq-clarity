import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
    <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center mb-3">
      <Icon className="h-5 w-5 text-muted-foreground/60" />
    </div>
    <h3 className="text-[13px] font-semibold text-foreground mb-0.5">{title}</h3>
    {description && (
      <p className="text-[11px] text-muted-foreground max-w-[240px] leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export default EmptyState;
