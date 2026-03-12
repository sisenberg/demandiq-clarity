/**
 * NegotiateIQ — Authority & Escalation Card
 *
 * Lightweight authority management UI:
 * - Current authority display + edit
 * - Warning when moves exceed authority
 * - One-click escalation summary generation
 * - Escalation status tracking
 */

import { useState, useMemo, useCallback } from "react";
import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import type { GeneratedStrategy } from "@/types/negotiate-strategy";
import type { NegotiationRoundRow, NegotiationSessionRow } from "@/types/negotiate-persistence";
import {
  checkAuthority,
  buildEscalationSummary,
  formatEscalationSummaryText,
  ESCALATION_STATUS_LABELS,
  type EscalationStatus,
  type EscalationSummary,
} from "@/lib/negotiateAuthorityEngine";
import {
  Shield,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Copy,
  Check,
  ArrowUp,
  RefreshCw,
} from "lucide-react";

interface AuthorityCardProps {
  vm: NegotiationViewModel;
  strategy: GeneratedStrategy | null;
  session: NegotiationSessionRow | null;
  rounds: NegotiationRoundRow[];
  caseId: string;
  onUpdateAuthority: (amount: number, reason: string) => void;
  isUpdating?: boolean;
}

const ESCALATION_STATUS_STYLES: Record<EscalationStatus, string> = {
  no_escalation_needed: "bg-emerald-500/10 text-emerald-600",
  escalation_recommended: "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]",
  awaiting_authority_decision: "bg-amber-500/10 text-amber-600",
  authority_updated: "bg-primary/10 text-primary",
};

