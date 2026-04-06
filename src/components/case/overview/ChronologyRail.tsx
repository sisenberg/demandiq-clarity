import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Zap,
  Stethoscope,
  Eye,
  CircleDot,
  ClipboardCheck,
  FileText,
  Activity,
  Scale,
} from "lucide-react";
import { useSourceDrawer } from "../SourceDrawer";
import type { TimelineEvent, EvidenceReference } from "@/types";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Accident: Zap, "First Treatment": Stethoscope, Treatment: Stethoscope,
  Imaging: Eye, Injection: CircleDot, IME: ClipboardCheck,
  Demand: FileText, Surgery: Activity, Legal: Scale,
};

const CATEGORY_DOT: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-primary",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
  Legal: "bg-primary",
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonthYear(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface ChronologyRailProps {
  events: TimelineEvent[];
  hasData: boolean;
}

const ChronologyRail = ({ events, hasData }: ChronologyRailProps) => {
  const { openSource } = useSourceDrawer();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (!hasData || events.length === 0) {
    return (
      <div className="sticky top-4">
        <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Chronology</h3>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Events will appear once documents are processed.
        </p>
      </div>
    );
  }

  // Group by month/year
  const grouped: { monthYear: string; items: TimelineEvent[] }[] = [];
  let currentMonth = "";
  events.forEach((evt) => {
    const my = getMonthYear(evt.event_date);
    if (my !== currentMonth) {
      currentMonth = my;
      grouped.push({ monthYear: my, items: [] });
    }
    grouped[grouped.length - 1].items.push(evt);
  });

  return (
    <div className="sticky top-4 max-h-[calc(100vh-120px)] flex flex-col">
      <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 shrink-0">Chronology</h3>

      <div className="flex-1 overflow-y-auto">
        {grouped.map((group) => (
          <div key={group.monthYear} className="mb-3">
            <p className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">
              {group.monthYear}
            </p>
            <div className="relative">
              <div className="absolute left-[4px] top-1 bottom-1 w-px bg-border/40" />
              {group.items.map((evt) => {
                const isExpanded = expandedIds.has(evt.id);
                const dot = CATEGORY_DOT[evt.category] ?? "bg-muted-foreground";

                return (
                  <div key={evt.id} className="relative pl-4 pb-1">
                    <div className={`absolute left-0 top-[5px] h-[9px] w-[9px] rounded-full border-[1.5px] border-card ${dot}`} />

                    <button
                      onClick={() => toggleExpand(evt.id)}
                      className="w-full text-left rounded px-1 py-0.5 transition-colors hover:bg-accent/30 group"
                    >
                      <span className="text-[11px] text-foreground/80 leading-tight block truncate">{evt.label}</span>
                      <span className="text-[9px] text-muted-foreground/50 tabular-nums">{formatShortDate(evt.event_date)}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-1 pt-0.5 pb-1">
                        <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{evt.description}</p>
                        {evt.evidence_refs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {evt.evidence_refs.map((r: EvidenceReference, i: number) => (
                              <button
                                key={i}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSource({ docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any });
                                }}
                                className="text-[8px] font-medium text-primary hover:text-primary/80 px-1 py-0.5 rounded bg-primary/5 transition-colors"
                              >
                                {r.page_label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChronologyRail;
