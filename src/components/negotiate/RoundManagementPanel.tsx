/**
 * NegotiateIQ — Round Management Panel
 *
 * Round history table, offer/counter sequences, movement metrics,
 * delta analysis, and counteroffer capture entry point.
 */

import { useState, useMemo } from "react";
import type { NegotiationRoundRow } from "@/types/negotiate-persistence";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import { computeCounterofferDeltas, computeRoundMetrics, type CounterofferDeltas } from "@/lib/negotiateDeltaEngine";
import { generateResponseRecommendations, type ResponseEngineOutput } from "@/lib/negotiateResponseEngine";
import CounterofferCaptureForm from "@/components/negotiate/CounterofferCaptureForm";
import ResponseRecommendationCard from "@/components/negotiate/ResponseRecommendationCard";
import {
  ArrowDownUp,
  Plus,
  TrendingDown,
  TrendingUp,
  Minus,
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

interface RoundManagementPanelProps {
  rounds: NegotiationRoundRow[];
  sessionId: string;
  caseId: string;
  strategy: GeneratedStrategy | null;
  currentCeiling: number | null;
  openingDemand: number | null;
  vm?: NegotiationViewModel;
}

const RoundManagementPanel = ({
  rounds,
  sessionId,
  caseId,
  strategy,
  currentCeiling,
  openingDemand,
  vm,
}: RoundManagementPanelProps) => {
  const [showCaptureForm, setShowCaptureForm] = useState(false);
  const [selectedRoundIdx, setSelectedRoundIdx] = useState<number | null>(null);

  const metrics = useMemo(() => computeRoundMetrics(rounds), [rounds]);
  const nextRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) + 1 : 1;

  // Compute deltas for latest counteroffer
  const latestDeltas = useMemo<CounterofferDeltas | null>(() => {
    const lastRoundWithCounter = [...rounds].reverse().find((r) => r.their_counteroffer != null);
    if (!lastRoundWithCounter?.their_counteroffer) return null;

    const lastDefenseOffer = [...rounds].reverse().find((r) => r.our_offer != null)?.our_offer ?? null;

    return computeCounterofferDeltas({
      counterofferAmount: lastRoundWithCounter.their_counteroffer,
      lastDefenseOffer,
      openingDemand,
      strategy,
      currentCeiling,
      rounds,
    });
  }, [rounds, openingDemand, strategy, currentCeiling]);

  // Response recommendations
  const responseOutput = useMemo<ResponseEngineOutput | null>(() => {
    const lastRoundWithCounter = [...rounds].reverse().find((r) => r.their_counteroffer != null);
    if (!lastRoundWithCounter?.their_counteroffer || !strategy || !vm) return null;
    const lastDefenseOffer = [...rounds].reverse().find((r) => r.our_offer != null)?.our_offer ?? null;

    return generateResponseRecommendations({
      strategy,
      vm,
      rounds,
      currentCeiling,
      openingDemand,
      latestCounteroffer: lastRoundWithCounter.their_counteroffer,
      lastDefenseOffer,
    });
  }, [rounds, strategy, vm, currentCeiling, openingDemand]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-semibold text-foreground">Round Management</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground">
            {rounds.length} Round{rounds.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowCaptureForm(true)}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Record Counteroffer
        </button>
      </div>

      {/* Capture Form */}
      {showCaptureForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4">
          <h3 className="text-[11px] font-semibold text-foreground mb-3">Record Incoming Counteroffer</h3>
          <CounterofferCaptureForm
            sessionId={sessionId}
            caseId={caseId}
            nextRoundNumber={nextRound}
            onSuccess={() => setShowCaptureForm(false)}
            onCancel={() => setShowCaptureForm(false)}
          />
        </div>
      )}

      {/* Latest Delta Analysis */}
      {latestDeltas && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Target className="h-3 w-3" />
            Latest Counteroffer Analysis
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <DeltaChip
              label="vs Last Offer"
              value={latestDeltas.deltaFromLastOffer}
              pct={latestDeltas.deltaFromLastOfferPct}
            />
            <DeltaChip
              label="vs Opening Demand"
              value={latestDeltas.deltaFromOpeningDemand}
              pct={latestDeltas.deltaFromOpeningDemandPct}
            />
            <DeltaChip
              label="vs Ceiling"
              value={latestDeltas.deltaFromCeiling}
              isWarning={latestDeltas.isAboveCeiling ?? false}
            />
            <div className="col-span-2 rounded-lg border border-border bg-accent/30 px-3 py-2">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Target Zone</p>
              {latestDeltas.isWithinTargetZone != null ? (
                <div className="flex items-center gap-1 mt-0.5">
                  {latestDeltas.isWithinTargetZone ? (
                    <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />
                  )}
                  <span className="text-[11px] font-medium text-foreground">
                    {latestDeltas.isWithinTargetZone ? "Within target zone" : "Outside target zone"}
                  </span>
                  {latestDeltas.distanceToSettlementZone != null && (
                    <span className="text-[9px] text-muted-foreground ml-1">
                      ({fmtCurrency(Math.abs(latestDeltas.distanceToSettlementZone))} {latestDeltas.distanceToSettlementZone > 0 ? "above" : "below"} midpoint)
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-0.5">No target zone set</p>
              )}
            </div>
            <div className="rounded-lg border border-border bg-accent/30 px-3 py-2">
              <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Movement Pace</p>
              <div className="flex items-center gap-1 mt-0.5">
                {latestDeltas.movementPace === "faster" && <TrendingDown className="h-3 w-3 text-[hsl(var(--status-approved))]" />}
                {latestDeltas.movementPace === "slower" && <TrendingUp className="h-3 w-3 text-[hsl(var(--status-attention))]" />}
                {latestDeltas.movementPace === "on_track" && <ArrowRight className="h-3 w-3 text-primary" />}
                {latestDeltas.movementPace === "unknown" && <Minus className="h-3 w-3 text-muted-foreground" />}
                <span className="text-[10px] font-medium text-foreground capitalize">
                  {latestDeltas.movementPace.replace("_", " ")}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-relaxed">{latestDeltas.movementPaceReason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Response Recommendations */}
      {responseOutput && (
        <ResponseRecommendationCard
          output={responseOutput}
          sessionId={sessionId}
          caseId={caseId}
        />
      )}

      {/* Round History Table */}
      {rounds.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border bg-accent/30">
                  <th className="px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wider">Rd</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Our Offer</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Their Counter</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Gap</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Our Move %</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Their Move %</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground uppercase tracking-wider">Gap Δ %</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr
                    key={m.roundNumber}
                    className={`border-b border-border/50 hover:bg-accent/20 cursor-pointer transition-colors ${
                      selectedRoundIdx === i ? "bg-accent/30" : ""
                    }`}
                    onClick={() => setSelectedRoundIdx(selectedRoundIdx === i ? null : i)}
                  >
                    <td className="px-3 py-2 font-bold text-foreground">{m.roundNumber}</td>
                    <td className="px-3 py-2 text-right text-foreground font-medium">
                      {m.ourOffer != null ? fmtCurrency(m.ourOffer) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-medium">
                      {m.theirCounter != null ? fmtCurrency(m.theirCounter) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {m.gap != null ? fmtCurrency(m.gap) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.ourMovementPct != null ? (
                        <span className={m.ourMovementPct > 0 ? "text-[hsl(var(--status-attention))]" : "text-muted-foreground"}>
                          {m.ourMovementPct > 0 ? "+" : ""}{m.ourMovementPct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.theirMovementPct != null ? (
                        <span className={m.theirMovementPct > 0 ? "text-[hsl(var(--status-approved))]" : "text-muted-foreground"}>
                          {m.theirMovementPct > 0 ? "-" : ""}{m.theirMovementPct}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.gapReductionPct != null ? (
                        <span className={m.gapReductionPct > 0 ? "text-[hsl(var(--status-approved))]" : "text-[hsl(var(--status-attention))]"}>
                          {m.gapReductionPct > 0 ? "-" : "+"}{Math.abs(m.gapReductionPct)}%
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected round detail */}
          {selectedRoundIdx != null && rounds[selectedRoundIdx] && (
            <div className="px-4 py-3 border-t border-border bg-accent/10">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">Round {rounds[selectedRoundIdx].round_number} Notes:</span>{" "}
                {rounds[selectedRoundIdx].notes || "No notes recorded."}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <ArrowDownUp className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-[11px] text-muted-foreground">
            No negotiation rounds recorded yet. Record a counteroffer to begin tracking round-to-round movement.
          </p>
        </div>
      )}
    </div>
  );
};

function DeltaChip({
  label,
  value,
  pct,
  isWarning,
}: {
  label: string;
  value: number | null;
  pct?: number | null;
  isWarning?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-accent/30 px-3 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      {value != null ? (
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[12px] font-bold ${isWarning ? "text-destructive" : "text-foreground"}`}>
            {value > 0 ? "+" : ""}{fmtCurrency(value)}
          </span>
          {pct != null && (
            <span className="text-[9px] text-muted-foreground">({pct > 0 ? "+" : ""}{pct}%)</span>
          )}
        </div>
      ) : (
        <p className="text-[10px] text-muted-foreground mt-0.5">—</p>
      )}
    </div>
  );
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export default RoundManagementPanel;
