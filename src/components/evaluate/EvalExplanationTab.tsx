/**
 * EvaluateIQ — Explanation Ledger Tab
 *
 * Renders the full explanation ledger showing why a range was produced.
 * Entries are grouped by direction (increases, decreases, constraints,
 * human assumptions) with drill-through to evidence.
 */

import { useMemo, useState } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import { extractValuationDrivers } from "@/lib/valuationDriverEngine";
import { computeSettlementRange } from "@/lib/settlementRangeEngine";
import { buildExplanationLedger } from "@/lib/explanationLedgerBuilder";
import { useAssumptionOverrides } from "@/hooks/useAssumptionOverrides";
import type { ExplanationLedger, LedgerEntry, LedgerEffectDirection, LedgerEntrySource } from "@/types/explanation-ledger";
import {
  TrendingUp, TrendingDown, Minus, Shield, User,
  FileText, ChevronDown, ChevronRight, ExternalLink,
  Cpu, AlertTriangle, BookOpen, Link2,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const DIRECTION_CONFIG: Record<LedgerEffectDirection, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  increase:   { label: "Value Increases",     icon: TrendingUp,   color: "text-[hsl(var(--status-approved))]",   bgColor: "bg-[hsl(var(--status-approved))]/10" },
  decrease:   { label: "Value Reductions",    icon: TrendingDown, color: "text-[hsl(var(--status-attention))]",  bgColor: "bg-[hsl(var(--status-attention))]/10" },
  constraint: { label: "Constraints",         icon: Shield,       color: "text-primary",                         bgColor: "bg-primary/10" },
  neutral:    { label: "Neutral / Adopted",   icon: Minus,        color: "text-muted-foreground",                bgColor: "bg-muted" },
};

const SOURCE_LABEL: Record<LedgerEntrySource, { label: string; icon: React.ElementType }> = {
  engine:            { label: "Engine-derived",   icon: Cpu },
  human_override:    { label: "Human-adopted",    icon: User },
  system_constraint: { label: "System constraint", icon: Shield },
};

const EvalExplanationTab = ({ snapshot }: Props) => {
  const { state, overrides, changeLog } = useAssumptionOverrides();

  const ledger = useMemo(() => {
    const drivers = extractValuationDrivers(snapshot);
    const range = computeSettlementRange(snapshot, drivers, state.hasOverrides ? overrides : null);
    return buildExplanationLedger(range, drivers, state.hasOverrides ? overrides : null, changeLog);
  }, [snapshot, overrides, state.hasOverrides, changeLog]);

  const groups = useMemo(() => {
    const map: Record<LedgerEffectDirection, LedgerEntry[]> = {
      increase: [], decrease: [], constraint: [], neutral: [],
    };
    ledger.entries.forEach(e => map[e.direction].push(e));
    return map;
  }, [ledger]);

  const humanEntries = useMemo(() => ledger.entries.filter(e => e.source === "human_override"), [ledger]);

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="h-4 w-4 text-primary" />
          <h2 className="text-[14px] font-semibold text-foreground">Explanation Ledger</h2>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4 max-w-2xl">
          Every factor that influenced the valuation range is documented below. 
          Each entry traces to engine calculations, evidence, or human-adopted assumptions.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <SummaryStat label="Total Factors" value={ledger.summary.total_entries} />
          <SummaryStat label="Increases" value={ledger.summary.increase_count} color="text-[hsl(var(--status-approved))]" />
          <SummaryStat label="Reductions" value={ledger.summary.decrease_count} color="text-[hsl(var(--status-attention))]" />
          <SummaryStat label="Human Adopted" value={ledger.summary.human_override_count} color="text-primary" />
          <SummaryStat label="Evidence-Linked" value={ledger.summary.evidence_linked_count} color="text-muted-foreground" />
        </div>
      </div>

      {/* Human-adopted section (if any) */}
      {humanEntries.length > 0 && (
        <div className="card-elevated p-5 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-semibold text-foreground">Human-Adopted Assumptions</h3>
            <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{humanEntries.length}</span>
          </div>
          <div className="space-y-2">
            {humanEntries.map(entry => (
              <LedgerEntryRow key={entry.entry_key} entry={entry} compact />
            ))}
          </div>
        </div>
      )}

      {/* Grouped sections */}
      {(["increase", "decrease", "constraint", "neutral"] as const).map(dir => {
        const items = groups[dir];
        if (items.length === 0) return null;
        const cfg = DIRECTION_CONFIG[dir];
        // Skip human overrides from neutral since we showed them above
        const filtered = dir === "neutral" ? items.filter(e => e.source !== "human_override") : items;
        if (filtered.length === 0) return null;

        return (
          <LedgerSection key={dir} config={cfg} entries={filtered} />
        );
      })}

      {/* No entries */}
      {ledger.entries.length === 0 && (
        <div className="card-elevated p-10 text-center">
          <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No explanation entries could be generated. Ensure intake data is available.</p>
        </div>
      )}

      {/* Lineage footer */}
      <div className="flex items-center justify-between text-[9px] text-muted-foreground px-1">
        <span>Engine: {ledger.engine_version} · Built: {new Date(ledger.built_at).toLocaleString()}</span>
        <span>{ledger.summary.categories_covered.length} categories covered</span>
      </div>
    </div>
  );
};

