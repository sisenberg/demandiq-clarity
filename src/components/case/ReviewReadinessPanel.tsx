import { useMemo, useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, CheckCircle2,
  Info, ChevronDown, ChevronRight, Filter, X, ArrowRight,
} from "lucide-react";
import {
  type ReadinessAssessment,
  type ReviewFlag,
  type ReviewFlagCategory,
  type ReviewFlagSeverity,
  type ReadinessStatus,
  READINESS_STATUS_LABEL,
  FLAG_CATEGORY_LABEL,
  FLAG_SEVERITY_LABEL,
} from "@/lib/reviewReadiness";

// ─── Status visual config ───────────────────────────────

const STATUS_STYLE: Record<ReadinessStatus, { icon: React.ElementType; bg: string; border: string; text: string; badge: string }> = {
  not_ready: {
    icon: ShieldX,
    bg: "bg-[hsl(var(--status-failed-bg))]",
    border: "border-[hsl(var(--status-failed))]/20",
    text: "text-[hsl(var(--status-failed-foreground))]",
    badge: "bg-[hsl(var(--status-failed))]/10 text-[hsl(var(--status-failed))]",
  },
  partially_ready: {
    icon: ShieldAlert,
    bg: "bg-[hsl(var(--status-review-bg))]",
    border: "border-[hsl(var(--status-review))]/20",
    text: "text-[hsl(var(--status-review-foreground))]",
    badge: "bg-[hsl(var(--status-review))]/10 text-[hsl(var(--status-review))]",
  },
  review_ready: {
    icon: ShieldCheck,
    bg: "bg-[hsl(var(--status-approved-bg))]",
    border: "border-[hsl(var(--status-approved))]/20",
    text: "text-[hsl(var(--status-approved-foreground))]",
    badge: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]",
  },
};

