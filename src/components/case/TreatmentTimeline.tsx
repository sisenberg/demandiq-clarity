import { useState, useMemo, useCallback } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Activity, Calendar, Users, AlertTriangle, CheckCircle2, Edit3,
  HelpCircle, Copy, Link2, Unlink, FileText, ChevronDown, ChevronRight,
  Filter, Clock, DollarSign, Stethoscope, Search, X, ShieldAlert,
} from "lucide-react";
import {
  type ReviewerTreatmentRecord,
  type ExtractionReviewState,
  VISIT_TYPE_LABEL,
  REVIEW_STATE_LABEL,
  CONFIDENCE_TIER_LABEL,
} from "@/hooks/useReviewerTreatments";
import { MOCK_TREATMENT_RECORDS } from "@/data/mock/treatmentRecords";
import { useSourceDrawer } from "@/components/case/SourceDrawer";
import { assessReadiness, getRecordIdsWithFlags, getFlagsForRecord, type ReviewFlag } from "@/lib/reviewReadiness";
import ReviewReadinessPanel from "@/components/case/ReviewReadinessPanel";

// ─── Types ──────────────────────────────────────────────

type FilterState = {
  provider: string;
  bodyPart: string;
  reviewState: string;
  visitType: string;
  duplicatesOnly: boolean;
  missingBills: boolean;
  search: string;
};

const EMPTY_FILTERS: FilterState = {
  provider: "",
  bodyPart: "",
  reviewState: "",
  visitType: "",
  duplicatesOnly: false,
  missingBills: false,
  search: "",
};

// ─── Summary Metrics ───────────────────────────────────

interface TimelineMetrics {
  totalProviders: number;
  totalVisits: number;
  firstDate: string | null;
  lastDate: string | null;
  treatmentGaps: { from: string; to: string; days: number }[];
  needsReview: number;
  duplicates: number;
  totalBilled: number;
}

function computeMetrics(records: ReviewerTreatmentRecord[]): TimelineMetrics {
  const providers = new Set(records.map((r) => r.provider_name_normalized || r.provider_name_raw));
  const dated = records.filter((r) => r.visit_date).sort((a, b) => a.visit_date!.localeCompare(b.visit_date!));
  const gaps: TimelineMetrics["treatmentGaps"] = [];

  for (let i = 1; i < dated.length; i++) {
    const daysDiff = differenceInDays(parseISO(dated[i].visit_date!), parseISO(dated[i - 1].visit_date!));
    if (daysDiff > 30) {
      gaps.push({ from: dated[i - 1].visit_date!, to: dated[i].visit_date!, days: daysDiff });
    }
  }

  return {
    totalProviders: providers.size,
    totalVisits: records.length,
    firstDate: dated[0]?.visit_date || null,
    lastDate: dated[dated.length - 1]?.visit_date || null,
    treatmentGaps: gaps,
    needsReview: records.filter((r) => r.review_state === "needs_review" || r.review_state === "draft").length,
    duplicates: records.filter((r) => r.is_duplicate_suspect).length,
    totalBilled: records.reduce((s, r) => s + (r.total_billed ?? 0), 0),
  };
}

// ─── Review state colors ────────────────────────────────

const REVIEW_STATE_STYLE: Record<ExtractionReviewState, string> = {
  draft: "bg-[hsl(var(--status-draft-bg))] text-[hsl(var(--status-draft-foreground))]",
  needs_review: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  accepted: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  corrected: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]",
  rejected: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))]",
};

const CONFIDENCE_COLOR: Record<string, string> = {
  high: "text-[hsl(var(--confidence-high))]",
  medium: "text-[hsl(var(--confidence-medium))]",
  low: "text-[hsl(var(--confidence-low))]",
  unknown: "text-muted-foreground",
};

// ─── Component ──────────────────────────────────────────

interface TreatmentTimelineProps {
  caseId: string;
}

