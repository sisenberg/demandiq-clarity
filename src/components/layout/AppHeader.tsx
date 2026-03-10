import React from "react";

interface AppHeaderProps {
  tenantName?: string;
  userName?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  tenantName = "Meridian Claims Group",
  userName = "Sarah Chen",
}) => {
  return (
    <div className="h-12 min-h-[48px] border-b border-border bg-background flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-wide text-foreground">
          DemandIQ
        </span>
        <span className="text-xs text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">{tenantName}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{userName}</span>
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <span className="text-[11px] font-semibold text-primary-foreground">
            {userName.split(" ").map(n => n[0]).join("")}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AppHeader;
