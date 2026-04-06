import { useState } from "react";
import {
  Clock,
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
  Settings,
} from "lucide-react";
import { useSourceDrawer } from "../SourceDrawer";
import type { TimelineEvent, EvidenceReference } from "@/types";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Accident: Zap,
  "First Treatment": Stethoscope,
  Treatment: Stethoscope,
  Imaging: Eye,
  Injection: CircleDot,
  IME: ClipboardCheck,
  Demand: FileText,
  Surgery: Activity,
  Legal: Scale,
  Administrative: Settings,
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
  Administrative: "bg-muted-foreground",
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getMonthYear(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
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
      <div className="flex flex-col sticky top-4 max-h-[calc(100vh-120px)]">
        <h3 className="text-xs font-semibold text-foreground mb-3 px-1">Chronological Overview</h3>
        <div className="flex-1 flex items-center justify-center py-12">
          <p className="text-xs text-muted-foreground text-center">
            Timeline events will appear here once documents are processed.
          </p>
        </div>
      </div>
    );
  }

  // Group events by month/year
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
    <div className="flex flex-col sticky top-4 max-h-[calc(100vh-120px)]">
      <h3 className="text-xs font-semibold text-foreground mb-3 px-1">Chronological Overview</h3>

      <div className="flex-1 overflow-y-auto pr-1">
        {grouped.map((group) => (
          <div key={group.monthYear} className="mb-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">
              {group.monthYear}
            </p>
            <div className="relative">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-border/60" />
              {group.items.map((evt) => {
                const isExpanded = expandedIds.has(evt.id);
                const dot = CATEGORY_DOT[evt.category] ?? "bg-muted-foreground";
                const EvtIcon = CATEGORY_ICON[evt.category] ?? CircleDot;

                return (
                  <div key={evt.id} className="relative pl-5 pb-1.5">
                    <div className={`absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2 border-card ${dot}`} />

                    <button
                      onClick={() => toggleExpand(evt.id)}
                      className="w-full text-left rounded px-1.5 py-1 transition-colors hover:bg-accent/40 group"
                    >
                      <div className="flex items-center gap-1.5">
                        <EvtIcon className="h-2.5 w-2.5 text-muted-foreground/60" />
                        <span className="text-[11px] font-medium text-foreground truncate flex-1">{evt.label}</span>
                        {isExpanded ? (
                          <ChevronDown className="h-2.5 w-2.5 text-muted-foreground/40" />
                        ) : (
                          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{formatShortDate(evt.event_date)}</span>
                    </button>

                    {isExpanded && (
                      <div className="px-1.5 pt-1 pb-2">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.description}</p>
                        {evt.evidence_refs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {evt.evidence_refs.map((r: EvidenceReference, i: number) => (
                              <button
                                key={i}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSource({ docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any });
                                }}
                                className="text-[9px] font-medium text-primary hover:text-primary/80 px-1.5 py-0.5 rounded bg-primary/5 transition-colors"
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
