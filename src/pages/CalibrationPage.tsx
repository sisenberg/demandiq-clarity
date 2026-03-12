/**
 * EvaluateIQ — Calibration Console
 *
 * Admin page with tabs for: Corpus, Drift Analysis, Engine Config, Import, History.
 */

import { useState, useCallback, useRef, useMemo } from "react";
import {
  Database, Upload, FileText, BarChart3, History, Search,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronRight,
  Loader2, Download, Filter, Info, Settings2, TrendingUp,
  TrendingDown, Activity, Eye, Save, RotateCcw, Diff,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useHistoricalClaims, useCalibrationImports,
  useCorpusStats, useImportHistoricalClaims,
} from "@/hooks/useCalibrationCorpus";
import { useActiveCalibrationConfig, useCalibrationConfigHistory, useSaveCalibrationConfig } from "@/hooks/useCalibrationConfig";
import { computeDriftAnalysis, previewConfigImpact } from "@/lib/calibrationAnalytics";
import { parseCSV, parseJSON } from "@/lib/csvParser";
import type { CalibrationQueryFilters, HistoricalClaim } from "@/types/calibration";
import type {
  CalibrationConfig, SeverityMultiplierConfig, SeverityBandConfig,
  ConfigImpactPreview, DriftSummary, DriftSlice,
} from "@/types/calibration-config";
import {
  DEFAULT_SEVERITY_MULTIPLIERS, DEFAULT_CLINICAL_ADJUSTMENTS,
  DEFAULT_RELIABILITY_REDUCTIONS, DEFAULT_VENUE_MULTIPLIERS,
  DEFAULT_CONFIDENCE_RULES, getDefaultCalibrationConfig,
} from "@/types/calibration-config";
import { toast } from "sonner";

const fmt = (n: number | null) => n != null ? `$${n.toLocaleString()}` : "—";
const pct = (n: number) => `${n}%`;

type TabKey = "corpus" | "drift" | "config" | "import" | "history";

const CalibrationPage = () => {
  const { tenantId } = useAuth();
  const [tab, setTab] = useState<TabKey>("drift");
  const [filters, setFilters] = useState<CalibrationQueryFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: claims = [], isLoading } = useHistoricalClaims(filters);
  const { data: allClaims = [] } = useHistoricalClaims({});
  const { data: imports = [] } = useCalibrationImports();
  const { data: stats } = useCorpusStats();
  const { data: activeConfig } = useActiveCalibrationConfig();
  const { data: configHistory = [] } = useCalibrationConfigHistory();
  const importMutation = useImportHistoricalClaims();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const isJSON = file.name.endsWith(".json");
      const records = isJSON ? parseJSON(text) : parseCSV(text);
      if (records.length === 0) { toast.error("No valid records found"); return; }
      toast.info(`Importing ${records.length} records…`);
      const result = await importMutation.mutateAsync({ records, fileName: file.name, importType: isJSON ? "json" : "csv" });
      toast.success(`Import complete: ${result.successCount} imported, ${result.errorCount} errors`);
    } catch (err) { toast.error(`Import failed: ${String(err)}`); }
    if (fileRef.current) fileRef.current.value = "";
  }, [importMutation]);

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "drift", label: "Drift Analysis", icon: Activity },
    { key: "config", label: "Engine Config", icon: Settings2 },
    { key: "corpus", label: "Corpus", icon: Database },
    { key: "import", label: "Import", icon: Upload },
    { key: "history", label: "Config History", icon: History },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">EvaluateIQ Calibration</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review model drift, tune engine parameters, and manage the calibration corpus
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Claims" value={stats.total.toString()} icon={Database} />
          <StatCard label="With Settlement" value={stats.withSettlement.toString()} icon={CheckCircle2} />
          <StatCard label="Avg Settlement" value={fmt(Math.round(stats.avgSettlement))} icon={BarChart3} />
          <StatCard label="Avg Completeness" value={`${Math.round(stats.avgCompleteness)}%`} icon={Info} />
          <StatCard label="Active Config" value={activeConfig ? `v${activeConfig.version}` : "Default"} icon={Settings2} />
        </div>
      )}

      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all ${
              tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "drift" && <DriftTab claims={allClaims} activeConfig={activeConfig} />}
      {tab === "config" && <ConfigTab claims={allClaims} activeConfig={activeConfig} configHistory={configHistory} />}
      {tab === "corpus" && <CorpusTab claims={claims} isLoading={isLoading} filters={filters} setFilters={setFilters} showFilters={showFilters} setShowFilters={setShowFilters} />}
      {tab === "import" && <ImportTab fileRef={fileRef} handleFileUpload={handleFileUpload} importMutation={importMutation} />}
      {tab === "history" && <ConfigHistoryTab configHistory={configHistory} />}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// DRIFT ANALYSIS TAB
