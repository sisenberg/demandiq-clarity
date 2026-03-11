import { useState } from "react";
import {
  LayoutDashboard,
  StickyNote,
  Clock,
  FileText,
  BookOpen,
  GitBranch,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export type CaseSection =
  | "overview"
  | "notes"
  | "timeline"
  | "documents"
  | "sources"
  | "workflows"
  | "chat";

const NAV_ITEMS: { key: CaseSection; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "notes", label: "Case Notes", icon: StickyNote },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "sources", label: "Source Pages", icon: BookOpen },
  { key: "workflows", label: "Workflows", icon: GitBranch },
  { key: "chat", label: "Chat", icon: MessageSquare },
];

interface CaseNavRailProps {
  active: CaseSection;
  onChange: (section: CaseSection) => void;
}

const CaseNavRail = ({ active, onChange }: CaseNavRailProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-200 ${
        collapsed ? "w-14" : "w-48"
      }`}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-3 pb-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 pb-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-lg transition-all ${
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
              } ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className={`text-[13px] ${isActive ? "font-medium" : ""}`}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default CaseNavRail;
