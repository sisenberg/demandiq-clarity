import { useState } from "react";

export type EvalTab = "overview" | "drivers" | "range" | "explanation" | "evidence" | "calibration" | "governance" | "handoff";

const TABS: { key: EvalTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "drivers", label: "Valuation Drivers" },
  { key: "range", label: "Range Output" },
  { key: "explanation", label: "Explanation" },
  { key: "evidence", label: "Evidence" },
  { key: "calibration", label: "Calibration" },
  { key: "governance", label: "Governance" },
  { key: "handoff", label: "Handoff" },
];

interface Props {
  active: EvalTab;
  onChange: (tab: EvalTab) => void;
}

const EvaluateWorkspaceTabs = ({ active, onChange }: Props) => (
  <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
    {TABS.map((tab) => {
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
  </div>
);

export default EvaluateWorkspaceTabs;
