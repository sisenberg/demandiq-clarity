import { useState } from "react";
import {
  LayoutDashboard,
  StickyNote,
  DollarSign,
  MessageSquare,
  FileText,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar,
  Hash,
  FileStack,
} from "lucide-react";

export type CaseSection =
  | "overview"
  | "notes"
  | "billing"
  | "chat"
  | "documents"
  | "sources";

const NAV_ITEMS: { key: CaseSection; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "notes", label: "Case Notes", icon: StickyNote },
  { key: "billing", label: "Billing", icon: DollarSign },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "sources", label: "Source Pages", icon: BookOpen },
];

interface ClaimantSummary {
  claimantName: string;
  doi: string;
  claimNumber: string;
  pageCount: number;
}

interface CaseNavRailProps {
  active: CaseSection;
  onChange: (section: CaseSection) => void;
  claimant?: ClaimantSummary;
}

const CaseNavRail = ({ active, onChange, claimant }: CaseNavRailProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`shrink-0 bg-card flex flex-col border-r border-border transition-all duration-200 ${
        collapsed ? "w-12" : "w-52"
      }`}
    >
      {/* Claimant summary card */}
      {claimant && !collapsed && (
        <div className="px-3 pt-3 pb-2">
          <div className="rounded-lg bg-accent/60 border border-border p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                  {claimant.claimantName}
                </p>
                <p className="text-[9px] text-muted-foreground font-medium">Claimant</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Calendar className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium">DOI</span>
                <span className="text-foreground ml-auto">{claimant.doi}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Hash className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium">Claim</span>
                <span className="text-foreground ml-auto font-mono text-[9px]">{claimant.claimNumber}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <FileStack className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium">Pages</span>
                <span className="text-foreground ml-auto">{claimant.pageCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collapsed claimant icon */}
      {claimant && collapsed && (
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center"
            title={claimant.claimantName}
          >
            <User className="h-3.5 w-3.5 text-primary" />
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-2 pb-1">
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
