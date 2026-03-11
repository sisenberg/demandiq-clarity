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
      <div className="panel-header">
        <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <h2 className="panel-header-title">{title}</h2>
        {count !== undefined && (
          <span className="text-[9px] font-semibold bg-accent/60 text-muted-foreground px-1.5 py-0.5 rounded-md min-w-[18px] text-center leading-none">
            {count}
          </span>
        )}
        {/* Tabs */}
        {tabs && tabs.length > 1 && (
          <div className="ml-2 pill-toggle-group">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={activeTab === tab.key ? "pill-toggle-active" : "pill-toggle-inactive"}
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
