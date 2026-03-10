interface AppHeaderProps {
  tenantName?: string;
}

const AppHeader = ({ tenantName = "DemandIQ" }: AppHeaderProps) => {
  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-background shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-bold">D</span>
        </div>
        <span className="text-sm font-semibold text-foreground tracking-tight">
          {tenantName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
          <span className="text-xs font-medium text-muted-foreground">SB</span>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
