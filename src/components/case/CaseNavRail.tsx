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
  Calculator,
  Handshake,
  ClipboardCheck,
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
  | "medical-review"
  | "intake-review"
  | "evaluate"
  | "negotiate";

const NAV_ITEMS: { key: CaseSection; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "notes", label: "Case Notes", icon: StickyNote },
  { key: "chronology", label: "Chronology", icon: Calendar },
  { key: "intake-review", label: "Intake Review", icon: ClipboardCheck },
  { key: "medical-review", label: "Medical Review", icon: Stethoscope },
  { key: "evaluate", label: "EvaluateIQ", icon: Calculator },
  { key: "negotiate", label: "NegotiateIQ", icon: Handshake },
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
      className={`shrink-0 flex flex-col transition-all duration-200 ${
        collapsed ? "w-12" : "w-48"
      }`}
      style={{
        backgroundColor: "hsl(var(--sidebar-background))",
        color: "hsl(var(--sidebar-foreground))",
      }}
    >
      {/* Product title */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(var(--sidebar-primary))" }}>
            DemandIQ
          </span>
        </div>
      )}

      {/* Claimant identity block */}
      {claimant && !collapsed && (
        <div className="px-3 pt-2 pb-2">
          <div className="rounded-md p-2.5" style={{ backgroundColor: "hsl(var(--sidebar-accent))" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "hsl(var(--sidebar-primary) / 0.15)" }}>
                <User className="h-2.5 w-2.5" style={{ color: "hsl(var(--sidebar-primary))" }} />
              </div>
              <p className="text-[11px] font-semibold truncate leading-tight" style={{ color: "hsl(var(--sidebar-foreground))" }}>
                {claimant.claimantName}
              </p>
            </div>
            <div className="flex flex-col gap-0.5 pl-7">
              <SidebarMeta label="DOI" value={claimant.doi} />
              <SidebarMeta label="Claim" value={claimant.claimNumber} />
              <SidebarMeta label="Pages" value={claimant.pageCount.toLocaleString()} />
            </div>
          </div>
        </div>
      )}

      {/* Collapsed claimant icon */}
      {claimant && collapsed && (
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="h-6 w-6 rounded-md flex items-center justify-center"
            title={claimant.claimantName}
            style={{ backgroundColor: "hsl(var(--sidebar-accent))" }}
          >
            <User className="h-3 w-3" style={{ color: "hsl(var(--sidebar-primary))" }} />
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-1.5 pb-0.5">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md transition-all duration-100 opacity-30 hover:opacity-100"
          style={{ color: "hsl(var(--sidebar-foreground))" }}
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
              className={`flex items-center gap-2 rounded-md transition-all duration-100 ${
                collapsed ? "justify-center px-2 py-2" : "px-2.5 py-[7px]"
              }`}
              style={{
                backgroundColor: isActive ? "hsl(var(--sidebar-accent))" : "transparent",
                color: isActive ? "hsl(var(--sidebar-primary))" : "hsl(var(--sidebar-muted))",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "hsl(var(--sidebar-accent) / 0.5)";
                  e.currentTarget.style.color = "hsl(var(--sidebar-foreground))";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "hsl(var(--sidebar-muted))";
                }
              }}
            >
              <item.icon className="h-[14px] w-[14px] shrink-0" />
              {!collapsed && (
                <span className="text-[11px] leading-none font-medium">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

function SidebarMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[9px]">
      <span className="font-medium" style={{ color: "hsl(var(--sidebar-muted))" }}>{label}</span>
      <span style={{ color: "hsl(var(--sidebar-foreground) / 0.7)" }}>{value}</span>
    </div>
  );
}

export default CaseNavRail;
