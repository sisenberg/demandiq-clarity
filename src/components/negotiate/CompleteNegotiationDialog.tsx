/**
 * NegotiateIQ — Complete Negotiation Dialog
 *
 * Captures outcome, validates, and publishes NegotiatePackage v1.
 */

import { useState, useMemo, useCallback } from "react";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { NegotiationSessionRow, NegotiationRoundRow, NegotiationNoteRow, NegotiateRepresentationContext } from "@/types/negotiate-persistence";
import type { GeneratedStrategy, StrategyOverride } from "@/types/negotiate-strategy";
import {
  validateNegotiateCompletion,
  buildNegotiatePackage,
  OUTCOME_LABELS,
  type NegotiateOutcomeType,
} from "@/lib/negotiatePackageBuilder";
import { usePublishNegotiatePackage } from "@/hooks/useNegotiateCompletion";
import {
  CheckCircle,
  AlertTriangle,
  X,
  DollarSign,
  Package,
  Gavel,
  ArrowRight,
  XCircle,
  Info,
} from "lucide-react";

interface CompleteNegotiationDialogProps {
  open: boolean;
  onClose: () => void;
  vm: NegotiationViewModel;
  session: NegotiationSessionRow;
  strategy: { version: number; generated_strategy: GeneratedStrategy; overrides: StrategyOverride[] } | null;
  rounds: NegotiationRoundRow[];
  notes: NegotiationNoteRow[];
  caseId: string;
  attorneyName: string | null;
  firmName: string | null;
  observationsCount: number;
  calibrationSignalsCount: number;
  calibrationHighConfCount: number;
  calibrationJurisdictionBand: string | null;
  representationContext?: NegotiateRepresentationContext | null;
}

const OUTCOME_ICONS: Record<NegotiateOutcomeType, React.ElementType> = {
  settled: CheckCircle,
  impasse: XCircle,
  transferred_forward: ArrowRight,
  closed_without_settlement: Gavel,
};

