import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export type WorkspaceTab =
  | "cover"
  | "checklist"
  | "chronology"
  | "background"
  | "assessment"
  | "providers";

const PRIMARY_TABS: { key: WorkspaceTab; label: string }[] = [
  { key: "cover", label: "Cover Page" },
  { key: "checklist", label: "Checklist" },
  { key: "chronology", label: "Chronological Summary" },
  { key: "background", label: "Claimant Background" },
  { key: "assessment", label: "Claim Assessment" },
  { key: "providers", label: "Providers" },
];

const MORE_TABS: { key: string; label: string; disabled?: boolean }[] = [
  { key: "evaluateiq", label: "EvaluateIQ", disabled: true },
  { key: "negotiateiq", label: "NegotiateIQ", disabled: true },
  { key: "litiq", label: "LitIQ", disabled: true },
];

interface CaseWorkspaceTabsProps {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}

const CaseWorkspaceTabs = ({ active, onChange }: CaseWorkspaceTabsProps) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
      {PRIMARY_TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`relative whitespace-nowrap px-3 py-2 text-[11px] font-medium rounded-md transition-all duration-100 ${
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-2.5 right-2.5 h-[1.5px] bg-primary rounded-full" />
            )}
          </button>
        );
      })}

      {/* More dropdown */}
      <div className="relative" ref={moreRef}>
        <button
          onClick={() => setMoreOpen(!moreOpen)}
          className="flex items-center gap-1 whitespace-nowrap px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-md transition-all"
        >
          More
          <ChevronDown className={`h-2.5 w-2.5 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
        </button>

        {moreOpen && (
          <div className="absolute top-full left-0 mt-1 w-44 bg-popover border border-border rounded-lg shadow-lg z-30 py-1">
            {MORE_TABS.map((tab) => (
              <button
                key={tab.key}
                disabled={tab.disabled}
                className="w-full text-left px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {tab.label}
                {tab.disabled && (
                  <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseWorkspaceTabs;
