import { useState, useMemo, useRef, useEffect } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import { useSourceDrawer } from "./SourceDrawer";
import type { TimelineEvent, TreatmentRecord, EvidenceReference } from "@/types";
import { TimelineCategory, TreatmentType } from "@/types";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ListFilter,
  X,
  Calendar,
  Zap,
  Syringe,
  Activity,
  Stethoscope,
  Scan,
  AlertTriangle,
  Clock,
  Briefcase,
  FileWarning,
  History,
  MessageCircle,
  Eye,
  EyeOff,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────
function refsToCS(refs: EvidenceReference[]): CitationSource[] {
  return refs.map((r) => ({
    docName: r.doc_name,
    page: r.page_label,
    excerpt: r.quoted_text,
    relevance: r.relevance as any,
  }));
}

function formatDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatFullDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getYearMonth(d: string): { year: string; month: string; monthKey: string } {
  const date = new Date(d + "T00:00:00");
  return {
    year: date.getFullYear().toString(),
    month: date.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
  };
}

// ─── Smart Badge Definitions ─────────────────────────
type BadgeKey =
  | "er" | "imaging" | "pt" | "injection" | "surgery_consult" | "work_status"
  | "gap" | "prior_history" | "red_flag" | "claimant_limitation" | "ime";

interface SmartBadgeDef {
  key: BadgeKey;
  label: string;
  icon: React.ElementType;
  className: string;
}

const SMART_BADGES: SmartBadgeDef[] = [
  { key: "er", label: "ER", icon: Zap, className: "bg-destructive/10 text-destructive border-destructive/20" },
  { key: "imaging", label: "Imaging", icon: Scan, className: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))] border-[hsl(var(--status-review)/0.2)]" },
  { key: "pt", label: "PT", icon: Activity, className: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))] border-[hsl(var(--status-processing)/0.2)]" },
  { key: "injection", label: "Injection", icon: Syringe, className: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)]" },
  { key: "surgery_consult", label: "Surgery Consult", icon: Stethoscope, className: "bg-primary/10 text-primary border-primary/20" },
  { key: "work_status", label: "Work Status", icon: Briefcase, className: "bg-accent text-muted-foreground border-border" },
  { key: "gap", label: "Gap in Treatment", icon: Clock, className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))] border-[hsl(var(--status-attention)/0.2)]" },
  { key: "prior_history", label: "Prior History", icon: History, className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))] border-[hsl(var(--status-attention)/0.2)]" },
  { key: "red_flag", label: "Red Flag", icon: AlertTriangle, className: "bg-destructive/10 text-destructive border-destructive/20" },
  { key: "claimant_limitation", label: "Claimant-Reported", icon: MessageCircle, className: "bg-accent text-muted-foreground border-border" },
  { key: "ime", label: "IME", icon: FileWarning, className: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))] border-[hsl(var(--status-attention)/0.2)]" },
];

function getBadgeDef(key: BadgeKey): SmartBadgeDef {
  return SMART_BADGES.find((b) => b.key === key)!;
}

// ─── Unified Chronology Entry ────────────────────────
interface ChronoEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  provider?: string;
  facility?: string;
  bodyPart?: string;
  category: string;
  treatmentType?: TreatmentType;
  badges: BadgeKey[];
  citations: CitationSource[];
  procedureCodes?: string[];
  source: "timeline" | "treatment";
}

