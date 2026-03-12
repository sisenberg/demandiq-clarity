/**
 * NegotiateIQ — Response Recommendation Card
 *
 * Shows top recommendation prominently, alternatives beneath,
 * selection with override reason capture.
 */

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logNegotiationEvent } from "@/hooks/useNegotiateSession";
import type {
  ResponseEngineOutput,
  ResponseRecommendation,
  ResponseActionType,
  NegotiationPostureZone,
} from "@/lib/negotiateResponseEngine";
import {
  Compass,
  Shield,
  TrendingUp,
  ArrowRight,
  Zap,
  Target,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Handshake,
  PauseCircle,
  Megaphone,
  Ban,
  MessageSquare,
} from "lucide-react";

const ACTION_META: Record<ResponseActionType, { label: string; icon: React.ElementType; color: string }> = {
  hold: { label: "Hold Position", icon: PauseCircle, color: "text-muted-foreground" },
  small_move: { label: "Small Move", icon: ArrowRight, color: "text-primary" },
  standard_move: { label: "Standard Move", icon: TrendingUp, color: "text-primary" },
  aggressive_move: { label: "Aggressive Move", icon: Zap, color: "text-[hsl(var(--status-attention))]" },
  bracket: { label: "Bracket Response", icon: Target, color: "text-primary" },
  request_support: { label: "Request Support", icon: HelpCircle, color: "text-muted-foreground" },
  request_authority_review: { label: "Authority Review", icon: ShieldAlert, color: "text-[hsl(var(--status-attention))]" },
  recommend_settlement: { label: "Recommend Settlement", icon: Handshake, color: "text-[hsl(var(--status-approved))]" },
  recommend_impasse: { label: "Impasse Posture", icon: Ban, color: "text-destructive" },
};

const ZONE_LABELS: Record<NegotiationPostureZone, string> = {
  within_target: "Within Target Zone",
  above_likely_moving: "Above Target — Moving",
  outside_not_moving: "Outside Target — Not Moving",
  near_ceiling: "Near Authority Ceiling",
  beyond_ceiling: "Beyond Authority Ceiling",
  endgame_behavior: "Endgame Behavior",
};

const T = (name: string) => supabase.from(name as any) as any;

interface ResponseRecommendationCardProps {
  output: ResponseEngineOutput;
  sessionId: string;
  caseId: string;
  onActionSelected?: () => void;
}