const AuthorityCard = ({
  vm,
  strategy,
  session,
  rounds,
  caseId,
  onUpdateAuthority,
  isUpdating,
}: AuthorityCardProps) => {
  const [expanded, setExpanded] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [newAuthority, setNewAuthority] = useState("");
  const [reason, setReason] = useState("");
  const [escalationStatus, setEscalationStatus] = useState<EscalationStatus>("no_escalation_needed");
  const [generatedSummary, setGeneratedSummary] = useState<EscalationSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const currentAuthority = session?.current_authority ?? null;
  const recommendedAuthority = strategy?.authorityCeiling.generated ?? vm.valuationRange.authorityRecommendation ?? null;
  const lastOffer = session?.current_last_offer ?? null;

  const authorityCheck = useMemo(
    () => checkAuthority(currentAuthority, recommendedAuthority, lastOffer),
    [currentAuthority, recommendedAuthority, lastOffer]
  );

  // Sync escalation status from check
  useMemo(() => {
    if (authorityCheck.escalationStatus !== "no_escalation_needed" && escalationStatus === "no_escalation_needed") {
      setEscalationStatus(authorityCheck.escalationStatus);
    }
  }, [authorityCheck.escalationStatus]);

  const handleSaveAuthority = useCallback(() => {
    const amount = parseFloat(newAuthority.replace(/[^0-9.]/g, ""));
    if (isNaN(amount) || amount <= 0) return;
    onUpdateAuthority(amount, reason || "Authority updated by adjuster");
    setEditMode(false);
    setNewAuthority("");
    setReason("");
    setEscalationStatus("authority_updated");
  }, [newAuthority, reason, onUpdateAuthority]);

  const handleGenerateSummary = useCallback(() => {
    const requestedAmt = newAuthority
      ? parseFloat(newAuthority.replace(/[^0-9.]/g, ""))
      : recommendedAuthority ?? (currentAuthority ? currentAuthority * 1.2 : 0);

    const summary = buildEscalationSummary({
      caseId,
      vm,
      strategy,
      rounds,
      currentAuthority,
      requestedAmount: requestedAmt,
      reason: reason || "Negotiation posture requires additional settlement authority.",
      currentDemand: session?.current_counteroffer ?? null,
      currentCounter: session?.current_last_offer ?? null,
    });
    setGeneratedSummary(summary);
    setEscalationStatus("awaiting_authority_decision");
  }, [caseId, vm, strategy, rounds, currentAuthority, recommendedAuthority, newAuthority, reason, session]);

  const handleCopy = useCallback(() => {
    if (!generatedSummary) return;
    navigator.clipboard.writeText(formatEscalationSummaryText(generatedSummary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [generatedSummary]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-md flex items-center justify-center ${
            authorityCheck.exceedsAuthority ? "bg-destructive/10" : "bg-accent"
          }`}>
            <Shield className={`h-3 w-3 ${
              authorityCheck.exceedsAuthority ? "text-destructive" : "text-muted-foreground"
            }`} />
          </div>
          <div className="text-left">
            <h3 className="text-[11px] font-semibold text-foreground">Authority Management</h3>
            <p className="text-[9px] text-muted-foreground">
              {currentAuthority != null ? fmt(currentAuthority) : "Not set"}
              {recommendedAuthority != null && currentAuthority !== recommendedAuthority && (
                <span className="ml-1 text-primary">
                  (recommended: {fmt(recommendedAuthority)})
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${ESCALATION_STATUS_STYLES[escalationStatus]}`}>
            {ESCALATION_STATUS_LABELS[escalationStatus]}
          </span>
          {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
        </div>
      </button>

      {/* Authority exceeded warning banner */}
      {authorityCheck.exceedsAuthority && (
        <div className="mx-4 mb-2 flex items-start gap-1.5 px-2.5 py-2 rounded-lg bg-destructive/5 border border-destructive/20">
          <AlertTriangle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
          <p className="text-[9px] text-destructive leading-relaxed">
            Last offer ({fmt(lastOffer)}) exceeds current authority ({fmt(currentAuthority)}) by {fmt(authorityCheck.exceedsBy)} ({authorityCheck.exceedsPct}%).
            Authority adjustment or supervisor approval is required before proceeding.
          </p>
        </div>
      )}

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Authority figures */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox
              label="Current Authority"
              value={currentAuthority != null ? fmt(currentAuthority) : "—"}
              highlight={false}
            />
            <StatBox
              label="Strategy Ceiling"
              value={recommendedAuthority != null ? fmt(recommendedAuthority) : "—"}
              highlight={recommendedAuthority != null && currentAuthority != null && recommendedAuthority > currentAuthority}
            />
            <StatBox
              label="Last Offer"
              value={lastOffer != null ? fmt(lastOffer) : "—"}
              highlight={authorityCheck.exceedsAuthority}
              danger={authorityCheck.exceedsAuthority}
            />
          </div>

          {/* Recommended vs current gap */}
          {recommendedAuthority != null && currentAuthority != null && recommendedAuthority > currentAuthority && (
            <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <ArrowUp className="h-3 w-3 text-primary shrink-0" />
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                Strategy recommends authority of {fmt(recommendedAuthority)}, which is {fmt(recommendedAuthority - currentAuthority)} above current.
              </p>
            </div>
          )}

          {/* Edit authority */}
          {editMode ? (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-accent/20">
              <p className="text-[10px] font-semibold text-foreground">Update Authority</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-muted-foreground mb-0.5 block">New Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <input
                      type="text"
                      value={newAuthority}
                      onChange={(e) => setNewAuthority(e.target.value)}
                      placeholder="0"
                      className="w-full text-[11px] pl-6 pr-2 py-1.5 rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[9px] text-muted-foreground mb-0.5 block">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for authority change…"
                  rows={2}
                  className="w-full text-[10px] rounded-md border border-border bg-background px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAuthority}
                  disabled={!newAuthority || isUpdating}
                  className="text-[10px] font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {isUpdating ? "Saving…" : "Save Authority"}
                </button>
                <button
                  onClick={handleGenerateSummary}
                  className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-accent transition-colors"
                >
                  <FileText className="h-3 w-3" />
                  Generate Escalation Summary
                </button>
                <button
                  onClick={() => { setEditMode(false); setNewAuthority(""); setReason(""); }}
                  className="text-[10px] px-3 py-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Update Authority
              </button>
              <button
                onClick={handleGenerateSummary}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="h-3 w-3" />
                Generate Escalation Summary
              </button>
            </div>
          )}

          {/* Generated Escalation Summary */}
          {generatedSummary && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-foreground">Escalation Summary</p>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="rounded-lg border border-border bg-background p-3 max-h-[240px] overflow-y-auto">
                {generatedSummary.sections.map((s, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                      {s.heading}
                    </p>
                    <pre className="text-[10px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {s.content}
                    </pre>
                  </div>
                ))}
              </div>
              <p className="text-[8px] text-muted-foreground italic">
                Generated {new Date(generatedSummary.generatedAt).toLocaleString("en-US")}
              </p>
            </div>
          )}

          {/* Escalation status selector */}
          <div className="pt-2 border-t border-border">
            <p className="text-[9px] font-semibold text-muted-foreground mb-1.5">Escalation Status</p>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(ESCALATION_STATUS_LABELS) as EscalationStatus[]).map((status) => (
                <button
                  key={status}
                  onClick={() => setEscalationStatus(status)}
                  className={`text-[9px] px-2 py-1 rounded-md border transition-colors ${
                    escalationStatus === status
                      ? `${ESCALATION_STATUS_STYLES[status]} border-current font-semibold`
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ESCALATION_STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StatBox({ label, value, highlight, danger }: { label: string; value: string; highlight: boolean; danger?: boolean }) {
  return (
    <div className={`px-2.5 py-2 rounded-lg border ${
      danger ? "border-destructive/30 bg-destructive/5" : highlight ? "border-primary/30 bg-primary/5" : "border-border bg-accent/30"
    }`}>
      <p className="text-[8px] text-muted-foreground leading-none mb-1">{label}</p>
      <p className={`text-[12px] font-semibold leading-tight ${
        danger ? "text-destructive" : highlight ? "text-primary" : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}

function fmt(n: number | null): string {
  if (n == null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default AuthorityCard;