function buildEntries(
  events: TimelineEvent[],
  treatments: TreatmentRecord[]
): ChronoEntry[] {
  const entries: ChronoEntry[] = [];

  // Timeline events
  events.forEach((evt) => {
    const badges: BadgeKey[] = [];
    if (evt.category === TimelineCategory.FirstTreatment) badges.push("er");
    if (evt.category === TimelineCategory.Imaging) badges.push("imaging");
    if (evt.category === TimelineCategory.Injection) badges.push("injection");
    if (evt.category === TimelineCategory.Surgery) badges.push("surgery_consult");
    if (evt.category === TimelineCategory.IME) badges.push("ime");
    if (evt.category === TimelineCategory.Demand) badges.push("work_status");
    if (evt.description.toLowerCase().includes("pre-existing") || evt.description.toLowerCase().includes("prior")) badges.push("prior_history");
    if (evt.evidence_refs.some((r) => r.relevance === "contradicting")) badges.push("red_flag");

    entries.push({
      id: evt.id,
      date: evt.event_date,
      title: evt.label,
      description: evt.description,
      category: evt.category,
      badges,
      citations: refsToCS(evt.evidence_refs),
      source: "timeline",
    });
  });

  // Treatments not already covered by timeline events
  const timelineDates = new Set(events.map((e) => `${e.event_date}-${e.category}`));
  treatments.forEach((tx) => {
    if (!tx.treatment_date) return;
    const catMap: Record<string, string> = {
      emergency: "First Treatment",
      physical_therapy: "Treatment",
      injection: "Injection",
      diagnostic_imaging: "Imaging",
      surgery: "Surgery",
      outpatient: "Treatment",
    };
    const cat = catMap[tx.treatment_type] ?? "Treatment";
    const key = `${tx.treatment_date}-${cat}`;
    if (timelineDates.has(key)) return;

    const badges: BadgeKey[] = [];
    if (tx.treatment_type === TreatmentType.Emergency) badges.push("er");
    if (tx.treatment_type === TreatmentType.DiagnosticImaging) badges.push("imaging");
    if (tx.treatment_type === TreatmentType.PhysicalTherapy) badges.push("pt");
    if (tx.treatment_type === TreatmentType.Injection) badges.push("injection");
    if (tx.treatment_type === TreatmentType.Surgery) badges.push("surgery_consult");
    if (tx.description.toLowerCase().includes("light duty") || tx.description.toLowerCase().includes("work")) badges.push("work_status");
    if (tx.description.toLowerCase().includes("limitation") || tx.description.toLowerCase().includes("unable")) badges.push("claimant_limitation");

    entries.push({
      id: tx.id,
      date: tx.treatment_date,
      title: tx.description.split(".")[0],
      description: tx.description,
      provider: tx.provider_name,
      facility: tx.facility_name,
      bodyPart: undefined,
      category: cat,
      treatmentType: tx.treatment_type,
      badges,
      citations: refsToCS(tx.evidence_refs),
      procedureCodes: tx.procedure_codes,
      source: "treatment",
    });
  });

  // Inject gap-in-treatment badges
  entries.sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < entries.length; i++) {
    const prev = new Date(entries[i - 1].date + "T00:00:00");
    const curr = new Date(entries[i].date + "T00:00:00");
    const daysDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 21 && !entries[i].badges.includes("gap")) {
      entries[i].badges.push("gap");
    }
  }

  return entries;
}

// ─── Category colors ─────────────────────────────────
const CATEGORY_DOT: Record<string, string> = {
  Accident: "bg-destructive",
  "First Treatment": "bg-[hsl(var(--status-attention))]",
  Treatment: "bg-[hsl(var(--status-processing))]",
  Imaging: "bg-[hsl(var(--status-review))]",
  Injection: "bg-[hsl(var(--status-approved))]",
  IME: "bg-muted-foreground",
  Demand: "bg-primary",
  Surgery: "bg-destructive",
  Legal: "bg-primary",
  Administrative: "bg-muted-foreground",
};

// ─── Filter Options ──────────────────────────────────
const FILTER_CATEGORIES = [
  "All", "Accident", "First Treatment", "Treatment", "Imaging", "Injection", "IME", "Demand", "Surgery", "Legal",
];

