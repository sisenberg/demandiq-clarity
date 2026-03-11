import { useState } from "react";

interface Tab {
  key: string;
  label: string;
}

interface WorkspaceCardProps {
  icon: React.ElementType;
  title: string;
  count?: number;
  tabs?: Tab[];
  actions?: React.ReactNode;
  children: React.ReactNode | ((activeTab: string) => React.ReactNode);
  noPadding?: boolean;
}

const WorkspaceCard = ({
  icon: Icon,
  title,
  count,
  tabs,
  actions,
  children,
  noPadding,
}: WorkspaceCardProps) => {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "default");

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 bg-card">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-[13px] font-semibold text-foreground leading-none">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] font-semibold bg-accent text-muted-foreground px-1.5 py-0.5 rounded-md min-w-[20px] text-center">
            {count}
          </span>
        )}
        {/* Tabs */}
        {tabs && tabs.length > 1 && (
          <div className="ml-3 flex gap-px bg-accent rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 ${
                  activeTab === tab.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1" />
        {actions}
      </div>

      {/* Body */}
      <div className={noPadding ? "" : ""}>
        {typeof children === "function" ? children(activeTab) : children}
      </div>
    </div>
  );
};

export default WorkspaceCard;