// ─── Section ─────────────────────────────────────────────

function LedgerSection({ config, entries }: {
  config: typeof DIRECTION_CONFIG[LedgerEffectDirection];
  entries: LedgerEntry[];
}) {
  const [expanded, setExpanded] = useState(true);
  const Icon = config.icon;

  return (
    <div className="card-elevated overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md flex items-center justify-center ${config.bgColor}`}>
            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          </div>
          <span className="text-[12px] font-semibold text-foreground">{config.label}</span>
          <span className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{entries.length}</span>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {entries.map(entry => (
            <LedgerEntryRow key={entry.entry_key} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entry Row ───────────────────────────────────────────

function LedgerEntryRow({ entry, compact }: { entry: LedgerEntry; compact?: boolean }) {
  const [showDetail, setShowDetail] = useState(false);
  const dirCfg = DIRECTION_CONFIG[entry.direction];
  const srcCfg = SOURCE_LABEL[entry.source];
  const SrcIcon = srcCfg.icon;

  return (
    <div className={`${compact ? "py-2" : "px-5 py-3"} group`}>
      <div className="flex items-start gap-3">
        {/* Direction indicator */}
        {!compact && (
          <div className={`mt-0.5 h-5 w-5 rounded flex-shrink-0 flex items-center justify-center ${dirCfg.bgColor}`}>
            <dirCfg.icon className={`h-3 w-3 ${dirCfg.color}`} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-foreground">{entry.title}</span>
            <span className={`text-[10px] font-bold ${dirCfg.color}`}>{entry.magnitude.display}</span>
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <SrcIcon className="h-2.5 w-2.5" />
              {srcCfg.label}
            </span>
            {entry.evidence_ref_ids.length > 0 && (
              <span className="text-[9px] text-primary flex items-center gap-0.5">
                <Link2 className="h-2.5 w-2.5" />
                {entry.evidence_ref_ids.length} ref{entry.evidence_ref_ids.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Narrative */}
          <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{entry.narrative}</p>

          {/* Drill-through */}
          {(entry.evidence_ref_ids.length > 0 || entry.driver_key) && (
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="text-[9px] text-primary font-medium mt-1 flex items-center gap-1 hover:underline"
            >
              {showDetail ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
              {showDetail ? "Hide details" : "View details"}
            </button>
          )}

          {showDetail && (
            <div className="mt-2 p-3 rounded-lg bg-accent/30 space-y-1.5">
              <div className="flex items-center gap-4 text-[9px] text-muted-foreground">
                <span>Category: <strong className="text-foreground">{entry.category.replace(/_/g, " ")}</strong></span>
                {entry.driver_key && <span>Driver: <strong className="text-foreground">{entry.driver_key}</strong></span>}
                <span>Source: <strong className="text-foreground">{entry.lineage.source_module}</strong> v{entry.lineage.snapshot_version}</span>
              </div>
              {entry.evidence_ref_ids.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {entry.evidence_ref_ids.map((refId, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[9px] font-mono bg-background border border-border rounded px-1.5 py-0.5 text-primary cursor-pointer hover:bg-primary/5">
                      <FileText className="h-2.5 w-2.5" />
                      {refId.slice(0, 8)}…
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function SummaryStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className={`text-[16px] font-bold ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

export default EvalExplanationTab;
