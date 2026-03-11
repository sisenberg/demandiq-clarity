import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCases, type CaseRow } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";
import { maskName, maskClaimNumber } from "@/lib/phi-utils";
import CreateCaseDialog from "@/components/case/CreateCaseDialog";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  Briefcase,
  Plus,
  ChevronRight,
  ChevronDown,
  Inbox,
  Search,
  SlidersHorizontal,
  Download,
  ExternalLink,
  ArrowUpDown,
  X,
  LayoutGrid,
  LayoutList,
  BookmarkPlus,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ─── Status mappings ────────────────────────────────
const CASE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  intake_in_progress: "Intake",
  intake_complete: "Intake Done",
  processing_in_progress: "Processing",
  complete: "Complete",
  exported: "Demand Completed",
  closed: "Closed",
  failed: "Failed",
};

const CASE_STATUS_BADGE: Record<string, string> = {
  draft: "status-badge-draft",
  intake_in_progress: "status-badge-processing",
  intake_complete: "status-badge-approved",
  processing_in_progress: "status-badge-processing",
  complete: "status-badge-approved",
  exported: "status-badge-approved",
  closed: "status-badge-draft",
  failed: "status-badge-failed",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "status-badge-draft",
  normal: "",
  high: "status-badge-review",
  urgent: "status-badge-failed",
};

const MODULE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Not Started", cls: "text-muted-foreground" },
  intake_in_progress: { label: "Intake", cls: "text-status-processing" },
  intake_complete: { label: "Ready for Processing", cls: "text-status-approved" },
  processing_in_progress: { label: "Processing", cls: "text-status-processing" },
  complete: { label: "Ready to Complete", cls: "text-status-attention" },
  exported: { label: "Demand Completed", cls: "text-status-approved" },
  closed: { label: "Closed", cls: "text-muted-foreground" },
  failed: { label: "Failed", cls: "text-status-failed" },
};

// ─── Filter options ─────────────────────────────────
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "intake_in_progress", label: "Intake" },
  { value: "intake_complete", label: "Intake Done" },
  { value: "processing_in_progress", label: "Processing" },
  { value: "complete", label: "Complete" },
  { value: "exported", label: "Demand Completed" },
  { value: "closed", label: "Closed" },
  { value: "failed", label: "Failed" },
];

type SortKey = "created_at" | "date_of_loss" | "claimant" | "case_status" | "updated_at";
type Density = "compact" | "comfortable";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Last Activity" },
  { key: "date_of_loss", label: "DOI" },
  { key: "claimant", label: "Claimant" },
  { key: "case_status", label: "Status" },
];

interface SavedView {
  id: string;
  label: string;
  filters: { statuses: string[] };
}

const DEFAULT_SAVED_VIEWS: SavedView[] = [
  { id: "all", label: "All Cases", filters: { statuses: [] } },
  { id: "active", label: "Active Work", filters: { statuses: ["draft", "intake_in_progress", "intake_complete", "processing_in_progress", "complete"] } },
  { id: "completed", label: "Completed", filters: { statuses: ["exported", "closed"] } },
  { id: "needs-attention", label: "Needs Attention", filters: { statuses: ["failed"] } },
];

