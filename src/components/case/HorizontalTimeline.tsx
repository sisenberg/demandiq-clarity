import { useState, useRef } from "react";
import { useSourceDrawer } from "./SourceDrawer";
import { MOCK_MILESTONES } from "./ChronologyPanel";

const CATEGORY_COLORS: Record<string, { bg: string; dot: string; text: string }> = {
  Accident: { bg: "bg-destructive/10", dot: "bg-destructive", text: "text-destructive" },
  "First Treatment": { bg: "bg-[hsl(var(--status-attention-bg))]", dot: "bg-[hsl(var(--status-attention))]", text: "text-[hsl(var(--status-attention-foreground))]" },
  Treatment: { bg: "bg-[hsl(var(--status-processing-bg))]", dot: "bg-[hsl(var(--status-processing))]", text: "text-[hsl(var(--status-processing-foreground))]" },
  Imaging: { bg: "bg-[hsl(var(--status-review-bg))]", dot: "bg-[hsl(var(--status-review))]", text: "text-[hsl(var(--status-review-foreground))]" },
  Injection: { bg: "bg-[hsl(var(--status-approved-bg))]", dot: "bg-[hsl(var(--status-approved))]", text: "text-[hsl(var(--status-approved-foreground))]" },
  IME: { bg: "bg-accent", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  Demand: { bg: "bg-primary/10", dot: "bg-primary", text: "text-primary" },
  Surgery: { bg: "bg-destructive/10", dot: "bg-destructive", text: "text-destructive" },
};

const HorizontalTimeline = () => {
  const [selected, setSelected] = useState<number | null>(null);
  const { openSource } = useSourceDrawer();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCitationClick = (ms: (typeof MOCK_MILESTONES)[0]) => {
    if (ms.citations.length > 0) {
      openSource(ms.citations[0]);
    }
  };

  return (
    <div className="card-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Case Timeline
        </span>
        <span className="text-[10px] text-muted-foreground">
          {MOCK_MILESTONES[0].date} — {MOCK_MILESTONES[MOCK_MILESTONES.length - 1].date}
        </span>
      </div>

      {/* Horizontal scrollable timeline */}
      <div ref={scrollRef} className="overflow-x-auto px-5 py-4">
        <div className="relative flex items-start gap-0 min-w-max">
          {/* Connecting line */}
          <div className="absolute top-[18px] left-4 right-4 h-px bg-border" />

          {MOCK_MILESTONES.map((ms, idx) => {
            const colors = CATEGORY_COLORS[ms.category] ?? CATEGORY_COLORS.Treatment;
            const isSelected = selected === idx;

            return (
              <div
                key={idx}
                className="flex flex-col items-center relative"
                style={{ minWidth: "110px" }}
              >
                {/* Dot */}
                <button
                  onClick={() => setSelected(isSelected ? null : idx)}
                  className="relative z-10 group"
                >
                  <div
                    className={`h-[14px] w-[14px] rounded-full ring-3 ring-card transition-all ${colors.dot} ${
                      isSelected ? "scale-125 ring-primary/30" : "group-hover:scale-110"
                    }`}
                  />
                </button>

                {/* Label */}
                <button
                  onClick={() => setSelected(isSelected ? null : idx)}
                  className={`mt-2 px-2 py-1 rounded-md text-center transition-colors ${
                    isSelected ? colors.bg : "hover:bg-accent/50"
                  }`}
                >
                  <p className="text-[10px] font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {formatShortDate(ms.date)}
                  </p>
                  <p className={`text-[9px] font-medium ${colors.text} uppercase tracking-wider mt-0.5`}>
                    {ms.category}
                  </p>
                </button>

                {/* Expanded detail card */}
                {isSelected && (
                  <div className="absolute top-[72px] left-1/2 -translate-x-1/2 w-64 rounded-xl border border-border bg-card shadow-lg p-3.5 z-20">
                    <p className="text-xs font-semibold text-foreground mb-1">{ms.label}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">
                      {ms.description}
                    </p>
                    {ms.citations.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {ms.citations.map((c, ci) => (
                          <button
                            key={ci}
                            onClick={(e) => {
                              e.stopPropagation();
                              openSource(c);
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors text-left"
                          >
                            <span className="bg-primary/10 px-1.5 py-0.5 rounded">{c.page}</span>
                            <span className="truncate">{c.docName}</span>
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
