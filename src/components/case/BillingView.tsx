import { useState, useMemo } from "react";
import { useCasePackage } from "@/hooks/useCasePackage";
import { CitationBadge, type CitationSource } from "./EvidenceCitation";
import type { BillingLine, Provider } from "@/types";
import { BillStatus } from "@/types";
import {
  Search,
  X,
  ChevronDown,
  ChevronRight,
  DollarSign,
  AlertTriangle,
  Building2,
  Stethoscope,
  Calendar,
  Download,
  Filter,
  Copy,
  TrendingUp,
  FileText,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────
function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function cur(n: number | null | undefined): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type ViewMode = "line" | "provider" | "facility";
type SortKey = "date" | "billed" | "provider";
type SortDir = "asc" | "desc";

// ─── Duplicate detection ─────────────────────────────
interface FlaggedBill extends BillingLine {
  flags: string[];
}

function flagBills(bills: BillingLine[]): FlaggedBill[] {
  const flagged: FlaggedBill[] = bills.map((b) => ({ ...b, flags: [] }));

  // Duplicate detection: same CPT + same date + same provider
  for (let i = 0; i < flagged.length; i++) {
    for (let j = i + 1; j < flagged.length; j++) {
      const a = flagged[i], b = flagged[j];
      if (
        a.service_date === b.service_date &&
        a.provider_id === b.provider_id &&
        a.cpt_codes.some((c) => b.cpt_codes.includes(c))
      ) {
        if (!a.flags.includes("Possible duplicate")) a.flags.push("Possible duplicate");
        if (!b.flags.includes("Possible duplicate")) b.flags.push("Possible duplicate");
      }
    }
  }

  // High charge pattern: billed > 3x paid
  flagged.forEach((b) => {
    if (b.billed_amount > 0 && b.paid_amount != null && b.paid_amount > 0) {
      const ratio = b.billed_amount / b.paid_amount;
      if (ratio > 3) b.flags.push(`Billed ${ratio.toFixed(1)}× paid`);
    }
    if (b.billed_amount > 5000 && b.cpt_codes.length === 0) {
      b.flags.push("High charge, no CPT");
    }
  });

  return flagged;
}

// ─── Status badge ────────────────────────────────────
const STATUS_STYLE: Record<string, { icon: React.ElementType; class: string }> = {
  paid: { icon: CheckCircle2, class: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]" },
  approved: { icon: CheckCircle2, class: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]" },
  submitted: { icon: Clock, class: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]" },
  under_review: { icon: Clock, class: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]" },
  denied: { icon: XCircle, class: "bg-destructive/10 text-destructive" },
  reduced: { icon: TrendingUp, class: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]" },
  appealed: { icon: AlertTriangle, class: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]" },
};

// ─── Main Component ──────────────────────────────────
const BillingView = () => {
  const { pkg, hasData } = useCasePackage();
  const bills = pkg.billing_lines;
  const providers = pkg.providers;

  const [viewMode, setViewMode] = useState<ViewMode>("line");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Flag bills
  const flaggedBills = useMemo(() => flagBills(bills), [bills]);

  // Filter
  const filtered = useMemo(() => {
    if (!hasData) return [];
    let items = flaggedBills;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (b) =>
          b.description.toLowerCase().includes(q) ||
          b.provider_name.toLowerCase().includes(q) ||
          b.facility_name.toLowerCase().includes(q) ||
          b.cpt_codes.some((c) => c.toLowerCase().includes(q))
      );
    }
    if (providerFilter) items = items.filter((b) => b.provider_id === providerFilter);
    if (dateFrom) items = items.filter((b) => (b.service_date ?? "") >= dateFrom);
    if (dateTo) items = items.filter((b) => (b.service_date ?? "") <= dateTo);
    return items;
  }, [hasData, flaggedBills, search, providerFilter, dateFrom, dateTo]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "date") return ((a.service_date ?? "") > (b.service_date ?? "") ? 1 : -1) * dir;
      if (sortKey === "billed") return (a.billed_amount - b.billed_amount) * dir;
      return (a.provider_name > b.provider_name ? 1 : -1) * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Grouping for provider/facility views
  const grouped = useMemo(() => {
    if (viewMode === "line") return null;
    const map = new Map<string, FlaggedBill[]>();
    sorted.forEach((b) => {
      const key = viewMode === "provider" ? b.provider_name : b.facility_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });
    return map;
  }, [sorted, viewMode]);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-11 w-11 rounded-xl bg-accent/60 flex items-center justify-center mb-3.5">
          <DollarSign className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <h3 className="text-[13px] font-semibold text-foreground mb-1">No billing data available</h3>
        <p className="text-[11px] text-muted-foreground max-w-[260px] leading-relaxed">Billing line items will appear here after medical bills and billing records are processed.</p>
      </div>
    );
  }

  // Summary stats
  const totalBilled = filtered.reduce((s, b) => s + b.billed_amount, 0);
  const totalPaid = filtered.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
  const totalAdjusted = filtered.reduce((s, b) => s + (b.adjusted_amount ?? 0), 0);
  const flagCount = filtered.filter((b) => b.flags.length > 0).length;
  const uniqueProviders = new Set(filtered.map((b) => b.provider_id)).size;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleExport = () => {
    const header = "Date,Provider,Facility,Description,CPT,Billed,Paid,Adjusted,Status,Flags";
    const rows = sorted.map((b) =>
      [
        b.service_date ?? "",
        `"${b.provider_name}"`,
        `"${b.facility_name}"`,
        `"${b.description}"`,
        `"${b.cpt_codes.join("; ")}"`,
        b.billed_amount,
        b.paid_amount ?? "",
        b.adjusted_amount ?? "",
        b.bill_status,
        `"${b.flags.join("; ")}"`,
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "billing-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">Billing Analysis</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {filtered.length} charges · {uniqueProviders} providers · {flagCount > 0 && <span className="text-destructive font-medium">{flagCount} flagged</span>}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        <SummaryCard label="Total Billed" value={cur(totalBilled)} icon={DollarSign} />
        <SummaryCard label="Total Paid" value={cur(totalPaid)} icon={CheckCircle2} accent />
        <SummaryCard label="Adjustments" value={cur(totalAdjusted)} icon={TrendingUp} />
        <SummaryCard label="Reduction" value={totalBilled > 0 ? `${Math.round((totalAdjusted / totalBilled) * 100)}%` : "—"} icon={AlertTriangle} warn={totalAdjusted / totalBilled > 0.2} />
        <SummaryCard label="Flagged" value={flagCount.toString()} icon={Copy} warn={flagCount > 0} />
      </div>

      {/* Controls Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* View toggles */}
        <div className="flex gap-px bg-accent rounded-lg p-0.5">
          {([
            { key: "line" as ViewMode, label: "Line Items", icon: FileText },
            { key: "provider" as ViewMode, label: "By Provider", icon: Stethoscope },
            { key: "facility" as ViewMode, label: "By Facility", icon: Building2 },
          ]).map((v) => (
            <button
              key={v.key}
              onClick={() => setViewMode(v.key)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-all ${
                viewMode === v.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <v.icon className="h-3 w-3" />
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border transition-all ${
            showFilters || providerFilter || dateFrom || dateTo
              ? "bg-primary/10 text-primary border-primary/20"
              : "bg-accent/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Filter className="h-3 w-3" />
          Filters
          {(providerFilter || dateFrom || dateTo) && (
            <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
              {[providerFilter, dateFrom, dateTo].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Search */}
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search charges…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-[11px] bg-accent/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Export */}
        <button onClick={handleExport} className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium rounded-lg border border-border bg-accent/40 text-muted-foreground hover:text-foreground transition-all">
          <Download className="h-3 w-3" />
          Export CSV
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card-elevated p-3 mb-3 flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Provider</label>
            <select
              value={providerFilter ?? ""}
              onChange={(e) => setProviderFilter(e.target.value || null)}
              className="text-[11px] bg-accent border border-border rounded-lg px-2 py-1.5 text-foreground outline-none min-w-[160px]"
            >
              <option value="">All Providers</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-[11px] bg-accent border border-border rounded-lg px-2 py-1.5 text-foreground outline-none" />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-[11px] bg-accent border border-border rounded-lg px-2 py-1.5 text-foreground outline-none" />
          </div>
          {(providerFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setProviderFilter(null); setDateFrom(""); setDateTo(""); }}
              className="text-[10px] text-primary font-medium hover:text-primary/80 pb-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ── LINE ITEM VIEW ─────────────────────── */}
      {viewMode === "line" && (
        <div className="card-elevated overflow-hidden">
          {/* Table header (sticky) */}
          <div className="sticky top-0 z-10 bg-accent/80 backdrop-blur-sm border-b border-border">
            <div className="grid grid-cols-[28px_80px_1fr_100px_90px_90px_90px_80px_80px] items-center px-3 py-2 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
              <span />
              <SortHeader label="Date" sortKey="date" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <span>Description</span>
              <span>CPT</span>
              <SortHeader label="Billed" sortKey="billed" current={sortKey} dir={sortDir} onSort={toggleSort} />
              <span>Allowed</span>
              <span>Paid</span>
              <span>Balance</span>
              <span>Status</span>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/30">
            {sorted.map((b) => (
              <BillRow key={b.id} bill={b} expanded={expandedRows.has(b.id)} onToggle={() => toggleRow(b.id)} providers={providers} />
            ))}
            {sorted.length === 0 && (
              <div className="px-4 py-8 text-center text-[11px] text-muted-foreground">No charges match your filters.</div>
            )}
          </div>

          {/* Totals row */}
          {sorted.length > 0 && (
            <div className="sticky bottom-0 bg-accent/80 backdrop-blur-sm border-t border-border">
              <div className="grid grid-cols-[28px_80px_1fr_100px_90px_90px_90px_80px_80px] items-center px-3 py-2.5">
                <span />
                <span />
                <span className="text-[11px] font-bold text-foreground">{sorted.length} charges</span>
                <span />
                <span className="text-[11px] font-bold text-foreground tabular-nums">{cur(totalBilled)}</span>
                <span />
                <span className="text-[11px] font-bold text-foreground tabular-nums">{cur(totalPaid)}</span>
                <span className="text-[11px] font-bold text-destructive tabular-nums">{cur(totalAdjusted)}</span>
                <span />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── GROUPED VIEWS ──────────────────────── */}
      {grouped && (
        <div className="flex flex-col gap-3">
          {Array.from(grouped.entries())
            .sort(([, a], [, b]) => b.reduce((s, x) => s + x.billed_amount, 0) - a.reduce((s, x) => s + x.billed_amount, 0))
            .map(([groupName, items]) => {
              const gBilled = items.reduce((s, b) => s + b.billed_amount, 0);
              const gPaid = items.reduce((s, b) => s + (b.paid_amount ?? 0), 0);
              const gAdj = items.reduce((s, b) => s + (b.adjusted_amount ?? 0), 0);
              const gFlags = items.filter((b) => b.flags.length > 0).length;
              const [expanded, setExpanded] = useState(true);

              return (
                <div key={groupName} className="card-elevated overflow-hidden">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full px-4 py-3 flex items-center gap-2.5 hover:bg-accent/30 transition-colors text-left"
                  >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    {viewMode === "provider" ? <Stethoscope className="h-3.5 w-3.5 text-primary" /> : <Building2 className="h-3.5 w-3.5 text-primary" />}
                    <span className="text-[12px] font-semibold text-foreground flex-1">{groupName}</span>
                    <span className="text-[10px] text-muted-foreground">{items.length} charges</span>
                    {gFlags > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] font-medium text-destructive bg-destructive/8 px-1.5 py-0.5 rounded">
                        <AlertTriangle className="h-2.5 w-2.5" />{gFlags}
                      </span>
                    )}
                    <span className="text-[12px] font-bold text-foreground tabular-nums ml-2">{cur(gBilled)}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">→ {cur(gPaid)}</span>
                  </button>

                  {expanded && (
                    <div className="border-t border-border/50">
                      {/* Mini table header */}
                      <div className="grid grid-cols-[80px_1fr_90px_90px_90px_80px_80px] items-center px-4 py-1.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest bg-accent/40">
                        <span>Date</span>
                        <span>Description</span>
                        <span>CPT</span>
                        <span>Billed</span>
                        <span>Paid</span>
                        <span>Adj</span>
                        <span>Status</span>
                      </div>
                      <div className="divide-y divide-border/20">
                        {items.map((b) => (
                          <div key={b.id} className="grid grid-cols-[80px_1fr_90px_90px_90px_80px_80px] items-center px-4 py-2 hover:bg-accent/20 transition-colors">
                            <span className="text-[11px] text-foreground tabular-nums">{fmt(b.service_date)}</span>
                            <div className="min-w-0">
                              <p className="text-[11px] text-foreground truncate">{b.description}</p>
                              {b.flags.length > 0 && (
                                <div className="flex gap-1 mt-0.5">
                                  {b.flags.map((f, i) => (
                                    <span key={i} className="inline-flex items-center gap-0.5 text-[8px] font-medium text-destructive bg-destructive/8 px-1 py-0.5 rounded">
                                      <AlertTriangle className="h-2 w-2" />{f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-0.5">
                              {b.cpt_codes.map((c) => (
                                <code key={c} className="text-[9px] font-mono bg-accent text-foreground/70 px-1 py-0.5 rounded">{c}</code>
                              ))}
                            </div>
                            <span className="text-[11px] font-semibold text-foreground tabular-nums">{cur(b.billed_amount)}</span>
                            <span className="text-[11px] text-foreground tabular-nums">{cur(b.paid_amount)}</span>
                            <span className="text-[11px] text-destructive tabular-nums">{b.adjusted_amount ? `−${cur(b.adjusted_amount)}` : "—"}</span>
                            <StatusChip status={b.bill_status} />
                          </div>
                        ))}
                      </div>
                      {/* Group total */}
                      <div className="grid grid-cols-[80px_1fr_90px_90px_90px_80px_80px] items-center px-4 py-2 bg-accent/30 border-t border-border/50">
                        <span />
                        <span className="text-[10px] font-semibold text-muted-foreground">Subtotal</span>
                        <span />
                        <span className="text-[11px] font-bold text-foreground tabular-nums">{cur(gBilled)}</span>
                        <span className="text-[11px] font-bold text-foreground tabular-nums">{cur(gPaid)}</span>
                        <span className="text-[11px] font-bold text-destructive tabular-nums">{gAdj > 0 ? `−${cur(gAdj)}` : "—"}</span>
                        <span />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

// ─── Bill Row (expandable) ───────────────────────────
function BillRow({ bill, expanded, onToggle, providers }: { bill: FlaggedBill; expanded: boolean; onToggle: () => void; providers: Provider[] }) {
  const provider = providers.find((p) => p.id === bill.provider_id);
  const balance = bill.billed_amount - (bill.paid_amount ?? 0) - (bill.adjusted_amount ?? 0);

  return (
    <>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[28px_80px_1fr_100px_90px_90px_90px_80px_80px] items-center px-3 py-2.5 text-left hover:bg-accent/20 transition-colors group"
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground opacity-40 group-hover:opacity-100" />}
        <span className="text-[11px] text-foreground tabular-nums">{fmt(bill.service_date)}</span>
        <div className="min-w-0 pr-2">
          <p className="text-[11px] text-foreground truncate font-medium">{bill.description}</p>
          <p className="text-[10px] text-muted-foreground truncate">{bill.provider_name}{bill.facility_name && bill.facility_name !== bill.provider_name ? ` · ${bill.facility_name}` : ""}</p>
          {bill.flags.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {bill.flags.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-0.5 text-[8px] font-medium text-destructive bg-destructive/8 px-1 py-0.5 rounded border border-destructive/15">
                  <AlertTriangle className="h-2 w-2" />{f}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-0.5">
          {bill.cpt_codes.map((c) => (
            <code key={c} className="text-[9px] font-mono bg-primary/5 text-primary px-1.5 py-0.5 rounded border border-primary/15">{c}</code>
          ))}
          {bill.cpt_codes.length === 0 && <span className="text-[9px] text-muted-foreground/50">—</span>}
        </div>
        <span className="text-[11px] font-semibold text-foreground tabular-nums">{cur(bill.billed_amount)}</span>
        <span className="text-[11px] text-foreground tabular-nums">{cur(bill.allowed_amount)}</span>
        <span className="text-[11px] text-foreground tabular-nums">{cur(bill.paid_amount)}</span>
        <span className={`text-[11px] tabular-nums ${balance > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
          {balance > 0 ? cur(balance) : "—"}
        </span>
        <StatusChip status={bill.bill_status} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 py-3 bg-accent/20 border-t border-border/30">
          <div className="grid grid-cols-3 gap-4 text-[11px]">
            <div>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Provider Details</span>
              <p className="text-foreground font-medium">{bill.provider_name}</p>
              <p className="text-muted-foreground">{bill.facility_name}</p>
              {provider && (
                <p className="text-muted-foreground mt-0.5">{provider.specialty} · {provider.total_visits} total visits</p>
              )}
            </div>
            <div>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Diagnosis Codes</span>
              <div className="flex flex-wrap gap-1">
                {bill.diagnosis_codes.length > 0
                  ? bill.diagnosis_codes.map((d) => (
                      <code key={d} className="text-[10px] font-mono bg-accent text-foreground px-1.5 py-0.5 rounded border border-border">{d}</code>
                    ))
                  : <span className="text-muted-foreground">No ICD codes linked</span>
                }
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest block mb-1">Financial Breakdown</span>
              <div className="space-y-0.5">
                <div className="flex justify-between"><span className="text-muted-foreground">Billed</span><span className="text-foreground font-medium tabular-nums">{cur(bill.billed_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Allowed</span><span className="tabular-nums">{cur(bill.allowed_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{cur(bill.paid_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Adjusted</span><span className="text-destructive tabular-nums">{bill.adjusted_amount ? `−${cur(bill.adjusted_amount)}` : "—"}</span></div>
                <div className="flex justify-between border-t border-border/50 pt-0.5 mt-0.5">
                  <span className="font-medium text-foreground">Balance</span>
                  <span className={`font-bold tabular-nums ${balance > 0 ? "text-destructive" : "text-foreground"}`}>{cur(balance)}</span>
                </div>
              </div>
            </div>
          </div>
          {bill.notes && (
            <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/30">{bill.notes}</p>
          )}
        </div>
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────
function SummaryCard({ label, value, icon: Icon, accent, warn }: { label: string; value: string; icon: React.ElementType; accent?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${warn ? "text-destructive" : accent ? "text-[hsl(var(--status-approved))]" : "text-primary"}`} />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <p className={`text-[14px] font-bold tabular-nums ${warn ? "text-destructive" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function StatusChip({ status }: { status: BillStatus }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.submitted;
  const SIcon = s.icon;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${s.class}`}>
      <SIcon className="h-2 w-2" />
      {status.replace("_", " ")}
    </span>
  );
}

function SortHeader({ label, sortKey, current, dir, onSort }: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <button onClick={() => onSort(sortKey)} className="flex items-center gap-0.5 hover:text-foreground transition-colors">
      {label}
      <ArrowUpDown className={`h-2.5 w-2.5 ${active ? "text-primary" : "text-muted-foreground/40"}`} />
    </button>
  );
}

export default BillingView;
