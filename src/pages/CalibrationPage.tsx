/**
 * EvaluateIQ — Calibration Corpus Admin Page
 *
 * Admin-only page for importing and browsing historical closed claims.
 */

import { useState, useCallback, useRef } from "react";
import {
  Database,
  Upload,
  FileText,
  BarChart3,
  History,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Download,
  Filter,
  Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHistoricalClaims,
  useCalibrationImports,
  useCorpusStats,
  useImportHistoricalClaims,
} from "@/hooks/useCalibrationCorpus";
import { parseCSV, parseJSON } from "@/lib/csvParser";
import type { CalibrationQueryFilters, HistoricalClaim } from "@/types/calibration";
import { toast } from "sonner";

const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";

const CalibrationPage = () => {
  const { tenantId } = useAuth();
  const [tab, setTab] = useState<"corpus" | "import" | "history">("corpus");
  const [filters, setFilters] = useState<CalibrationQueryFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: claims = [], isLoading } = useHistoricalClaims(filters);
  const { data: imports = [] } = useCalibrationImports();
  const { data: stats } = useCorpusStats();
  const importMutation = useImportHistoricalClaims();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const isJSON = file.name.endsWith(".json");
      const records = isJSON ? parseJSON(text) : parseCSV(text);

      if (records.length === 0) {
        toast.error("No valid records found in file");
        return;
      }

      toast.info(`Importing ${records.length} records from ${file.name}...`);

      const result = await importMutation.mutateAsync({
        records,
        fileName: file.name,
        importType: isJSON ? "json" : "csv",
      });

      toast.success(`Import complete: ${result.successCount} imported, ${result.errorCount} errors`);
    } catch (err) {
      toast.error(`Import failed: ${String(err)}`);
    }

    if (fileRef.current) fileRef.current.value = "";
  }, [importMutation]);

  const tabs = [
    { key: "corpus" as const, label: "Corpus", icon: Database },
    { key: "import" as const, label: "Import", icon: Upload },
    { key: "history" as const, label: "Import History", icon: History },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Calibration Corpus</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Historical closed-claim data for EvaluateIQ calibration and benchmarking
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Claims" value={stats.total.toString()} icon={Database} />
          <StatCard label="With Settlement" value={stats.withSettlement.toString()} icon={CheckCircle2} />
          <StatCard label="Avg Settlement" value={fmt(Math.round(stats.avgSettlement))} icon={BarChart3} />
          <StatCard label="Avg Completeness" value={`${Math.round(stats.avgCompleteness)}%`} icon={Info} />
          <StatCard label="Venues" value={stats.uniqueStates.toString()} icon={Filter} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all ${
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Corpus Tab ─────────────────────────── */}
      {tab === "corpus" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-ghost text-[11px]"
            >
              <Filter className="h-3 w-3" /> Filters
              {showFilters ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
            <span className="text-[11px] text-muted-foreground">{claims.length} records</span>
          </div>

          {showFilters && (
            <div className="card-elevated p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <FilterInput label="Attorney" value={filters.attorney_name ?? ""} onChange={(v) => setFilters((f) => ({ ...f, attorney_name: v || undefined }))} />
              <FilterInput label="Venue State" value={filters.venue_state ?? ""} onChange={(v) => setFilters((f) => ({ ...f, venue_state: v || undefined }))} />
              <FilterInput label="Injury Category" value={filters.injury_category ?? ""} onChange={(v) => setFilters((f) => ({ ...f, injury_category: v || undefined }))} />
              <FilterInput label="Provider" value={filters.provider_name ?? ""} onChange={(v) => setFilters((f) => ({ ...f, provider_name: v || undefined }))} />
              <FilterInput label="Settlement Min ($)" value={filters.settlement_min?.toString() ?? ""} type="number" onChange={(v) => setFilters((f) => ({ ...f, settlement_min: v ? Number(v) : undefined }))} />
              <FilterInput label="Settlement Max ($)" value={filters.settlement_max?.toString() ?? ""} type="number" onChange={(v) => setFilters((f) => ({ ...f, settlement_max: v ? Number(v) : undefined }))} />
              <FilterInput label="Specials Min ($)" value={filters.specials_min?.toString() ?? ""} type="number" onChange={(v) => setFilters((f) => ({ ...f, specials_min: v ? Number(v) : undefined }))} />
              <FilterInput label="Specials Max ($)" value={filters.specials_max?.toString() ?? ""} type="number" onChange={(v) => setFilters((f) => ({ ...f, specials_max: v ? Number(v) : undefined }))} />
              <div className="col-span-2 md:col-span-4 flex gap-2">
                <button onClick={() => setFilters({})} className="btn-ghost text-[10px]">Reset Filters</button>
              </div>
            </div>
          )}

          {/* Claims table */}
          <div className="card-elevated overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Settlement</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Specials</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Venue</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Attorney</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Injuries</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Flags</th>
                  <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading corpus…</td></tr>
                ) : claims.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No historical claims found. Import data to get started.</td></tr>
                ) : (
                  claims.map((c) => (
                    <ClaimRow key={c.id} claim={c} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Import Tab ─────────────────────────── */}
      {tab === "import" && (
        <div className="space-y-5">
          <div className="card-elevated p-6">
            <div className="flex items-center gap-2 mb-4">
              <Upload className="h-4 w-4 text-primary" />
              <h2 className="text-[14px] font-semibold text-foreground">Import Historical Claims</h2>
            </div>

            <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed max-w-2xl">
              Upload a CSV or JSON file containing historical closed-claim data. Each record should include
              settlement amount, injury details, specials, venue, and other available fields. Missing fields
              are acceptable — completeness is tracked automatically.
            </p>

            {/* Upload zone */}
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-[12px] font-semibold text-foreground mb-1">
                Drop a CSV or JSON file here, or click to browse
              </p>
              <p className="text-[10px] text-muted-foreground">
                Supported: .csv, .json · Max recommended: 1,000 records per file
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {importMutation.isPending && (
              <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing import…
              </div>
            )}
          </div>

          {/* CSV Template */}
          <div className="card-elevated p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold text-foreground">CSV Template</h3>
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
              Use these column headers in your CSV file. Only <code className="text-[9px] bg-accent px-1 py-0.5 rounded">settlement_amount</code> is recommended; all others are optional.
            </p>
            <div className="bg-accent/50 rounded-lg p-3 overflow-x-auto">
              <code className="text-[9px] text-foreground/80 whitespace-nowrap">
                settlement_amount,loss_date,venue_state,county,attorney,attorney_firm,injuries,body_parts,surgery,injections,imaging,billed_specials,reviewed_specials,wage_loss,treatment_days,provider_count,policy_limits,liability,comp_neg,notes
              </code>
            </div>
            <p className="text-[9px] text-muted-foreground mt-2">
              Boolean fields (surgery, injections, imaging): use true/false, yes/no, or 1/0.
              Array fields (injuries, body_parts, providers): separate values with semicolons.
            </p>
          </div>
        </div>
      )}

      {/* ── Import History Tab ─────────────────── */}
      {tab === "history" && (
        <div className="card-elevated overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">File</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Type</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Records</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Success</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Errors</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Status</th>
                <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {imports.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">No imports yet.</td></tr>
              ) : (
                imports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-[11px] font-medium text-foreground">{imp.file_name}</td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground uppercase">{imp.import_type}</td>
                    <td className="px-4 py-3 text-[11px] text-right text-muted-foreground">{imp.record_count}</td>
                    <td className="px-4 py-3 text-[11px] text-right text-[hsl(var(--status-approved))]">{imp.success_count}</td>
                    <td className="px-4 py-3 text-[11px] text-right text-destructive">{imp.error_count}</td>
                    <td className="px-4 py-3">
                      <ImportStatusBadge status={imp.status} />
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(imp.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="card-elevated px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[16px] font-bold text-foreground tracking-tight">{value}</p>
    </div>
  );
}

function FilterInput({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground"
        placeholder={label}
      />
    </div>
  );
}

function ClaimRow({ claim: c }: { claim: HistoricalClaim }) {
  const flags = [
    c.has_surgery && "Surgery",
    c.has_injections && "Injections",
    c.has_imaging && "Imaging",
    c.has_hospitalization && "Hosp",
    c.has_permanency && "Perm",
  ].filter(Boolean);

  return (
    <tr className="hover:bg-accent/30 transition-colors">
      <td className="px-4 py-3 text-[12px] font-semibold text-foreground">{fmt(c.final_settlement_amount)}</td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">
        {c.billed_specials != null ? fmt(c.billed_specials) : "—"}
        {c.reviewed_specials != null && (
          <span className="text-[9px] text-primary ml-1">({fmt(c.reviewed_specials)} rev)</span>
        )}
      </td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">{c.venue_state || "—"}{c.venue_county ? `, ${c.venue_county}` : ""}</td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">{c.attorney_name || "—"}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {c.injury_categories.length > 0 ? c.injury_categories.slice(0, 3).map((cat) => (
            <span key={cat} className="text-[8px] font-semibold bg-accent text-muted-foreground px-1.5 py-0.5 rounded">{cat}</span>
          )) : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {flags.length > 0 ? flags.map((f) => (
            <span key={f} className="text-[8px] font-semibold bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention-foreground))] px-1.5 py-0.5 rounded">{f}</span>
          )) : <span className="text-[10px] text-muted-foreground">—</span>}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-[10px] font-bold ${c.completeness_score >= 75 ? "text-[hsl(var(--status-approved))]" : c.completeness_score >= 50 ? "text-[hsl(var(--status-attention))]" : "text-destructive"}`}>
          {c.completeness_score}%
        </span>
      </td>
    </tr>
  );
}

function ImportStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved-foreground))]",
    failed: "bg-destructive/10 text-destructive",
    processing: "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention-foreground))]",
    pending: "bg-muted text-muted-foreground",
  };

  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

export default CalibrationPage;
