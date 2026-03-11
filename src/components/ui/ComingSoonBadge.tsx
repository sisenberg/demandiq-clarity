import { Lock } from "lucide-react";

interface ComingSoonBadgeProps {
  label?: string;
  className?: string;
}

const ComingSoonBadge = ({ label = "Coming Soon", className = "" }: ComingSoonBadgeProps) => (
  <span className={`inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground ${className}`}>
    <Lock className="h-2.5 w-2.5" />
    {label}
  </span>
);

export default ComingSoonBadge;
