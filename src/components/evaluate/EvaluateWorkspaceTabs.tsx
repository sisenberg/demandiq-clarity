import { useState } from "react";

export type EvalTab = "inputs_overview" | "inputs_liability" | "inputs_injury" | "inputs_damages" | "inputs_context" | "overview" | "drivers" | "modifiers" | "range" | "explanation" | "evidence" | "calibration" | "governance" | "handoff";

const TABS: { key: EvalTab; label: string; group?: string }[] = [
  { key: "inputs_overview", label: "Case Overview", group: "Inputs" },
  { key: "inputs_liability", label: "Liability", group: "Inputs" },
  { key: "inputs_injury", label: "Injury & Treatment", group: "Inputs" },
  { key: "inputs_damages", label: "Damages", group: "Inputs" },
  { key: "inputs_context", label: "Eval Context", group: "Inputs" },
  { key: "overview", label: "Overview", group: "Analysis" },
  { key: "drivers", label: "Drivers", group: "Analysis" },
  { key: "modifiers", label: "Modifiers", group: "Analysis" },
  { key: "range", label: "Range", group: "Analysis" },
  { key: "explanation", label: "Explanation", group: "Analysis" },
  { key: "evidence", label: "Evidence", group: "Analysis" },
  { key: "calibration", label: "Calibration", group: "Analysis" },
  { key: "governance", label: "Governance", group: "Analysis" },
  { key: "handoff", label: "Handoff", group: "Analysis" },
];

interface Props {
  active: EvalTab;
  onChange: (tab: EvalTab) => void;
  isDirty?: boolean;
}

const EvaluateWorkspaceTabs = ({ active, onChange, isDirty }: Props) => {
  const groups = [...new Set(TABS.map(t => t.group))];

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
      {groups.map((group, gi) => (
        <div key={group} className="flex items-center gap-0.5">
          {gi > 0 && (
            <div className="h-4 w-px bg-border mx-1.5" />
          )}
          <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest mr-1 hidden lg:inline">
            {group}
          </span>
          {TABS.filter(t => t.group === group).map((tab) => {
            const isActive = active === tab.key;
            const isInputTab = tab.key.startsWith("inputs_");
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={`relative whitespace-nowrap px-2.5 py-2 text-[10px] font-medium rounded-md transition-all duration-100 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {tab.label}
                {isActive && isDirty && isInputTab && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--status-attention))]" />
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-primary rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default EvaluateWorkspaceTabs;
