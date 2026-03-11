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
      className={`shrink-0 bg-card flex flex-col border-r border-border transition-all duration-200 ${
        collapsed ? "w-12" : "w-44"
      }`}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-3 pb-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-1.5 pb-4 flex flex-col gap-px">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2 rounded-lg transition-all duration-100 ${
                collapsed ? "justify-center px-2 py-2.5" : "px-3 py-[7px]"
              } ${
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <item.icon className="h-[15px] w-[15px] shrink-0" />
              {!collapsed && (
                <span className="text-[12px] leading-none">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default CaseNavRail;