const ResponseRecommendationCard = ({
  output,
  sessionId,
  caseId,
  onActionSelected,
}: ResponseRecommendationCardProps) => {
  const { user, tenantId } = useAuth();
  const qc = useQueryClient();

  const [selectedAction, setSelectedAction] = useState<ResponseActionType | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [showAlternatives, setShowAlternatives] = useState(true);
  const [expandedRec, setExpandedRec] = useState<number | null>(null);

  const top = output.recommendations[0];
  const alternatives = output.recommendations.slice(1);

  const isOverride = useMemo(() => {
    if (!selectedAction) return false;
    return selectedAction !== top?.action;
  }, [selectedAction, top]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !tenantId || !selectedAction) throw new Error("Missing data");
      if (isOverride && !overrideReason.trim()) throw new Error("Override reason required");

      const selectedRec = output.recommendations.find((r) => r.action === selectedAction);

      // Log as event
      await logNegotiationEvent({
        sessionId,
        caseId,
        tenantId,
        actorId: user.id,
        eventType: "offer_made",
        summary: `Selected response: ${ACTION_META[selectedAction].label}${selectedRec?.proposedOffer ? ` at ${fmtCurrency(selectedRec.proposedOffer)}` : ""}${isOverride ? " (override)" : ""}`,
        afterValue: {
          action: selectedAction,
          proposed_offer: selectedRec?.proposedOffer,
          movement_amount: selectedRec?.movementAmount,
          is_override: isOverride,
          override_reason: isOverride ? overrideReason : null,
          engine_top_recommendation: top?.action,
          posture_zone: output.postureZone,
          engine_version: output.engineVersion,
        },
      });

      // Add note if override
      if (isOverride) {
        await T("negotiation_notes").insert({
          session_id: sessionId,
          case_id: caseId,
          tenant_id: tenantId,
          author_id: user.id,
          content: `Override: Selected "${ACTION_META[selectedAction].label}" instead of recommended "${ACTION_META[top.action].label}". Reason: ${overrideReason}`,
          note_type: "override",
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["negotiate-events", sessionId] });
      qc.invalidateQueries({ queryKey: ["negotiate-notes", sessionId] });
      toast.success("Response action recorded");
      onActionSelected?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!top) return null;

  return (
    <div className="space-y-3">
      {/* Posture Zone Banner */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <h3 className="text-[12px] font-semibold text-foreground">Response Recommendation</h3>
          <span className="ml-auto text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent text-muted-foreground">
            {ZONE_LABELS[output.postureZone]}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{output.postureZoneReason}</p>
      </div>

      {/* Top Recommendation */}
      <RecCard
        rec={top}
        isTop
        isSelected={selectedAction === top.action}
        isExpanded={expandedRec === 0}
        onSelect={() => setSelectedAction(top.action)}
        onToggleExpand={() => setExpandedRec(expandedRec === 0 ? null : 0)}
      />

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <div>
          <button
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showAlternatives ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {alternatives.length} Alternative{alternatives.length !== 1 ? "s" : ""}
          </button>
          {showAlternatives && (
            <div className="space-y-2">
              {alternatives.map((alt, i) => (
                <RecCard
                  key={alt.action}
                  rec={alt}
                  isTop={false}
                  isSelected={selectedAction === alt.action}
                  isExpanded={expandedRec === i + 1}
                  onSelect={() => setSelectedAction(alt.action)}
                  onToggleExpand={() => setExpandedRec(expandedRec === i + 1 ? null : i + 1)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Override Reason */}
      {isOverride && selectedAction && (
        <div className="rounded-xl border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />
            <p className="text-[10px] font-semibold text-[hsl(var(--status-attention))]">
              Override — reason required
            </p>
          </div>
          <p className="text-[9px] text-muted-foreground mb-2">
            You selected "{ACTION_META[selectedAction].label}" instead of the recommended "{ACTION_META[top.action].label}". Please provide your reasoning.
          </p>
          <textarea
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="w-full text-[11px] px-3 py-2 rounded-lg border border-border bg-background text-foreground resize-none"
            rows={2}
            placeholder="Why are you choosing a different action?"
            maxLength={2000}
          />
        </div>
      )}

      {/* Confirm Action */}
      {selectedAction && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || (isOverride && !overrideReason.trim())}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : `Confirm: ${ACTION_META[selectedAction].label}`}
          </button>
          <button
            onClick={() => { setSelectedAction(null); setOverrideReason(""); }}
            className="text-[10px] font-medium text-muted-foreground hover:text-foreground"
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Recommendation Card ────────────────────────────────

function RecCard({
  rec,
  isTop,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: {
  rec: ResponseRecommendation;
  isTop: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) {
  const meta = ACTION_META[rec.action];
  const Icon = meta.icon;
  const hasWarnings = rec.warnings.length > 0;

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isSelected
          ? "border-primary bg-primary/5"
          : isTop
            ? "border-border bg-card"
            : "border-border/50 bg-card/50"
      }`}
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          {/* Selection radio */}
          <button
            onClick={onSelect}
            className={`mt-0.5 shrink-0 h-4 w-4 rounded-full border-2 transition-colors ${
              isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-background"
            } flex items-center justify-center`}
          >
            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
              <span className="text-[12px] font-semibold text-foreground">{meta.label}</span>
              {isTop && (
                <span className="text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  Recommended
                </span>
              )}
              <ConfidenceBadge level={rec.confidence} />
              {hasWarnings && (
                <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />
              )}
            </div>

            {/* Amounts row */}
            {(rec.proposedOffer != null || rec.movementAmount != null) && (
              <div className="flex items-center gap-3 mt-1.5">
                {rec.proposedOffer != null && (
                  <span className="text-[11px] font-bold text-foreground">
                    Next Offer: {fmtCurrency(rec.proposedOffer)}
                  </span>
                )}
                {rec.movementAmount != null && rec.movementAmount > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    +{fmtCurrency(rec.movementAmount)}
                    {rec.movementPct != null && ` (${rec.movementPct}%)`}
                  </span>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{rec.shortExplanation}</p>

            {/* Expand/collapse rationale */}
            <button
              onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
              className="flex items-center gap-1 text-[9px] font-semibold text-primary hover:underline mt-1.5"
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {isExpanded ? "Hide rationale" : "View full rationale"}
            </button>
          </div>
        </div>

        {/* Expanded rationale */}
        {isExpanded && (
          <div className="mt-3 ml-7 space-y-2">
            <div className="rounded-lg border border-border bg-accent/20 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Claim Note Rationale</p>
              <p className="text-[10px] text-foreground leading-relaxed">{rec.rationale}</p>
            </div>

            {rec.warnings.length > 0 && (
              <div className="space-y-1">
                {rec.warnings.map((w, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-1.5 rounded-lg px-3 py-1.5 text-[9px] ${
                      w.severity === "critical"
                        ? "bg-destructive/10 text-destructive"
                        : w.severity === "caution"
                          ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
                          : "bg-accent text-muted-foreground"
                    }`}
                  >
                    <AlertTriangle className="h-2.5 w-2.5 mt-0.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: string }) {
  const cls = level === "high"
    ? "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]"
    : level === "medium"
      ? "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]"
      : "bg-accent text-muted-foreground";
  return (
    <span className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${cls}`}>
      {level}
    </span>
  );
}

function fmtCurrency(v: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

export default ResponseRecommendationCard;
