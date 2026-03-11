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
  Users,
  Stethoscope,
} from "lucide-react";

export type CaseSection =
  | "overview"
  | "notes"
  | "billing"
  | "chat"
  | "documents"
  | "sources"
  | "entities"
  | "chronology"
  | "medical-review";

const NAV_ITEMS: { key: CaseSection; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "notes", label: "Case Notes", icon: StickyNote },
  { key: "chronology", label: "Chronology", icon: Calendar },
  { key: "billing", label: "Billing", icon: DollarSign },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "entities", label: "Entities", icon: Users },
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
        collapsed ? "w-12" : "w-48"
      }`}
    >
      {/* Claimant summary card */}
      {claimant && !collapsed && (
        <div className="px-2.5 pt-2.5 pb-1.5">
          <div className="rounded-lg bg-accent/50 border border-border/60 p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-3 w-3 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-foreground truncate leading-tight">
                  {claimant.claimantName}
                </p>
                <p className="text-[8px] text-muted-foreground font-medium uppercase tracking-wider">Claimant</p>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <MetaRow icon={Calendar} label="DOI" value={claimant.doi} />
              <MetaRow icon={Hash} label="Claim" value={claimant.claimNumber} mono />
              <MetaRow icon={FileStack} label="Pages" value={claimant.pageCount.toLocaleString()} />
            </div>
          </div>
        </div>
      )}

      {/* Collapsed claimant icon */}
      {claimant && collapsed && (
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center"
            title={claimant.claimantName}
          >
            <User className="h-3 w-3 text-primary" />
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-2 pb-0.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-muted-foreground/30 hover:text-muted-foreground hover:bg-accent transition-all duration-100"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-1.5 pb-4 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onChange(item.key)}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2 rounded-lg transition-all duration-100 group ${
                collapsed ? "justify-center px-2 py-2.5" : "px-2.5 py-[7px]"
              } ${
                isActive
                  ? "bg-primary/5 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <item.icon className={`h-[14px] w-[14px] shrink-0 transition-colors ${isActive ? "text-primary" : "group-hover:text-foreground"}`} />
              {!collapsed && (
                <span className="text-[11px] leading-none">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

function MetaRow({ icon: Icon, label, value, mono }: { icon: React.ElementType; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="font-medium">{label}</span>
      <span className={`text-foreground ml-auto ${mono ? "font-mono text-[9px]" : ""}`}>{value}</span>
    </div>
  );
}

export default CaseNavRail;
