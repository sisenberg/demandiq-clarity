import { useState, useRef } from "react";
import { useSourceDrawer } from "./SourceDrawer";
import { useCasePackage } from "@/hooks/useCasePackage";
import type { EvidenceReference } from "@/types";

function refToCS(r: EvidenceReference) {
  return { docName: r.doc_name, page: r.page_label, excerpt: r.quoted_text, relevance: r.relevance as any };
}

const CATEGORY_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  Accident: { bg: "bg-destructive/10", dot: "bg-destructive", text: "text-destructive" },
  "First Treatment": { bg: "bg-[hsl(var(--status-attention-bg))]", dot: "bg-[hsl(var(--status-attention))]", text: "text-[hsl(var(--status-attention-foreground))]" },
  Treatment: { bg: "bg-[hsl(var(--status-processing-bg))]", dot: "bg-[hsl(var(--status-processing))]", text: "text-[hsl(var(--status-processing-foreground))]" },
  Imaging: { bg: "bg-[hsl(var(--status-review-bg))]", dot: "bg-[hsl(var(--status-review))]", text: "text-[hsl(var(--status-review-foreground))]" },
  Injection: { bg: "bg-[hsl(var(--status-approved-bg))]", dot: "bg-[hsl(var(--status-approved))]", text: "text-[hsl(var(--status-approved-foreground))]" },
  IME: { bg: "bg-accent", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  Demand: { bg: "bg-primary/10", dot: "bg-primary", text: "text-primary" },
  Surgery: { bg: "bg-destructive/10", dot: "bg-destructive", text: "text-destructive" },
  Legal: { bg: "bg-primary/10", dot: "bg-primary", text: "text-primary" },
  Administrative: { bg: "bg-accent", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const HorizontalTimeline = () => {
  const { pkg } = useCasePackage();
  const [selected, setSelected] = useState<number | null>(null);
  const { openSource } = useSourceDrawer();
  const events = pkg.timeline_events;

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Case Timeline
        </span>
        <span className="text-[10px] text-muted-foreground">
          {events[0]?.event_date} — {events[events.length - 1]?.event_date}
        </span>
      </div>

      <div className="overflow-x-auto px-5 py-4">
        <div className="relative flex items-start gap-0 min-w-max">
          <div className="absolute top-[18px] left-4 right-4 h-px bg-border" />

          {events.map((evt, idx) => {
            const colors = CATEGORY_COLORS[evt.category] ?? CATEGORY_COLORS.Treatment;
            const isSelected = selected === idx;

            return (
              <div key={evt.id} className="flex flex-col items-center relative" style={{ minWidth: "110px" }}>
                <button onClick={() => setSelected(isSelected ? null : idx)} className="relative z-10 group">
                  <div className={`h-[14px] w-[14px] rounded-full ring-3 ring-card transition-all ${colors.dot} ${isSelected ? "scale-125 ring-primary/30" : "group-hover:scale-110"}`} />
                </button>

                <button onClick={() => setSelected(isSelected ? null : idx)} className={`mt-2 px-2 py-1 rounded-md text-center transition-colors ${isSelected ? colors.bg : "hover:bg-accent/50"}`}>
                  <p className="text-[10px] font-semibold text-foreground tabular-nums whitespace-nowrap">{formatShortDate(evt.event_date)}</p>
                  <p className={`text-[9px] font-medium ${colors.text} uppercase tracking-wider mt-0.5`}>{evt.category}</p>
                </button>

                {isSelected && (
                  <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-64 rounded-xl border border-border bg-card shadow-lg p-3.5 z-20">
                    <p className="text-xs font-semibold text-foreground mb-1">{evt.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{evt.description}</p>
                    {evt.evidence_refs.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {evt.evidence_refs.map((r, ci) => (
                          <button
                            key={ci}
                            onClick={(e) => { e.stopPropagation(); openSource(refToCS(r)); }}
                            className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors text-left"
                          >
                            <span className="bg-primary/10 px-1.5 py-0.5 rounded">{r.page_label}</span>
                            <span className="truncate">{r.doc_name}</span>
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
    </div>
  );
};

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default HorizontalTimeline;