const SEVERITY_STYLE: Record<ReviewFlagSeverity, { icon: React.ElementType; color: string; bg: string }> = {
  error: { icon: ShieldX, color: "text-[hsl(var(--status-failed))]", bg: "bg-[hsl(var(--status-failed-bg))]" },
  warning: { icon: AlertTriangle, color: "text-[hsl(var(--status-review))]", bg: "bg-[hsl(var(--status-review-bg))]" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/5" },
};

// ─── Props ──────────────────────────────────────────────

interface ReviewReadinessPanelProps {
  assessment: ReadinessAssessment;
  onFilterByFlags?: () => void;
  onJumpToRecord?: (recordId: string) => void;
}

export default function ReviewReadinessPanel({
  assessment,
  onFilterByFlags,
  onJumpToRecord,
}: ReviewReadinessPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<ReviewFlagCategory | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<ReviewFlagSeverity | null>(null);

  const style = STATUS_STYLE[assessment.status];
  const StatusIcon = style.icon;

  // Filter flags
  const visibleFlags = useMemo(() => {
    return assessment.flags.filter((f) => {
      if (selectedCategory && f.category !== selectedCategory) return false;
      if (selectedSeverity && f.severity !== selectedSeverity) return false;
      return true;
    });
  }, [assessment.flags, selectedCategory, selectedSeverity]);

  // Active categories that have flags
  const activeCategories = useMemo(() => {
    return (Object.keys(FLAG_CATEGORY_LABEL) as ReviewFlagCategory[]).filter(
      (c) => assessment.categoryCounts[c] > 0,
    );
  }, [assessment.categoryCounts]);

  const hasActiveFilters = selectedCategory !== null || selectedSeverity !== null;

  return (
    <div className={`rounded-lg border ${style.border} ${style.bg} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hover:opacity-90 transition-opacity"
      >
        <StatusIcon className={`h-4.5 w-4.5 shrink-0 ${style.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[12px] font-semibold ${style.text}`}>
              {READINESS_STATUS_LABEL[assessment.status]}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${style.badge}`}>
              {assessment.score}/100
            </span>
          </div>
          <p className={`text-[10px] ${style.text} opacity-80 mt-0.5 line-clamp-1`}>
            {assessment.summary}
          </p>
        </div>

        {/* Severity counts */}
        <div className="flex items-center gap-1.5 shrink-0">
          {assessment.errorCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[hsl(var(--status-failed))]">
              <ShieldX className="h-3 w-3" />{assessment.errorCount}
            </span>
          )}
          {assessment.warningCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[hsl(var(--status-review))]">
              <AlertTriangle className="h-3 w-3" />{assessment.warningCount}
            </span>
          )}
          {assessment.infoCount > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] font-semibold text-primary">
              <Info className="h-3 w-3" />{assessment.infoCount}
            </span>
          )}
        </div>

        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/30 px-3.5 py-2.5">
          {/* Category chips */}
          <div className="flex items-center gap-1 flex-wrap mb-2">
            <span className="text-[9px] text-muted-foreground font-medium mr-1">Filter:</span>
            {activeCategories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isActive ? null : cat)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {FLAG_CATEGORY_LABEL[cat]} ({assessment.categoryCounts[cat]})
                </button>
              );
            })}

            {/* Severity filters */}
            <div className="h-3 w-px bg-border mx-1" />
            {(["error", "warning", "info"] as ReviewFlagSeverity[]).map((sev) => {
              const count = assessment.flags.filter((f) => f.severity === sev).length;
              if (count === 0) return null;
              const isActive = selectedSeverity === sev;
              const sevStyle = SEVERITY_STYLE[sev];
              return (
                <button
                  key={sev}
                  onClick={() => setSelectedSeverity(isActive ? null : sev)}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                    isActive
                      ? `${sevStyle.bg} ${sevStyle.color} ring-1 ring-current/20`
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {FLAG_SEVERITY_LABEL[sev]} ({count})
                </button>
              );
            })}

            {hasActiveFilters && (
              <button
                onClick={() => { setSelectedCategory(null); setSelectedSeverity(null); }}
                className="text-[9px] text-muted-foreground hover:text-foreground ml-1 flex items-center gap-0.5"
              >
                <X className="h-2.5 w-2.5" /> Clear
              </button>
            )}
          </div>

          {/* Flag list */}
          <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
            {visibleFlags.map((flag) => (
              <FlagRow key={flag.id} flag={flag} onJumpToRecord={onJumpToRecord} />
            ))}
            {visibleFlags.length === 0 && (
              <p className="text-[10px] text-muted-foreground py-2 text-center">
                {hasActiveFilters ? "No flags match the selected filters." : "No issues found."}
              </p>
            )}
          </div>

          {/* Action bar */}
          {onFilterByFlags && assessment.flags.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/30">
              <button
                onClick={onFilterByFlags}
                className="flex items-center gap-1.5 text-[10px] font-medium text-primary hover:underline"
              >
                <Filter className="h-3 w-3" />
                Show only flagged records in timeline
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Flag Row ───────────────────────────────────────────

function FlagRow({ flag, onJumpToRecord }: { flag: ReviewFlag; onJumpToRecord?: (id: string) => void }) {
  const sevStyle = SEVERITY_STYLE[flag.severity];
  const SevIcon = sevStyle.icon;

  return (
    <div className={`rounded-md ${sevStyle.bg} px-2.5 py-1.5 flex items-start gap-2`}>
      <SevIcon className={`h-3 w-3 shrink-0 mt-0.5 ${sevStyle.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-foreground">{flag.title}</span>
          <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${sevStyle.color} opacity-70`}>
            {FLAG_CATEGORY_LABEL[flag.category]}
          </span>
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{flag.description}</p>
        <p className="text-[9px] text-foreground/70 mt-0.5 italic">→ {flag.action}</p>
      </div>
      {flag.recordId && onJumpToRecord && (
        <button
          onClick={() => onJumpToRecord(flag.recordId!)}
          className="text-[9px] text-primary hover:underline shrink-0 mt-0.5"
        >
          View
        </button>
      )}
    </div>
  );
}
