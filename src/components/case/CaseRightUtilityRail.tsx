import { useState } from "react";
import {
  List,
  Wand2,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";

export type RightRailMode = "toc" | "refine" | "evidence";

const MODES: { key: RightRailMode; label: string; icon: React.ElementType }[] = [
  { key: "toc", label: "Contents", icon: List },
  { key: "refine", label: "Refine", icon: Wand2 },
  { key: "evidence", label: "Evidence", icon: BookOpen },
];

// Mock TOC sections tied to workspace tab content
const MOCK_TOC = [
  { id: "s-1", label: "Introduction & Summary", depth: 0 },
  { id: "s-2", label: "Claimant Information", depth: 0 },
  { id: "s-3", label: "Date & Mechanism of Loss", depth: 1 },
  { id: "s-4", label: "Injury Summary", depth: 0 },
  { id: "s-5", label: "Cervical Spine — C5-C6", depth: 1 },
  { id: "s-6", label: "Right Shoulder", depth: 1 },
  { id: "s-7", label: "Lumbar Spine — L4-L5", depth: 1 },
  { id: "s-8", label: "Right Knee", depth: 1 },
  { id: "s-9", label: "Treatment Chronology", depth: 0 },
  { id: "s-10", label: "Provider Summary", depth: 0 },
  { id: "s-11", label: "Billing Analysis", depth: 0 },
  { id: "s-12", label: "Liability Assessment", depth: 0 },
  { id: "s-13", label: "Damages Summary", depth: 0 },
];

const MOCK_EVIDENCE_JUMPS = [
  { id: "e-1", label: "Police Report — pg. 3", section: "Liability Assessment", relevance: "direct" as const },
  { id: "e-2", label: "MRI Report — pg. 7", section: "Injury Summary", relevance: "direct" as const },
  { id: "e-3", label: "Dr. Chen Eval — pg. 3", section: "Treatment Chronology", relevance: "contradicting" as const },
  { id: "e-4", label: "PT Records — pg. 22", section: "Treatment Chronology", relevance: "corroborating" as const },
  { id: "e-5", label: "IME Report — pg. 5", section: "Injury Summary", relevance: "contradicting" as const },
  { id: "e-6", label: "Witness Statement — pg. 1", section: "Liability Assessment", relevance: "corroborating" as const },
  { id: "e-7", label: "Demand Letter — pg. 1", section: "Damages Summary", relevance: "direct" as const },
];

const RELEVANCE_DOT: Record<string, string> = {
  direct: "bg-primary",
  corroborating: "confidence-high",
  contradicting: "confidence-low",
};

interface CaseRightUtilityRailProps {
  collapsed: boolean;
  onToggle: () => void;
}

const CaseRightUtilityRail = ({ collapsed, onToggle }: CaseRightUtilityRailProps) => {
  const [mode, setMode] = useState<RightRailMode>("toc");
  const [activeTocId, setActiveTocId] = useState("s-1");

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-l border-border bg-card flex flex-col items-center pt-3 gap-2">
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Expand utility rail"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); onToggle(); }}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
            title={m.label}
          >
            <m.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <aside className="w-56 shrink-0 border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-center gap-1 shrink-0">
        {MODES.map((m) => {
          const isActive = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex items-center gap-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all ${
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <m.icon className="h-3 w-3" />
              {m.label}
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={onToggle}
          className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent transition-colors"
          title="Collapse"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {mode === "toc" && (
          <nav className="flex flex-col gap-px">
            {MOCK_TOC.map((item) => {
              const isActive = activeTocId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTocId(item.id)}
                  className={`text-left rounded-md px-2 py-1.5 transition-all text-[10px] leading-snug ${
                    item.depth > 0 ? "ml-3" : ""
                  } ${
                    isActive
                      ? "bg-primary/5 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {mode === "refine" && (
          <div className="flex flex-col gap-3 p-1">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Select a section in the document to refine its content, regenerate analysis, or request additional detail.
            </p>
            <div className="flex flex-col gap-1.5">
              {["Expand analysis", "Add citations", "Simplify language", "Regenerate section"].map((action) => (
                <button
                  key={action}
                  className="text-left text-[10px] font-medium text-muted-foreground hover:text-foreground px-2.5 py-2 rounded-md border border-border hover:bg-accent/50 transition-all flex items-center justify-between"
                >
                  {action}
                  <ArrowRight className="h-2.5 w-2.5" />
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "evidence" && (
          <div className="flex flex-col gap-px">
            {MOCK_EVIDENCE_JUMPS.map((ev) => (
              <button
                key={ev.id}
                className="text-left rounded-md px-2 py-2 hover:bg-accent/50 transition-all group"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${RELEVANCE_DOT[ev.relevance] || "bg-muted-foreground"}`} />
                  <span className="text-[10px] font-medium text-foreground truncate">
                    {ev.label}
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5 ml-3 group-hover:text-foreground/60 transition-colors">
                  → {ev.section}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default CaseRightUtilityRail;