const CompleteNegotiationDialog = ({
  open,
  onClose,
  vm,
  session,
  strategy,
  rounds,
  notes,
  caseId,
  attorneyName,
  firmName,
  observationsCount,
  calibrationSignalsCount,
  calibrationHighConfCount,
  calibrationJurisdictionBand,
  representationContext,
}: CompleteNegotiationDialogProps) => {
  const [outcomeType, setOutcomeType] = useState<NegotiateOutcomeType | null>(null);
  const [finalSettlement, setFinalSettlement] = useState("");
  const [outcomeNotes, setOutcomeNotes] = useState(session.final_outcome_notes || "");
  const [unresolvedIssues, setUnresolvedIssues] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [litigationLikely, setLitigationLikely] = useState(false);

  const publish = usePublishNegotiatePackage();

  const validation = useMemo(() => {
    const parsed = finalSettlement ? parseFloat(finalSettlement.replace(/[^0-9.]/g, "")) : null;
    return validateNegotiateCompletion({
      session,
      strategy,
      rounds,
      outcomeType,
      finalSettlement: parsed,
      outcomeNotes,
      representationContext,
    });
  }, [session, strategy, rounds, outcomeType, finalSettlement, outcomeNotes, representationContext]);

  const handlePublish = useCallback(() => {
    if (!outcomeType || !validation.valid) return;

    const parsedSettlement = finalSettlement ? parseFloat(finalSettlement.replace(/[^0-9.]/g, "")) : null;
    const issuesList = unresolvedIssues.split("\n").map((s) => s.trim()).filter(Boolean);
    const stepsList = nextSteps.split("\n").map((s) => s.trim()).filter(Boolean);

    const payload = buildNegotiatePackage({
      vm,
      session,
      strategy,
      rounds,
      notes,
      outcomeType,
      finalSettlement: parsedSettlement,
      outcomeNotes,
      unresolvedIssues: issuesList,
      nextStepRecommendations: stepsList,
      litigationLikely,
      attorneyName,
      firmName,
      observationsCount,
      calibrationSignalsCount,
      calibrationHighConfCount,
      calibrationJurisdictionBand,
      representationContext,
    });

    publish.mutate(
      {
        caseId,
        sessionId: session.id,
        payload,
        outcomeType,
        finalSettlement: parsedSettlement,
      },
      { onSuccess: () => onClose() }
    );
  }, [outcomeType, validation, finalSettlement, unresolvedIssues, nextSteps, litigationLikely, vm, session, strategy, rounds, notes, outcomeNotes, caseId, publish, onClose, attorneyName, firmName, observationsCount, calibrationSignalsCount, calibrationHighConfCount, calibrationJurisdictionBand, representationContext]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[13px] font-semibold text-foreground">Complete Negotiation</h2>
              <p className="text-[10px] text-muted-foreground">Publish NegotiatePackage v1</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Provenance */}
          <div className="rounded-lg border border-border bg-accent/30 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Source Package</p>
            <p className="text-[11px] text-foreground">
              EvaluatePackage v{vm.provenance.packageVersion} · {vm.provenance.sourceModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{vm.provenance.sourcePackageVersion}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Strategy v{strategy?.version ?? 0} · {rounds.length} round{rounds.length !== 1 ? "s" : ""} · Authority: {session.current_authority != null ? `$${session.current_authority.toLocaleString()}` : "not set"}
            </p>
          </div>

          {/* Outcome Selection */}
          <div>
            <p className="text-[10px] font-semibold text-foreground mb-2">Outcome</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(OUTCOME_LABELS) as NegotiateOutcomeType[]).map((type) => {
                const Icon = OUTCOME_ICONS[type];
                const selected = outcomeType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setOutcomeType(type)}
                    className={`flex items-center gap-2 text-left px-3 py-2.5 rounded-lg border transition-colors ${
                      selected
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${selected ? "text-primary" : ""}`} />
                    <span className="text-[10px] font-medium leading-tight">{OUTCOME_LABELS[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Settlement Amount (conditional) */}
          {outcomeType === "settled" && (
            <div>
              <label className="text-[10px] font-semibold text-foreground mb-1.5 block">Settlement Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={finalSettlement}
                  onChange={(e) => setFinalSettlement(e.target.value)}
                  placeholder="0"
                  className="w-full text-[12px] pl-7 pr-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* Outcome Notes */}
          <div>
            <label className="text-[10px] font-semibold text-foreground mb-1.5 block">
              Outcome Notes {outcomeType !== "settled" && <span className="text-destructive">*</span>}
            </label>
            <textarea
              value={outcomeNotes}
              onChange={(e) => setOutcomeNotes(e.target.value)}
              rows={3}
              placeholder="Describe the negotiation outcome, key factors, and resolution details…"
              className="w-full text-[11px] rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>

          {/* Non-settled fields */}
          {outcomeType && outcomeType !== "settled" && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-foreground mb-1.5 block">Unresolved Issues (one per line)</label>
                <textarea
                  value={unresolvedIssues}
                  onChange={(e) => setUnresolvedIssues(e.target.value)}
                  rows={2}
                  placeholder="e.g., Liability dispute on comparative negligence…"
                  className="w-full text-[11px] rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-foreground mb-1.5 block">Next-Step Recommendations (one per line)</label>
                <textarea
                  value={nextSteps}
                  onChange={(e) => setNextSteps(e.target.value)}
                  rows={2}
                  placeholder="e.g., Refer to litigation counsel for demand letter review…"
                  className="w-full text-[11px] rounded-lg border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={litigationLikely}
                  onChange={(e) => setLitigationLikely(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-[10px] text-foreground font-medium">Litigation likely (flag for LitIQ handoff)</span>
              </label>
            </>
          )}

          {/* Validation Errors */}
          {validation.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 space-y-1">
              {validation.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                  <p className="text-[10px] text-destructive">{e}</p>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {validation.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 space-y-1">
              {validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <Info className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-amber-700 dark:text-amber-400">{w}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-accent/20">
          <p className="text-[9px] text-muted-foreground italic max-w-[200px]">
            This publishes an immutable, versioned NegotiatePackage for downstream consumption.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-[11px] px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={!validation.valid || publish.isPending}
              className="flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Package className="h-3.5 w-3.5" />
              {publish.isPending ? "Publishing…" : "Publish NegotiatePackage"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteNegotiationDialog;
