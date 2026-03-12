/**
 * NegotiateIQ — Historical Calibration Card
 *
 * Advisory overlay showing closed-claim calibration signals.
 * Transparent about basis, sample size, and sparse data.
 */

import { useState } from "react";
import type { CalibrationResult, CalibrationSignal, SignalConfidence } from "@/lib/negotiateCalibrationEngine";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Info,
  Database,
  TrendingUp,
  Scale,
  Users,
  Activity,
  Percent,
  Target,
} from "lucide-react";

interface HistoricalCalibrationCardProps {
  calibration: CalibrationResult | null | undefined;
  isLoading: boolean;
}

const SIGNAL_ICONS: Record<string, React.ElementType> = {
  jurisdiction_band: Scale,
  injury_pattern_band: Activity,
  surgery_cases_median: Activity,
  attorney_settlement_ratio: Users,
  attorney_vs_eval_midpoint: Target,
  specials_multiplier: TrendingUp,
  reviewed_specials_multiplier: TrendingUp,
  counteroffer_percentile: Percent,
  combined_similar_band: BarChart3,
};

const CONFIDENCE_STYLES: Record<SignalConfidence, { bg: string; text: string; label: string }> = {
  high: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "High" },
  moderate: { bg: "bg-amber-500/10", text: "text-amber-600", label: "Moderate" },
  low: { bg: "bg-orange-500/10", text: "text-orange-600", label: "Low" },
  insufficient: { bg: "bg-destructive/10", text: "text-destructive", label: "Insufficient" },
};

const HistoricalCalibrationCard = ({ calibration, isLoading }: HistoricalCalibrationCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());

  const toggleSignal = (key: string) => {
    setExpandedSignals((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="text-left">
            <h3 className="text-[11px] font-semibold text-foreground">Historical Calibration</h3>
            <p className="text-[9px] text-muted-foreground">
              Advisory signals from closed-claim outcomes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {calibration && calibration.totalMatchedClaims > 0 && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              {calibration.totalMatchedClaims} claims
            </span>
          )}
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Disclaimer */}
          <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-accent/50 border border-border">
            <Info className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Historical pattern support only. These signals are derived from closed-claim outcomes in your calibration corpus and do not replace the EvaluatePackage valuation range.
            </p>
          </div>

          {isLoading && (
            <div className="flex justify-center py-6">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && !calibration && (
            <div className="py-4 text-center">
              <Database className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-[10px] text-muted-foreground">
                Calibration data will appear once a strategy is generated.
              </p>
            </div>
          )}

          {calibration && calibration.signals.length === 0 && calibration.sparseWarnings.length > 0 && (
            <div className="space-y-2">
              {calibration.sparseWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-[hsl(var(--status-attention))]/5 border border-[hsl(var(--status-attention))]/20">
                  <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Signals */}
          {calibration && calibration.signals.length > 0 && (
            <div className="space-y-2">
              {calibration.signals.map((signal) => (
                <SignalRow
                  key={signal.key}
                  signal={signal}
                  expanded={expandedSignals.has(signal.key)}
                  onToggle={() => toggleSignal(signal.key)}
                />
              ))}
            </div>
          )}

          {/* Sparse warnings below signals */}
          {calibration && calibration.signals.length > 0 && calibration.sparseWarnings.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Data Gaps</p>
              {calibration.sparseWarnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-2.5 w-2.5 text-[hsl(var(--status-attention))] mt-0.5 shrink-0" />
                  <p className="text-[9px] text-muted-foreground leading-relaxed">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Match criteria */}
          {calibration && calibration.matchCriteria.length > 0 && (
            <div className="pt-1 border-t border-border">
              <p className="text-[8px] text-muted-foreground">
                Matched on: {calibration.matchCriteria.join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function SignalRow({
  signal,
  expanded,
  onToggle,
}: {
  signal: CalibrationSignal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = SIGNAL_ICONS[signal.key] ?? BarChart3;
  const conf = CONFIDENCE_STYLES[signal.confidence];

  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-accent/20 transition-colors"
      >
        <div className="mt-0.5 shrink-0 h-5 w-5 rounded-md bg-accent flex items-center justify-center">
          <Icon className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-[10px] font-semibold text-foreground">{signal.label}</p>
            <span className={`text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${conf.bg} ${conf.text}`}>
              {conf.label}
            </span>
            <span className="text-[8px] text-muted-foreground ml-auto">
              n={signal.sampleSize}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-primary">{signal.value}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-muted-foreground mt-1 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 pt-0 space-y-1.5 border-t border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed">{signal.description}</p>
          <p className="text-[9px] text-muted-foreground/70 italic">Basis: {signal.basis}</p>
        </div>
      )}
    </div>
  );
}

export default HistoricalCalibrationCard;