// ─── Component ──────────────────────────────────────
const CasesPage = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const { data: cases = [], isLoading } = useCases();
  const [showCreate, setShowCreate] = useState(false);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [density, setDensity] = useState<Density>("comfortable");
  const [showFilters, setShowFilters] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeView, setActiveView] = useState("all");

  // Filter + search + sort
  const filteredCases = useMemo(() => {
    let result = [...cases];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          (c.title || "").toLowerCase().includes(q) ||
          c.claimant.toLowerCase().includes(q) ||
          c.case_number.toLowerCase().includes(q) ||
          (c.claim_number || "").toLowerCase().includes(q) ||
          (c.insured || "").toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilters.length > 0) {
      result = result.filter((c) => statusFilters.includes(c.case_status));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "updated_at":
          cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        case "date_of_loss":
          cmp = (a.date_of_loss ?? "").localeCompare(b.date_of_loss ?? "");
          break;
        case "claimant":
          cmp = a.claimant.localeCompare(b.claimant);
          break;
        case "case_status":
          cmp = a.case_status.localeCompare(b.case_status);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [cases, searchQuery, statusFilters, sortKey, sortAsc]);

  const handleSavedView = (view: SavedView) => {
    setActiveView(view.id);
    setStatusFilters(view.filters.statuses);
  };

  const toggleStatusFilter = (status: string) => {
    setActiveView("all");
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setShowSortMenu(false);
  };

  const clearFilters = () => {
    setStatusFilters([]);
    setSearchQuery("");
    setActiveView("all");
  };

  const isCompact = density === "compact";
  const rowPy = isCompact ? "py-2" : "py-3";
  const rowPx = "px-4";

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(d);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ─── Page Header ────────────────────────── */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-foreground tracking-tight leading-none">Cases</h1>
            <p className="text-[11px] text-muted-foreground mt-1">
              {isLoading ? "Loading…" : `${filteredCases.length} of ${cases.length} cases`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Complete Demand — top-level DemandIQ action */}
            {hasPermission(role, "complete_module") && (
              <button className="btn-secondary gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-approved" />
                Complete Demand
              </button>
            )}
            {hasPermission(role, "create_case") && (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="h-3.5 w-3.5" /> New Case
              </button>
            )}
          </div>
        </div>

        {/* ─── Saved Views ────────────────────── */}
        <div className="flex items-center gap-1 mb-3">
          {DEFAULT_SAVED_VIEWS.map((view) => (
            <button
              key={view.id}
              onClick={() => handleSavedView(view)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all duration-100 ${
                activeView === view.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent"
              }`}
            >
              {view.label}
            </button>
          ))}
          <button className="btn-ghost text-[11px] ml-1">
            <BookmarkPlus className="h-3 w-3" /> Save View
          </button>
        </div>

        {/* ─── Search + Filter Bar ────────────── */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="search-input flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <input
              type="text"
              placeholder="Search by case name, claimant, claim #, insured…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-ghost ${showFilters || statusFilters.length > 0 ? "text-primary" : ""}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
            {statusFilters.length > 0 && (
              <span className="text-[9px] font-bold bg-primary text-primary-foreground rounded-full h-4 w-4 flex items-center justify-center">
                {statusFilters.length}
              </span>
            )}
          </button>

          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="btn-ghost"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => handleSort(opt.key)}
                      className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-accent transition-colors flex items-center justify-between ${
                        sortKey === opt.key ? "text-primary font-medium" : "text-foreground"
                      }`}
                    >
                      {opt.label}
                      {sortKey === opt.key && (
                        <span className="text-[10px] text-muted-foreground">{sortAsc ? "↑" : "↓"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Density */}
          <div className="flex gap-px border border-border rounded-lg overflow-hidden p-0.5 bg-accent ml-1">
            <button
              onClick={() => setDensity("comfortable")}
              className={`p-1.5 rounded-md transition-all ${
                density === "comfortable" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Comfortable"
            >
              <LayoutGrid className="h-3 w-3" />
            </button>
            <button
              onClick={() => setDensity("compact")}
              className={`p-1.5 rounded-md transition-all ${
                density === "compact" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Compact"
            >
              <LayoutList className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* ─── Expanded Filters ───────────────── */}
        {showFilters && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Status</span>
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => toggleStatusFilter(opt.value)}
                  className={statusFilters.includes(opt.value) ? "filter-chip-active" : "filter-chip"}
                >
                  {opt.label}
                </button>
              ))}
              {statusFilters.length > 0 && (
                <button onClick={clearFilters} className="btn-ghost text-[11px] text-destructive">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Case Table ──────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <PageLoading message="Loading cases…" />
        ) : filteredCases.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Inbox}
              title={searchQuery || statusFilters.length > 0 ? "No matching cases" : "No cases yet"}
              description={searchQuery || statusFilters.length > 0 ? "Try adjusting your search or filters." : "Create your first case to get started."}
              action={
                (searchQuery || statusFilters.length > 0) ? (
                  <button onClick={clearFilters} className="btn-secondary text-[11px]">
                    Clear Filters
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="px-6 py-4">
            {/* Table header */}
            <div className={`grid grid-cols-[1fr_140px_100px_110px_120px_140px_100px] gap-3 ${rowPx} py-2 border-b border-border`}>
              <span className="section-label">Case</span>
              <span className="section-label">Claimant</span>
              <span className="section-label">DOI</span>
              <span className="section-label">Claim #</span>
              <span className="section-label">Module Status</span>
              <span className="section-label">Last Activity</span>
              <span className="section-label text-right">Actions</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-border">
              {filteredCases.map((c) => {
                const modStatus = MODULE_STATUS_LABEL[c.case_status] ?? { label: c.case_status, cls: "text-muted-foreground" };
                return (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[1fr_140px_100px_110px_120px_140px_100px] gap-3 ${rowPx} ${rowPy} items-center group hover:bg-accent/40 transition-colors cursor-pointer rounded-lg`}
                    onClick={() => navigate(`/cases/${c.id}`)}
                  >
                    {/* Case name + number */}
                    <div className="min-w-0">
                      <p className={`${isCompact ? "text-[12px]" : "text-[13px]"} font-medium text-foreground truncate group-hover:text-primary transition-colors`}>
                        {c.title || `${c.claimant} v. ${c.insured}`}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono">{c.case_number}</span>
                        {c.priority !== "normal" && PRIORITY_BADGE[c.priority] && (
                          <span className={PRIORITY_BADGE[c.priority]}>{c.priority}</span>
                        )}
                      </div>
                    </div>

                    {/* Claimant — masked in list view */}
                    <span className="text-[12px] text-foreground truncate" title="View case for full name">{maskName(c.claimant)}</span>

                    {/* DOI */}
                    <span className="text-[11px] text-muted-foreground">{formatDate(c.date_of_loss)}</span>

                    {/* Claim # — masked in list view */}
                    <span className="text-[11px] text-muted-foreground font-mono truncate">{c.claim_number ? maskClaimNumber(c.claim_number) : "—"}</span>

                    {/* Module status */}
                    <div className="flex items-center gap-1.5">
                      <span className={CASE_STATUS_BADGE[c.case_status] ?? "status-badge-draft"}>
                        {CASE_STATUS_LABEL[c.case_status] ?? c.case_status}
                      </span>
                    </div>

                    {/* Last activity */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-[11px] text-muted-foreground">{formatRelative(c.updated_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Link
                        to={`/cases/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-ghost p-1.5"
                        title="Open Case"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      {hasPermission(role, "download_artifacts") && c.case_status === "exported" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="btn-ghost p-1.5"
                          title="Download Package"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer summary */}
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                Showing {filteredCases.length} of {cases.length} cases
              </p>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-approved" />
                  {cases.filter((c) => c.case_status === "exported" || c.case_status === "complete").length} complete
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-processing" />
                  {cases.filter((c) => c.case_status === "processing_in_progress" || c.case_status === "intake_in_progress").length} in progress
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-status-failed" />
                  {cases.filter((c) => c.case_status === "failed").length} failed
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateCaseDialog open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
};

export default CasesPage;