// ─── Main Component ──────────────────────────────────
const ChronologySummaryTab = () => {
  const { pkg, hasData } = useCasePackage();
  const { openSource } = useSourceDrawer();

  // Build entries
  const allEntries = useMemo(
    () => buildEntries(pkg.timeline_events, pkg.treatments),
    [pkg.timeline_events, pkg.treatments]
  );

  // State — must be before any early returns
  const [search, setSearch] = useState("");
  const [detailMode, setDetailMode] = useState<"concise" | "detailed">("detailed");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [activeBadge, setActiveBadge] = useState<BadgeKey | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const tocRef = useRef<HTMLDivElement>(null);

  // Derived providers/facilities
  const providers = useMemo(() => {
    const set = new Set<string>();
    allEntries.forEach((e) => { if (e.provider) set.add(e.provider); });
    return Array.from(set);
  }, [allEntries]);

  // Filter logic
  const filtered = useMemo(() => {
    let entries = allEntries;
    if (activeCategory !== "All") entries = entries.filter((e) => e.category === activeCategory);
    if (activeProvider) entries = entries.filter((e) => e.provider === activeProvider || e.facility === activeProvider);
    if (activeBadge) entries = entries.filter((e) => e.badges.includes(activeBadge));
    if (search.trim()) {
      const q = search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.provider?.toLowerCase().includes(q) ||
          e.facility?.toLowerCase().includes(q)
      );
    }
    return entries;
  }, [allEntries, activeCategory, activeProvider, activeBadge, search]);

  // Group by year → month
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ChronoEntry[]>>();
    filtered.forEach((entry) => {
      const { year, month, monthKey } = getYearMonth(entry.date);
      if (!map.has(year)) map.set(year, new Map());
      const yearMap = map.get(year)!;
      if (!yearMap.has(monthKey)) yearMap.set(monthKey, []);
      yearMap.get(monthKey)!.push(entry);
    });
    return map;
  }, [filtered]);

  // TOC structure
  const tocItems = useMemo(() => {
    const items: { label: string; key: string; count: number; isYear?: boolean }[] = [];
    grouped.forEach((months, year) => {
      let yearCount = 0;
      months.forEach((entries) => (yearCount += entries.length));
      items.push({ label: year, key: `year-${year}`, count: yearCount, isYear: true });
      months.forEach((entries, monthKey) => {
        const monthLabel = entries[0]
          ? new Date(entries[0].date + "T00:00:00").toLocaleDateString("en-US", { month: "long" })
          : monthKey;
        items.push({ label: monthLabel, key: `month-${monthKey}`, count: entries.length });
      });
    });
    return items;
  }, [grouped]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleMonth = (key: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const scrollTo = (key: string) => {
    document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const clearFilters = () => {
    setActiveCategory("All");
    setActiveProvider(null);
    setActiveBadge(null);
    setSearch("");
  };

  const hasActiveFilters = activeCategory !== "All" || activeProvider || activeBadge || search.trim();

  return (
    <div className="flex gap-0 min-h-0">
      {/* ─── Main Column ─── */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Chronological Summary</h2>
            <span className="text-[10px] font-semibold bg-accent text-muted-foreground px-2 py-0.5 rounded-full">
              {filtered.length} of {allEntries.length} entries
            </span>
            <div className="flex-1" />

            {/* Display toggle */}
            <button
              onClick={() => setDetailMode((m) => (m === "concise" ? "detailed" : "concise"))}
              className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors"
              title={detailMode === "concise" ? "Switch to detailed view" : "Switch to concise view"}
            >
              {detailMode === "concise" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {detailMode === "concise" ? "Detailed" : "Concise"}
            </button>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-md transition-colors ${
                showFilters || hasActiveFilters
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
            >
              <ListFilter className="h-3 w-3" />
              Filters
              {hasActiveFilters && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chronology — dates, providers, procedures, keywords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-[12px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="p-3 rounded-lg border border-border bg-card mb-3 space-y-3">
              {/* Category filter */}
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Event Type</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {FILTER_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                        activeCategory === cat
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-accent/40 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider filter */}
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Provider / Facility</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <button
                    onClick={() => setActiveProvider(null)}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                      !activeProvider
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-accent/40 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    All
                  </button>
                  {providers.map((p) => (
                    <button
                      key={p}
                      onClick={() => setActiveProvider(activeProvider === p ? null : p)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                        activeProvider === p
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-accent/40 text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Badge filter */}
              <div>
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Smart Badges</span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {SMART_BADGES.map((b) => {
                    const Icon = b.icon;
                    const isActive = activeBadge === b.key;
                    return (
                      <button
                        key={b.key}
                        onClick={() => setActiveBadge(isActive ? null : b.key)}
                        className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : `${b.className} hover:opacity-80`
                        }`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {b.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-[10px] font-medium text-primary hover:underline">
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Timeline ─── */}
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No entries match your filters</p>
            <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-1">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[67px] top-0 bottom-0 w-px bg-border" />

            {Array.from(grouped.entries()).map(([year, months]) => (
              <div key={year} id={`year-${year}`}>
                {/* Year marker */}
                <div className="flex items-center gap-3 mb-4 relative">
                  <div className="w-[55px] shrink-0" />
                  <div className="relative z-10 h-6 w-6 rounded-full bg-primary flex items-center justify-center ring-4 ring-card">
                    <Calendar className="h-3 w-3 text-primary-foreground" />
                  </div>
                  <span className="text-[13px] font-bold text-foreground tracking-tight">{year}</span>
                </div>

                {Array.from(months.entries()).map(([monthKey, entries]) => {
                  const monthLabel = entries[0]
                    ? new Date(entries[0].date + "T00:00:00").toLocaleDateString("en-US", { month: "long" })
                    : monthKey;
                  const isCollapsed = collapsedMonths.has(monthKey);

                  return (
                    <div key={monthKey} id={`month-${monthKey}`} className="mb-4">
                      {/* Month header */}
                      <button
                        onClick={() => toggleMonth(monthKey)}
                        className="flex items-center gap-3 mb-2 ml-[55px] pl-6 group"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
                          {monthLabel}
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground/60 bg-accent px-1.5 py-0.5 rounded">
                          {entries.length}
                        </span>
                      </button>

                      {/* Entries */}
                      {!isCollapsed &&
                        entries.map((entry) => {
                          const isExpanded = expandedIds.has(entry.id);
                          const dotColor = CATEGORY_DOT[entry.category] ?? "bg-primary";

                          return (
                            <div
                              key={entry.id}
                              id={`entry-${entry.id}`}
                              className="flex gap-0 group/entry hover:bg-accent/20 rounded-r-lg transition-colors -ml-px"
                            >
                              {/* Date column */}
                              <div className="w-[55px] shrink-0 pt-3 pr-2 text-right">
                                <span className="text-[11px] font-semibold text-foreground tabular-nums leading-none">
                                  {formatDate(entry.date)}
                                </span>
                              </div>

                              {/* Dot */}
                              <div className="relative z-10 pt-3.5 px-[5px] shrink-0">
                                <div className={`h-[10px] w-[10px] rounded-full ${dotColor} ring-[3px] ring-card transition-transform group-hover/entry:scale-125`} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 py-2.5 pl-3 pr-2">
                                <button
                                  onClick={() => toggleExpand(entry.id)}
                                  className="flex items-start gap-2 w-full text-left"
                                >
                                  <div className="flex-1 min-w-0">
                                    {/* Title row */}
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[12px] font-semibold text-foreground leading-tight">
                                        {entry.title}
                                      </span>

                                      {/* Smart badges */}
                                      {entry.badges.map((bk) => {
                                        const bd = getBadgeDef(bk);
                                        const BIcon = bd.icon;
                                        return (
                                          <span
                                            key={bk}
                                            className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${bd.className}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveBadge(activeBadge === bk ? null : bk);
                                              setShowFilters(true);
                                            }}
                                          >
                                            <BIcon className="h-2 w-2" />
                                            {bd.label}
                                          </span>
                                        );
                                      })}
                                    </div>

                                    {/* Provider / facility */}
                                    {entry.provider && (
                                      <div className="flex items-center gap-1.5 mt-0.5">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveProvider(activeProvider === entry.provider ? null : entry.provider!);
                                          }}
                                          className="text-[10px] font-medium text-primary/80 hover:text-primary hover:underline transition-colors"
                                        >
                                          {entry.provider}
                                        </button>
                                        {entry.facility && entry.facility !== entry.provider && (
                                          <>
                                            <span className="text-[10px] text-muted-foreground/40">·</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveProvider(activeProvider === entry.facility ? null : entry.facility!);
                                              }}
                                              className="text-[10px] text-muted-foreground hover:text-foreground hover:underline transition-colors"
                                            >
                                              {entry.facility}
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Description (concise = 1 line, detailed = full) */}
                                    {detailMode === "detailed" && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 pr-4">
                                        {entry.description}
                                      </p>
                                    )}
                                  </div>

                                  {/* Citations (always visible) */}
                                  {entry.citations.length > 0 && (
                                    <div className="shrink-0 flex gap-0.5 mt-0.5">
                                      {entry.citations.slice(0, 2).map((c, i) => (
                                        <CitationBadge key={i} source={c} />
                                      ))}
                                      {entry.citations.length > 2 && (
                                        <span className="text-[9px] font-medium text-muted-foreground bg-accent px-1 py-0.5 rounded">
                                          +{entry.citations.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </button>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                  <div className="mt-2 pl-0 pb-1 border-t border-border/40 pt-2 space-y-2">
                                    {detailMode === "concise" && (
                                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                                        {entry.description}
                                      </p>
                                    )}

                                    {/* Full date */}
                                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                      <span>{formatFullDate(entry.date)}</span>
                                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent">
                                        {entry.category}
                                      </span>
                                    </div>

                                    {/* CPT codes */}
                                    {entry.procedureCodes && entry.procedureCodes.length > 0 && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">CPT</span>
                                        {entry.procedureCodes.map((code) => (
                                          <code key={code} className="text-[10px] font-mono bg-accent text-foreground px-1.5 py-0.5 rounded">
                                            {code}
                                          </code>
                                        ))}
                                      </div>
                                    )}

                                    {/* All citations with excerpts */}
                                    {entry.citations.length > 0 && (
                                      <div className="space-y-1.5">
                                        {entry.citations.map((c, ci) => (
                                          <button
                                            key={ci}
                                            onClick={() => openSource(c)}
                                            className="flex items-start gap-2 w-full text-left pl-3 border-l-2 border-primary/20 hover:border-primary/50 transition-colors group/cite"
                                          >
                                            <span className="text-[10px] font-semibold text-primary shrink-0 mt-0.5 bg-primary/5 px-1.5 py-0.5 rounded">
                                              {c.page}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                              <span className="text-[10px] font-medium text-foreground/80 group-hover/cite:text-foreground transition-colors">
                                                {c.docName}
                                              </span>
                                              {c.excerpt && (
                                                <p className="text-[10px] text-muted-foreground font-mono leading-relaxed mt-0.5 truncate">
                                                  "{c.excerpt}"
                                                </p>
                                              )}
                                            </div>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Right TOC Rail ─── */}
      <div ref={tocRef} className="w-[160px] shrink-0 ml-4 hidden xl:block">
        <div className="sticky top-0 pt-1">
          <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
            Jump To
          </span>
          <div className="flex flex-col gap-0.5">
            {tocItems.map((item) => (
              <button
                key={item.key}
                onClick={() => scrollTo(item.key)}
                className={`text-left px-2 py-1 rounded-md text-[10px] font-medium transition-colors hover:bg-accent hover:text-foreground ${
                  item.isYear
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground pl-4"
                }`}
              >
                {item.label}
                <span className="text-muted-foreground/50 ml-1">({item.count})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChronologySummaryTab;
