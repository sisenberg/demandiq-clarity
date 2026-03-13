/**
 * EvaluateIQ — Publish Confirmation Dialog
 *
 * Shows eligibility status, package metadata preview,
 * and corridor summary before final publication.
 */

import { useMemo } from "react";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import type { CorridorOverrideEntry } from "@/lib/evaluateOverrideEngine";
import { checkPublishEligibility, type PublishEligibility } from "@/lib/evaluatePublishEngine";
import type { EvaluatePackageV1 } from "@/types/evaluate-package-v1";
import { assembleEvaluatePackageV1 } from "@/lib/evaluatePackageAssembler";
import {
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Shield,
  Package,
  Clock,
  Cpu,
  Tag,
  ArrowRight,
  X,
} from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onPublish: () => void;
  isPending: boolean;
  snapshot: EvaluateIntakeSnapshot;
  moduleStatus: string | undefined;
  overrides: CorridorOverrideEntry[];
  sourceModule: string;
  sourceVersion: number;
  existingVersionCount: number;
  systemCorridor: { low: number; mid: number; high: number };
  isAccepted: boolean;
}

const EvalPublishDialog = ({
  isOpen,
  onClose,
  onPublish,
  isPending,
  snapshot,
  moduleStatus,
  overrides,
  sourceModule,
  sourceVersion,
  existingVersionCount,
  systemCorridor,
  isAccepted,
}: Props) => {
  const newVersion = existingVersionCount + 1;
  const supersededVersion = existingVersionCount > 0 ? existingVersionCount : null;
  const activeOverride = overrides.length > 0 ? overrides[0] : null;

  // Build a lightweight eligibility check
  const eligibility = useMemo<PublishEligibility>(() => {
    const blockers: PublishEligibility["blockers"] = [];
    const warnings: PublishEligibility["warnings"] = [];

    if (!isAccepted && overrides.length === 0) {
      blockers.push({
        code: "NOT_ACCEPTED",
        message: "Accept the recommended corridor or apply an override before publishing.",
      });
    }

    if (!moduleStatus || moduleStatus === "not_started") {
      blockers.push({ code: "MODULE_NOT_STARTED", message: "EvaluateIQ must be started." });
    }

    if (moduleStatus === "completed") {
      blockers.push({
        code: "ALREADY_COMPLETED",
        message: "Module already completed. Reopen to publish a new version.",
      });
    }

    const pendingReviews = overrides.filter(o => o.supervisor_review_status === "pending");
    if (pendingReviews.length > 0) {
      blockers.push({
        code: "PENDING_REVIEW",
        message: `${pendingReviews.length} override(s) awaiting supervisory review.`,
      });
    }

    const totalBilled = snapshot.medical_billing.reduce((s, b) => s + b.billed_amount, 0);
    if (totalBilled === 0) {
      warnings.push({ code: "ZERO_BILLED", message: "Total billed is $0. Confirm this is intentional." });
    }

    if (!snapshot.injuries || snapshot.injuries.length === 0) {
      warnings.push({ code: "NO_INJURIES", message: "No injuries recorded. Corridor may be limited." });
    }

    const docScore = snapshot.overall_completeness_score ?? 0;
    if (docScore < 40) {
      warnings.push({
        code: "LOW_DOC",
        message: `Documentation sufficiency is ${docScore}%. Consider reviewing.`,
      });
    }

    return { eligible: blockers.length === 0, blockers, warnings };
  }, [isAccepted, overrides, moduleStatus, snapshot]);

  if (!isOpen) return null;

  const corridorDisplay = activeOverride
    ? { floor: activeOverride.override_corridor.low, likely: activeOverride.override_corridor.mid, stretch: activeOverride.override_corridor.high, isOverridden: true }
    : { floor: systemCorridor.low, likely: systemCorridor.mid, stretch: systemCorridor.high, isOverridden: false };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Send className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Publish EvaluatePackage</h2>
              <p className="text-[10px] text-muted-foreground">Version {newVersion}{supersededVersion ? ` · supersedes v${supersededVersion}` : ""}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Eligibility */}
          {!eligibility.eligible && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <XCircle className="h-3.5 w-3.5" /> Publication Blocked
              </div>
              {eligibility.blockers.map((b, i) => (
                <p key={i} className="text-[11px] text-destructive/80 ml-5">{b.message}</p>
              ))}
            </div>
          )}

          {eligibility.warnings.length > 0 && (
            <div className="rounded-lg border border-[hsl(var(--status-attention))]/30 bg-[hsl(var(--status-attention))]/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--status-attention))]">
                <AlertTriangle className="h-3.5 w-3.5" /> Warnings
              </div>
              {eligibility.warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-muted-foreground ml-5">{w.message}</p>
              ))}
            </div>
          )}

          {eligibility.eligible && (
            <div className="rounded-lg border border-[hsl(var(--status-approved))]/30 bg-[hsl(var(--status-approved))]/5 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--status-approved))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Ready to Publish
              </div>
            </div>
          )}

          {/* Corridor Summary */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" /> Corridor Summary
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <CorridorCell label="Floor" value={corridorDisplay.floor} />
              <CorridorCell label="Likely" value={corridorDisplay.likely} highlight />
              <CorridorCell label="Stretch" value={corridorDisplay.stretch} />
            </div>
            {corridorDisplay.isOverridden && (
              <p className="text-[10px] text-[hsl(var(--status-attention))] mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Corridor was overridden by adjuster
              </p>
            )}
          </section>

          {/* Package Metadata */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-primary" /> Package Metadata
            </h3>
            <div className="space-y-1.5 text-xs">
              <MetaRow label="Version" value={`v${newVersion}`} />
              {supersededVersion && <MetaRow label="Supersedes" value={`v${supersededVersion}`} />}
              <MetaRow label="Source" value={`${sourceModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v${sourceVersion}`} />
              <MetaRow label="Engine" value="v1.0.0" />
              <MetaRow label="Scoring Logic" value="v1.0.0" />
              <MetaRow label="Completeness" value={`${(snapshot.overall_completeness_score ?? 0).toFixed(0)}%`} />
              <MetaRow label="Overrides" value={`${overrides.length} recorded`} />
            </div>
          </section>

          {/* Downstream */}
          <section className="rounded-lg border border-border p-4">
            <h3 className="text-[11px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary" /> Downstream Impact
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Publishing will make this package available to <strong className="text-foreground">NegotiateIQ</strong> and other downstream modules.
              {supersededVersion && " Previous consumers will be notified of the updated version."}
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/30 rounded-b-xl">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={onPublish}
            disabled={!eligibility.eligible || isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish v{newVersion}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────

function CorridorCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`text-center p-2 rounded-md ${highlight ? "bg-primary/5 border border-primary/20" : "bg-muted/30"}`}>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${highlight ? "text-primary" : "text-foreground"}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export default EvalPublishDialog;