export default function TreatmentTimeline({ caseId }: TreatmentTimelineProps) {
  // In production, replace with useCaseTreatmentRecords(caseId)
  const records = MOCK_TREATMENT_RECORDS;
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["__all__"]));
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const { openSource } = useSourceDrawer();

  // Readiness assessment
  const assessment = useMemo(() => assessReadiness(records), [records]);
  const flaggedRecordIds = useMemo(() => getRecordIdsWithFlags(assessment.flags), [assessment.flags]);

  // Derive filter options
  const allProviders = useMemo(() => [...new Set(records.map((r) => r.provider_name_normalized || r.provider_name_raw))].sort(), [records]);
  const allBodyParts = useMemo(() => [...new Set(records.flatMap((r) => r.body_parts))].sort(), [records]);

  // Apply filters
  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (flaggedOnly && !flaggedRecordIds.has(r.id)) return false;
      if (filters.provider && (r.provider_name_normalized || r.provider_name_raw) !== filters.provider) return false;
      if (filters.bodyPart && !r.body_parts.includes(filters.bodyPart)) return false;
      if (filters.reviewState && r.review_state !== filters.reviewState) return false;
      if (filters.visitType && r.visit_type !== filters.visitType) return false;
      if (filters.duplicatesOnly && !r.is_duplicate_suspect) return false;
      if (filters.missingBills && r.total_billed != null && r.total_billed > 0) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = [
          r.provider_name_raw, r.facility_name, r.subjective_summary,
          r.assessment_summary, r.visit_date_text,
          ...r.diagnoses.map((d) => `${d.code || ""} ${d.description}`),
          ...r.procedures.map((p) => `${p.code || ""} ${p.description}`),
        ].join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [records, filters]);

  // Group by provider
  const grouped = useMemo(() => {
    const map = new Map<string, ReviewerTreatmentRecord[]>();
    for (const r of filtered) {
      const key = r.provider_name_normalized || r.provider_name_raw || "Unknown Provider";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    // Sort groups by first visit date
    return [...map.entries()].sort((a, b) => {
      const aDate = a[1][0]?.visit_date || "";
      const bDate = b[1][0]?.visit_date || "";
      return aDate.localeCompare(bDate);
    });
  }, [filtered]);

  const metrics = useMemo(() => computeMetrics(records), [records]);
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== "search" && v !== "" && v !== false).length + (flaggedOnly ? 1 : 0);

  const handleFilterByFlags = useCallback(() => {
    setFlaggedOnly(true);
  }, []);

  const handleJumpToRecord = useCallback((recordId: string) => {
    setExpandedRecords((prev) => new Set(prev).add(recordId));
    // Scroll into view after a tick
    setTimeout(() => {
      document.getElementById(`tr-${recordId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleRecord = (id: string) => {
    setExpandedRecords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleViewSource = (r: ReviewerTreatmentRecord) => {
    if (!r.source_document_id) return;
    openSource({
      docName: r.facility_name || "Source Document",
      page: `pg. ${r.source_page_start ?? 1}`,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Readiness Panel ────────────────────────── */}
      <ReviewReadinessPanel
        assessment={assessment}
        onFilterByFlags={handleFilterByFlags}
        onJumpToRecord={handleJumpToRecord}
      />

      {/* ── Summary Metrics ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        <MetricCard icon={Users} label="Providers" value={metrics.totalProviders} />
        <MetricCard icon={Activity} label="Total Visits" value={metrics.totalVisits} />
        <MetricCard icon={Calendar} label="First Visit" value={metrics.firstDate ? format(parseISO(metrics.firstDate), "MMM d, yyyy") : "—"} />
        <MetricCard icon={Calendar} label="Last Visit" value={metrics.lastDate ? format(parseISO(metrics.lastDate), "MMM d, yyyy") : "—"} />
        <MetricCard icon={Clock} label="Treatment Gaps" value={metrics.treatmentGaps.length} alert={metrics.treatmentGaps.length > 0} />
        <MetricCard icon={AlertTriangle} label="Needs Review" value={metrics.needsReview} alert={metrics.needsReview > 0} />
        <MetricCard icon={DollarSign} label="Total Billed" value={`$${metrics.totalBilled.toLocaleString()}`} />
      </div>

      {/* Treatment gaps callout */}
      {metrics.treatmentGaps.length > 0 && (
        <div className="rounded-lg border border-[hsl(var(--status-review))]/20 bg-[hsl(var(--status-review-bg))] px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-review))] shrink-0 mt-0.5" />
          <div className="text-[11px] text-[hsl(var(--status-review-foreground))]">
            <span className="font-semibold">Treatment gaps detected: </span>
            {metrics.treatmentGaps.map((g, i) => (
              <span key={i}>
                {i > 0 && " · "}
                {format(parseISO(g.from), "MMM d")} → {format(parseISO(g.to), "MMM d")} ({g.days} days)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Toolbar: Search + Filters ────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search records…"
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            className="w-full pl-8 pr-3 py-1.5 text-[11px] rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {filters.search && (
            <button onClick={() => setFilters((f) => ({ ...f, search: "" }))} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
            activeFilterCount > 0
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={() => { setFilters(EMPTY_FILTERS); setFlaggedOnly(false); }}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            Clear all
          </button>
        )}

        {/* Needs Review queue toggle */}
        <button
          onClick={() => setFlaggedOnly(!flaggedOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg border transition-colors ${
            flaggedOnly
              ? "border-[hsl(var(--status-review))]/30 bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]"
              : "border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="h-3 w-3" />
          Needs Review{flaggedRecordIds.size > 0 && ` (${flaggedRecordIds.size})`}
        </button>

        <div className="ml-auto text-[10px] text-muted-foreground">
          {filtered.length} of {records.length} records
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3 rounded-lg border border-border bg-card">
          <FilterSelect label="Provider" value={filters.provider} options={allProviders} onChange={(v) => setFilters((f) => ({ ...f, provider: v }))} />
          <FilterSelect label="Body Part" value={filters.bodyPart} options={allBodyParts} onChange={(v) => setFilters((f) => ({ ...f, bodyPart: v }))} />
          <FilterSelect
            label="Review State"
            value={filters.reviewState}
            options={Object.keys(REVIEW_STATE_LABEL)}
            labels={REVIEW_STATE_LABEL}
            onChange={(v) => setFilters((f) => ({ ...f, reviewState: v }))}
          />
          <FilterSelect
            label="Visit Type"
            value={filters.visitType}
            options={Object.keys(VISIT_TYPE_LABEL)}
            labels={VISIT_TYPE_LABEL}
            onChange={(v) => setFilters((f) => ({ ...f, visitType: v }))}
          />
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={filters.duplicatesOnly} onChange={(e) => setFilters((f) => ({ ...f, duplicatesOnly: e.target.checked }))} className="rounded border-border" />
            Flagged duplicates
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={filters.missingBills} onChange={(e) => setFilters((f) => ({ ...f, missingBills: e.target.checked }))} className="rounded border-border" />
            Missing bills
          </label>
        </div>
      )}

      {/* ── Provider-Grouped Timeline ────────────────── */}
      <div className="flex flex-col gap-1">
        {grouped.map(([providerName, provRecords]) => {
          const isExpanded = expandedGroups.has("__all__") || expandedGroups.has(providerName);
          const provVisitCount = provRecords.length;
          const provBilled = provRecords.reduce((s, r) => s + (r.total_billed ?? 0), 0);
          const provNeedsReview = provRecords.filter((r) => r.review_state === "draft" || r.review_state === "needs_review").length;

          return (
            <div key={providerName} className="rounded-lg border border-border bg-card overflow-hidden">
              {/* Provider group header */}
              <button
                onClick={() => toggleGroup(providerName)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent/40 transition-colors text-left"
              >
                <div className="h-5 w-5 rounded-md bg-primary/8 flex items-center justify-center shrink-0">
                  <Stethoscope className="h-3 w-3 text-primary" />
                </div>
                <span className="text-[12px] font-semibold text-foreground flex-1 truncate">{providerName}</span>
                <span className="text-[10px] text-muted-foreground">{provVisitCount} visits</span>
                {provBilled > 0 && <span className="text-[10px] text-muted-foreground">${provBilled.toLocaleString()}</span>}
                {provNeedsReview > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] font-medium">
                    {provNeedsReview} to review
                  </span>
                )}
                {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              </button>

              {/* Records */}
              {isExpanded && (
                <div className="border-t border-border">
                  {provRecords.map((record) => (
                    <TreatmentRecordRow
                      key={record.id}
                      record={record}
                      flags={getFlagsForRecord(assessment.flags, record.id)}
                      expanded={expandedRecords.has(record.id)}
                      onToggle={() => toggleRecord(record.id)}
                      onViewSource={() => handleViewSource(record)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-[12px]">
            No treatment records match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────

function MetricCard({ icon: Icon, label, value, alert }: { icon: React.ElementType; label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${alert ? "text-[hsl(var(--status-review))]" : "text-muted-foreground"}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
        <p className={`text-[13px] font-semibold leading-tight mt-0.5 ${alert ? "text-[hsl(var(--status-review-foreground))]" : "text-foreground"}`}>{value}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, options, labels, onChange,
}: {
  label: string; value: string; options: string[]; labels?: Record<string, string>; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] rounded-md border border-border bg-background px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>{labels ? labels[o] || o : o}</option>
        ))}
      </select>
    </div>
  );
}

function TreatmentRecordRow({
  record: r, flags, expanded, onToggle, onViewSource,
}: {
  record: ReviewerTreatmentRecord; flags: ReviewFlag[]; expanded: boolean; onToggle: () => void; onViewSource: () => void;
}) {
  const hasFlags = flags.length > 0;
  const hasErrors = flags.some((f) => f.severity === "error");
  return (
    <div
      id={`tr-${r.id}`}
      className={`border-b last:border-b-0 border-border/50 ${r.is_duplicate_suspect ? "bg-[hsl(var(--status-review-bg))]/40" : ""} ${hasErrors ? "border-l-2 border-l-[hsl(var(--status-failed))]/40" : hasFlags ? "border-l-2 border-l-[hsl(var(--status-review))]/40" : ""}`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-accent/30 transition-colors cursor-pointer" onClick={onToggle}>
        {/* Date */}
        <div className="w-[80px] shrink-0">
          {r.visit_date ? (
            <span className={`text-[11px] font-medium ${r.is_date_ambiguous ? "text-[hsl(var(--status-review))]" : "text-foreground"}`}>
              {format(parseISO(r.visit_date), "MMM d, yyyy")}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">No date</span>
          )}
          {r.is_date_ambiguous && <HelpCircle className="inline h-2.5 w-2.5 ml-0.5 text-[hsl(var(--status-review))]" />}
        </div>

        {/* Visit type badge */}
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground shrink-0 w-[72px] text-center truncate">
          {VISIT_TYPE_LABEL[r.visit_type]}
        </span>

        {/* Body parts */}
        <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
          {r.body_parts.slice(0, 3).map((bp) => (
            <span key={bp} className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/6 text-primary font-medium truncate max-w-[120px]">{bp}</span>
          ))}
          {r.body_parts.length > 3 && <span className="text-[9px] text-muted-foreground">+{r.body_parts.length - 3}</span>}
        </div>

        {/* Key diagnosis */}
        <div className="hidden lg:block w-[180px] truncate">
          {r.diagnoses[0] && (
            <span className="text-[10px] text-muted-foreground">
              {r.diagnoses[0].code && <span className="font-mono text-foreground mr-1">{r.diagnoses[0].code}</span>}
              {r.diagnoses[0].description}
            </span>
          )}
        </div>

        {/* Billed */}
        <div className="hidden md:block w-[60px] text-right">
          {r.total_billed != null ? (
            <span className="text-[10px] font-medium text-foreground">${r.total_billed.toLocaleString()}</span>
          ) : (
            <span className="text-[9px] text-muted-foreground">—</span>
          )}
        </div>

        {/* Confidence */}
        <span className={`text-[9px] font-semibold w-[40px] text-center ${CONFIDENCE_COLOR[r.confidence_tier]}`}>
          {CONFIDENCE_TIER_LABEL[r.confidence_tier]}
        </span>

        {/* Review state */}
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md w-[72px] text-center ${REVIEW_STATE_STYLE[r.review_state]}`}>
          {REVIEW_STATE_LABEL[r.review_state]}
        </span>

        {/* Duplicate flag */}
        {r.is_duplicate_suspect && (
          <span title="Possible duplicate">
            <Copy className="h-3 w-3 text-[hsl(var(--status-review))] shrink-0" />
          </span>
        )}

        {/* Flag count indicator */}
        {hasFlags && (
          <span
            className={`text-[8px] font-bold px-1 py-0.5 rounded-md shrink-0 ${
              hasErrors ? "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed))]" : "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review))]"
            }`}
            title={`${flags.length} issue(s)`}
          >
            {flags.length} {flags.length === 1 ? "issue" : "issues"}
          </span>
        )}

        {/* Source link */}
        <button
          onClick={(e) => { e.stopPropagation(); onViewSource(); }}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors shrink-0"
          title="View source document"
        >
          <FileText className="h-3 w-3" />
        </button>

        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* SOAP Summary */}
            <div className="flex flex-col gap-2">
              {r.subjective_summary && <SoapSection label="Subjective" text={r.subjective_summary} />}
              {r.objective_findings && <SoapSection label="Objective" text={r.objective_findings} />}
              {r.assessment_summary && <SoapSection label="Assessment" text={r.assessment_summary} />}
              {r.plan_summary && <SoapSection label="Plan" text={r.plan_summary} />}
            </div>

            {/* Structured data */}
            <div className="flex flex-col gap-2">
              {/* Diagnoses */}
              {r.diagnoses.length > 0 && (
                <DetailBlock label="Diagnoses">
                  {r.diagnoses.map((d, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 text-[10px]">
                      {d.code && <span className="font-mono text-foreground font-medium">{d.code}</span>}
                      <span className="text-muted-foreground">{d.description}</span>
                      {d.is_primary && <span className="text-[8px] px-1 py-0.5 rounded bg-primary/8 text-primary font-semibold">Primary</span>}
                    </div>
                  ))}
                </DetailBlock>
              )}

              {/* Procedures */}
              {r.procedures.length > 0 && (
                <DetailBlock label="Procedures">
                  {r.procedures.map((p, i) => (
                    <div key={i} className="flex items-baseline gap-1.5 text-[10px]">
                      {p.code && <span className="font-mono text-foreground font-medium">{p.code}</span>}
                      <span className="text-muted-foreground">{p.description}</span>
                    </div>
                  ))}
                </DetailBlock>
              )}

              {/* Medications */}
              {r.medications.length > 0 && (
                <DetailBlock label="Medications">
                  {r.medications.map((m, i) => (
                    <span key={i} className="text-[10px] text-muted-foreground">
                      <span className="text-foreground font-medium">{m.name}</span>
                      {m.dosage && ` ${m.dosage}`}{m.frequency && ` ${m.frequency}`}
                      {i < r.medications.length - 1 && " · "}
                    </span>
                  ))}
                </DetailBlock>
              )}

              {/* Restrictions */}
              {r.restrictions.length > 0 && (
                <DetailBlock label="Restrictions">
                  {r.restrictions.map((rs, i) => (
                    <div key={i} className="text-[10px] text-muted-foreground">
                      <span className="font-medium text-foreground capitalize">{rs.type}:</span> {rs.detail}
                    </div>
                  ))}
                </DetailBlock>
              )}

              {r.follow_up_recommendations && (
                <DetailBlock label="Follow-Up">
                  <p className="text-[10px] text-muted-foreground">{r.follow_up_recommendations}</p>
                </DetailBlock>
              )}

              {/* Source snippet */}
              {r.source_snippet && (
                <div className="mt-1">
                  <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Source Excerpt</p>
                  <div className="evidence-text text-[10px] text-muted-foreground bg-accent/60 rounded-md px-2.5 py-1.5 border-l-2 border-primary/30 leading-relaxed">
                    "{r.source_snippet}"
                  </div>
                  <button
                    onClick={onViewSource}
                    className="mt-1 flex items-center gap-1 text-[9px] text-primary hover:underline"
                  >
                    <FileText className="h-2.5 w-2.5" />
                    View page {r.source_page_start}{r.source_page_end && r.source_page_end !== r.source_page_start ? `–${r.source_page_end}` : ""}
                  </button>
                </div>
              )}

              {/* Duplicate info */}
              {r.is_duplicate_suspect && (
                <div className="rounded-md border border-[hsl(var(--status-review))]/20 bg-[hsl(var(--status-review-bg))] px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-[hsl(var(--status-review-foreground))]">
                    <Copy className="h-3 w-3" />
                    <span className="font-semibold">Possible Duplicate</span>
                    {r.duplicate_similarity != null && <span>({(r.duplicate_similarity * 100).toFixed(0)}% match)</span>}
                  </div>
                  {r.duplicate_reason && <p className="text-[9px] text-[hsl(var(--status-review-foreground))] mt-0.5">{r.duplicate_reason}</p>}
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/30">
            <ActionButton icon={CheckCircle2} label="Accept" variant="approved" />
            <ActionButton icon={Edit3} label="Correct" />
            <ActionButton icon={HelpCircle} label="Uncertain" variant="review" />
            <ActionButton icon={Copy} label="Flag Duplicate" variant="review" />
            <ActionButton icon={Link2} label="Link Bill" />
            <ActionButton icon={Unlink} label="Unlink Bill" />
            <div className="ml-auto">
              <ActionButton icon={Users} label="Merge Provider" />
            </div>
          </div>

          {/* Provenance */}
          <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground/70">
            <span>Model: {r.extraction_model}</span>
            <span>v{r.extraction_version}</span>
            <span>Extracted: {format(parseISO(r.extracted_at), "MMM d, yyyy HH:mm")}</span>
            {r.reviewed_at && <span>Reviewed: {format(parseISO(r.reviewed_at), "MMM d, yyyy")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function SoapSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-[9px] font-semibold text-primary uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function DetailBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ActionButton({
  icon: Icon, label, variant,
}: {
  icon: React.ElementType; label: string; variant?: "approved" | "review";
}) {
  const styles = variant === "approved"
    ? "text-[hsl(var(--status-approved-foreground))] hover:bg-[hsl(var(--status-approved-bg))]"
    : variant === "review"
      ? "text-[hsl(var(--status-review-foreground))] hover:bg-[hsl(var(--status-review-bg))]"
      : "text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <button className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${styles}`} title={label}>
      <Icon className="h-3 w-3" />
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}