// ═══════════════════════════════════════════════════════════

function DriftTab({ claims, activeConfig }: { claims: HistoricalClaim[]; activeConfig: CalibrationConfig | null | undefined }) {
  const [sliceDimension, setSliceDimension] = useState<"venue" | "attorney" | "injury" | "specials">("venue");

  const mults = (activeConfig?.severity_multipliers as SeverityMultiplierConfig) ?? DEFAULT_SEVERITY_MULTIPLIERS;
  const drift = useMemo(() => computeDriftAnalysis(claims, mults), [claims, mults]);

  if (drift.total_claims === 0) {
    return (
      <div className="card-elevated p-10 text-center">
        <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Import historical claims with settlement outcomes to see drift analysis.</p>
      </div>
    );
  }

  const sliceData = sliceDimension === "venue" ? drift.slices_by_venue
    : sliceDimension === "attorney" ? drift.slices_by_attorney
    : sliceDimension === "injury" ? drift.slices_by_injury
    : drift.slices_by_specials_band;

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <DriftCard label="In Range" value={pct(drift.overall_accuracy_pct)} sub={`${drift.within_range_count} / ${drift.total_claims}`} color="text-[hsl(var(--status-approved))]" />
        <DriftCard label="Below Floor" value={pct(drift.total_claims > 0 ? Math.round(drift.below_floor_count / drift.total_claims * 100) : 0)} sub={`${drift.below_floor_count} claims`} color="text-[hsl(var(--status-attention))]" />
        <DriftCard label="Above Stretch" value={pct(drift.total_claims > 0 ? Math.round(drift.above_stretch_count / drift.total_claims * 100) : 0)} sub={`${drift.above_stretch_count} claims`} color="text-primary" />
        <DriftCard label="Mean Error" value={`${drift.mean_absolute_error_pct}%`} sub="vs midpoint" color="text-muted-foreground" />
      </div>

      {/* Slice selector */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Slice by:</span>
        {(["venue", "attorney", "injury", "specials"] as const).map(d => (
          <button key={d} onClick={() => setSliceDimension(d)} className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all ${sliceDimension === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      {/* Slice table */}
      <div className="card-elevated overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">{sliceDimension}</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Count</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">In Range</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Below Floor</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Above Stretch</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Mean Error</th>
              <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Median $</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sliceData.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">No data for this dimension.</td></tr>
            ) : sliceData.map((s) => (
              <tr key={s.value} className="hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-[11px] font-medium text-foreground">{s.value}</td>
                <td className="px-4 py-3 text-[11px] text-right text-muted-foreground">{s.count}</td>
                <td className="px-4 py-3 text-[11px] text-right font-semibold text-[hsl(var(--status-approved))]">{s.within_range_pct}%</td>
                <td className="px-4 py-3 text-[11px] text-right text-[hsl(var(--status-attention))]">{s.below_floor_pct}%</td>
                <td className="px-4 py-3 text-[11px] text-right text-primary">{s.above_stretch_pct}%</td>
                <td className="px-4 py-3 text-[11px] text-right text-muted-foreground">{s.mean_error_pct}%</td>
                <td className="px-4 py-3 text-[11px] text-right text-foreground">{fmt(s.median_settlement)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DriftCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="card-elevated px-4 py-3">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-[20px] font-bold tracking-tight ${color}`}>{value}</p>
      <span className="text-[10px] text-muted-foreground">{sub}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ENGINE CONFIG TAB
// ═══════════════════════════════════════════════════════════

function ConfigTab({ claims, activeConfig, configHistory }: { claims: HistoricalClaim[]; activeConfig: CalibrationConfig | null | undefined; configHistory: CalibrationConfig[] }) {
  const currentMults = (activeConfig?.severity_multipliers as SeverityMultiplierConfig) ?? DEFAULT_SEVERITY_MULTIPLIERS;
  const [editMults, setEditMults] = useState<SeverityMultiplierConfig>(currentMults);
  const [changeReason, setChangeReason] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const saveMutation = useSaveCalibrationConfig();

  const hasChanges = JSON.stringify(editMults) !== JSON.stringify(currentMults);
  const impact = useMemo(() => {
    if (!hasChanges || claims.length === 0) return null;
    return previewConfigImpact(claims, currentMults, editMults);
  }, [hasChanges, claims, currentMults, editMults]);

  const handleSave = async () => {
    if (!changeReason.trim()) { toast.error("A change reason is required"); return; }
    const diffs: string[] = [];
    for (const tier of ["baseline", "moderate", "severe", "catastrophic"] as const) {
      const cur = currentMults[tier];
      const nxt = editMults[tier];
      if (cur.floor !== nxt.floor || cur.likely !== nxt.likely || cur.stretch !== nxt.stretch) {
        diffs.push(`${tier}: ${cur.floor}/${cur.likely}/${cur.stretch} → ${nxt.floor}/${nxt.likely}/${nxt.stretch}`);
      }
    }
    try {
      await saveMutation.mutateAsync({
        config: { severity_multipliers: editMults },
        changeReason,
        changeSummary: diffs.join("; ") || "No severity multiplier changes",
      });
      toast.success("Calibration config saved");
      setChangeReason("");
    } catch (err) { toast.error(`Save failed: ${String(err)}`); }
  };

  const handleReset = () => { setEditMults(currentMults); setChangeReason(""); };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Severity Multipliers</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Adjust the non-economic severity multipliers applied to the economic base.
            Active config: {activeConfig ? `v${activeConfig.version}` : "Default (hardcoded)"}
          </p>
        </div>
        <div className="flex gap-2">
          {hasChanges && (
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Multiplier grid */}
      <div className="card-elevated p-5">
        <div className="grid grid-cols-4 gap-4">
          {(["baseline", "moderate", "severe", "catastrophic"] as const).map((tier) => (
            <div key={tier} className="space-y-3">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{tier}</span>
              {(["floor", "likely", "stretch"] as const).map((band) => (
                <div key={band}>
                  <label className="text-[9px] text-muted-foreground capitalize">{band}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="20"
                    value={editMults[tier][band]}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setEditMults(prev => ({ ...prev, [tier]: { ...prev[tier], [band]: val } }));
                    }}
                    className={`w-full mt-0.5 px-2 py-1.5 text-[11px] rounded border bg-background text-foreground ${
                      editMults[tier][band] !== currentMults[tier][band] ? "border-primary ring-1 ring-primary/30" : "border-border"
                    }`}
                  />
                  {editMults[tier][band] !== currentMults[tier][band] && (
                    <span className="text-[9px] text-primary">was {currentMults[tier][band]}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Impact Preview */}
      {hasChanges && impact && (
        <div className={`card-elevated p-5 border-l-4 ${impact.material_shift_count > 0 ? "border-l-[hsl(var(--status-attention))]" : "border-l-[hsl(var(--status-approved))]"}`}>
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-[12px] font-semibold text-foreground">Impact Preview</h3>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <MiniStat label="Cases Evaluated" value={impact.cases_affected.toString()} />
            <MiniStat label="Avg Floor Δ" value={`${impact.avg_floor_delta_pct > 0 ? "+" : ""}${impact.avg_floor_delta_pct}%`} />
            <MiniStat label="Avg Likely Δ" value={`${impact.avg_likely_delta_pct > 0 ? "+" : ""}${impact.avg_likely_delta_pct}%`} />
            <MiniStat label="Material Shifts" value={`${impact.material_shift_count} (≥${impact.material_shift_threshold_pct}%)`} />
          </div>

          {impact.warning && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention-foreground))] mb-3">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="text-[11px] font-medium">{impact.warning}</span>
            </div>
          )}

          {/* Sample impacts */}
          <button onClick={() => setShowPreview(!showPreview)} className="text-[10px] text-primary font-medium flex items-center gap-1">
            {showPreview ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {showPreview ? "Hide" : "Show"} sample case impacts
          </button>

          {showPreview && impact.sample_impacts.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-[9px] text-muted-foreground text-left">Claim</th>
                    <th className="px-3 py-2 text-[9px] text-muted-foreground text-right">Before (Likely)</th>
                    <th className="px-3 py-2 text-[9px] text-muted-foreground text-right">After (Likely)</th>
                    <th className="px-3 py-2 text-[9px] text-muted-foreground text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {impact.sample_impacts.map((s, i) => (
                    <tr key={i} className="hover:bg-accent/30">
                      <td className="px-3 py-2 text-[10px] font-mono text-muted-foreground">{s.claim_id.slice(0, 8)}…</td>
                      <td className="px-3 py-2 text-[10px] text-right">{fmt(s.before_likely)}</td>
                      <td className="px-3 py-2 text-[10px] text-right">{fmt(s.after_likely)}</td>
                      <td className={`px-3 py-2 text-[10px] text-right font-semibold ${Math.abs(s.delta_pct) >= 15 ? "text-destructive" : "text-muted-foreground"}`}>
                        {s.delta_pct > 0 ? "+" : ""}{s.delta_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Change reason + save */}
      {hasChanges && (
        <div className="card-elevated p-5 space-y-3">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Change Reason (required)
          </label>
          <textarea
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value)}
            placeholder="Describe why this calibration change is being made…"
            rows={3}
            className="w-full px-3 py-2 text-[11px] rounded border border-border bg-background text-foreground resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!changeReason.trim() || saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save as v{(activeConfig?.version ?? 0) + 1}
            </button>
            <span className="text-[10px] text-muted-foreground">
              Changes apply to future valuation runs only. Historical runs are preserved.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-[13px] font-bold text-foreground">{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CONFIG HISTORY TAB
// ═══════════════════════════════════════════════════════════

function ConfigHistoryTab({ configHistory }: { configHistory: CalibrationConfig[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="card-elevated overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Version</th>
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Status</th>
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Change Reason</th>
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Summary</th>
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left">Date</th>
            <th className="px-4 py-3 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-left"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {configHistory.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No configuration versions yet. Using default engine parameters.</td></tr>
          ) : configHistory.map((cfg) => (
            <>
              <tr key={cfg.id} className="hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-[12px] font-bold text-foreground">v{cfg.version}</td>
                <td className="px-4 py-3">
                  {cfg.is_active ? (
                    <span className="text-[9px] font-bold bg-[hsl(var(--status-approved))]/15 text-[hsl(var(--status-approved))] px-2 py-0.5 rounded-full">ACTIVE</span>
                  ) : (
                    <span className="text-[9px] font-medium text-muted-foreground">archived</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[11px] text-foreground max-w-[200px] truncate">{cfg.change_reason || "—"}</td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground max-w-[250px] truncate">{cfg.change_summary || "—"}</td>
                <td className="px-4 py-3 text-[10px] text-muted-foreground">{new Date(cfg.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setExpanded(expanded === cfg.id ? null : cfg.id)} className="text-[10px] text-primary">
                    {expanded === cfg.id ? "Hide" : "Inspect"}
                  </button>
                </td>
              </tr>
              {expanded === cfg.id && (
                <tr key={`${cfg.id}-detail`}>
                  <td colSpan={6} className="px-6 py-4 bg-accent/20">
                    <pre className="text-[10px] text-foreground/80 overflow-x-auto max-h-60 overflow-y-auto">
                      {JSON.stringify(cfg.severity_multipliers, null, 2)}
                    </pre>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// CORPUS TAB (preserved from original)
// ═══════════════════════════════════════════════════════════

function CorpusTab({ claims, isLoading, filters, setFilters, showFilters, setShowFilters }: {
  claims: HistoricalClaim[]; isLoading: boolean; filters: CalibrationQueryFilters;
  setFilters: React.Dispatch<React.SetStateAction<CalibrationQueryFilters>>;
  showFilters: boolean; setShowFilters: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
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
          <div className="col-span-2 md:col-span-4">
            <button onClick={() => setFilters({})} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Reset Filters</button>
          </div>
        </div>
      )}

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
            ) : claims.map((c) => <ClaimRow key={c.id} claim={c} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IMPORT TAB
// ═══════════════════════════════════════════════════════════

function ImportTab({ fileRef, handleFileUpload, importMutation }: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  importMutation: any;
}) {
  return (
    <div className="space-y-5">
      <div className="card-elevated p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-4 w-4 text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">Import Historical Claims</h2>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed max-w-2xl">
          Upload a CSV or JSON file containing historical closed-claim data.
        </p>
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-[12px] font-semibold text-foreground mb-1">Drop a CSV or JSON file, or click to browse</p>
          <p className="text-[10px] text-muted-foreground">Supported: .csv, .json · Max recommended: 1,000 records</p>
          <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleFileUpload} />
        </div>
        {importMutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing import…
          </div>
        )}
      </div>
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <h3 className="text-[12px] font-semibold text-foreground">CSV Template</h3>
        </div>
        <div className="bg-accent/50 rounded-lg p-3 overflow-x-auto">
          <code className="text-[9px] text-foreground/80 whitespace-nowrap">
            settlement_amount,loss_date,venue_state,county,attorney,attorney_firm,injuries,body_parts,surgery,injections,imaging,billed_specials,reviewed_specials,wage_loss,treatment_days,provider_count,policy_limits,liability,comp_neg,notes
          </code>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

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
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-2 py-1.5 text-[11px] rounded border border-border bg-background text-foreground"
        placeholder={label}
      />
    </div>
  );
}

function ClaimRow({ claim: c }: { claim: HistoricalClaim }) {
  const flags = [
    c.has_surgery && "Surgery", c.has_injections && "Injections",
    c.has_imaging && "Imaging", c.has_hospitalization && "Hosp", c.has_permanency && "Perm",
  ].filter(Boolean);

  return (
    <tr className="hover:bg-accent/30 transition-colors">
      <td className="px-4 py-3 text-[12px] font-semibold text-foreground">{fmt(c.final_settlement_amount)}</td>
      <td className="px-4 py-3 text-[11px] text-muted-foreground">
        {c.billed_specials != null ? fmt(c.billed_specials) : "—"}
        {c.reviewed_specials != null && <span className="text-[9px] text-primary ml-1">({fmt(c.reviewed_specials)} rev)</span>}
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
            <span key={f as string} className="text-[8px] font-semibold bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention-foreground))] px-1.5 py-0.5 rounded">{f}</span>
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

export default CalibrationPage;
