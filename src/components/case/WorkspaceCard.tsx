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
}

const WorkspaceCard = ({
  icon: Icon,
  title,
  count,
  tabs,
  actions,
  children,
}: WorkspaceCardProps) => {
  const [activeTab, setActiveTab] = useState(tabs?.[0]?.key ?? "default");

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 bg-card">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
            {count}
          </span>
        )}
        {/* Tabs */}
        {tabs && tabs.length > 1 && (
          <div className="ml-4 flex gap-0.5 bg-muted rounded-lg p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
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
        {/* Spacer + Actions */}
        <div className="flex-1" />
        {actions}
      </div>

      {/* Body */}
      <div>
        {typeof children === "function" ? children(activeTab) : children}
      </div>
    </div>
  );
};

export default WorkspaceCard;
