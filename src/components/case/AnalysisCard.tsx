import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { EvidenceStatement, type CitationSource } from "./EvidenceCitation";

// ─── Types ──────────────────────────────────────────────
export interface AnalysisItem {
  label: string;
  value?: string;
  detail?: string;
  citations?: CitationSource[];
  severity?: "info" | "warning" | "alert";
}

export interface AnalysisSection {
  title: string;
  items: AnalysisItem[];
}

interface AnalysisCardProps {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  sections: AnalysisSection[];
}

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-primary",
  warning: "bg-[hsl(var(--status-review))]",
  alert: "bg-destructive",
};

// ─── Component ──────────────────────────────────────────
const AnalysisCard = ({ icon: Icon, title, subtitle, sections }: AnalysisCardProps) => {
  const [expanded, setExpanded] = useState<Record<number, boolean>>(
    Object.fromEntries(sections.map((_, i) => [i, true]))
  );

  const toggle = (idx: number) =>
    setExpanded((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2 bg-card">
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && (
          <span className="text-[10px] font-medium bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
            {subtitle}
          </span>
        )}
      </div>

      {/* Sections */}
      <div className="divide-y divide-border">
        {sections.map((section, si) => (
          <div key={si}>
            <button
              onClick={() => toggle(si)}
              className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-accent/30 transition-colors"
            >
              <ChevronRight
                className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                  expanded[si] ? "rotate-90" : ""
                }`}
              />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {section.title}
              </h3>
              <span className="text-[10px] text-muted-foreground ml-1">
                {section.items.length}
              </span>
            </button>

            {expanded[si] && (
              <div className="px-5 pb-4 pl-10 flex flex-col gap-2">
                {section.items.map((item, ii) => (
                  <div key={ii} className="flex items-start gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                        SEVERITY_DOT[item.severity ?? "info"]
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {item.label}
                        </span>
                        {item.value && (
                          <code className="text-[10px] bg-accent px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                            {item.value}
                          </code>
                        )}
                      </div>
                      {item.detail && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {item.citations && item.citations.length > 0 ? (
                            <EvidenceStatement text={item.detail} citations={item.citations} />
                          ) : (
                            item.detail
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisCard;
