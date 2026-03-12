/**
 * NegotiateIQ — Workspace Page
 *
 * Downstream module that consumes EvaluatePackage v1.
 * Shows blocked state when no completed evaluation exists.
 */

import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useCase } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { useNegotiateEvalPackage } from "@/hooks/useNegotiateEvalPackage";
import { useAuditLog } from "@/hooks/useAuditLog";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleId } from "@/types";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Handshake,
  Lock,
  Inbox,
  AlertTriangle,
  Calculator,
  MessageSquare,
  History,
  FileEdit,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
} from "lucide-react";

const NegotiateWorkspacePage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const { data: evalPackage, isLoading: pkgLoading, isError } = useNegotiateEvalPackage(caseId);
  const audit = useAuditLog();

  const hasModule = isEntitlementActive(entitlements, ModuleId.NegotiateIQ);

  // Audit: module opened
  useEffect(() => {
    if (!caseId || !caseData) return;
    audit.mutate({
      actionType: "processing_triggered",
      entityType: "negotiate_module",
      entityId: caseId,
      caseId,
      afterValue: { action: "module_opened" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, caseData?.id]);

  if (caseLoading || pkgLoading) return <PageLoading message="Loading NegotiateIQ…" />;

  if (!hasModule) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16">
        <EmptyState
          icon={Lock}
          title="NegotiateIQ Not Enabled"
          description="This module is not included in your current plan. Contact your administrator to enable NegotiateIQ."
        />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8">
        <Link to="/cases" className="text-sm text-primary hover:underline flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Cases
        </Link>
        <EmptyState icon={Inbox} title="Case not found" description="This case may have been removed or you don't have access." />
      </div>
    );
  }

  const claimVsInsured = caseData.title || `${caseData.claimant} v. ${caseData.insured}`;
  const payload = evalPackage?.package_payload;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────── */}
      <div className="shrink-0 bg-card border-b border-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={`/cases/${caseId}`} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-[hsl(var(--status-attention))]/10 flex items-center justify-center">
              <Handshake className="h-4 w-4 text-[hsl(var(--status-attention))]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">NegotiateIQ</h1>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {claimVsInsured} · {caseData.case_number}
              </p>
            </div>
          </div>

          {evalPackage && (
            <span className="text-[10px] font-medium text-muted-foreground bg-accent px-2 py-1 rounded-md">
              EvaluatePackage v{evalPackage.version}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto">
          {/* ── Blocked state ────────────────────── */}
          {!evalPackage && !isError && (
            <div className="mt-12">
              <EmptyState
                icon={AlertTriangle}
                title="Complete Evaluation Required"
                description="NegotiateIQ starts only after EvaluateIQ has been completed. A published EvaluatePackage is required to begin negotiation strategy."
                action={
                  <Link
                    to={`/cases/${caseId}/evaluate`}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Go to EvaluateIQ
                  </Link>
                }
              />
            </div>
          )}

          {isError && (
            <div className="mt-12">
              <EmptyState
                icon={AlertTriangle}
                title="Failed to Load Evaluation"
                description="An error occurred resolving the upstream EvaluatePackage. Please try again."
              />
            </div>
          )}

          {/* ── Active workspace shell ───────────── */}
          {evalPackage && payload && (
            <div className="space-y-5">
              {/* Evaluation Snapshot Summary */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-4 w-4 text-primary" />
                  <h2 className="text-[13px] font-semibold text-foreground">Evaluation Snapshot</h2>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
                    v{evalPackage.version} · Published
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard label="Total Billed" value={fmtCurrency(payload.total_billed)} />
                  <MetricCard label="Total Reviewed" value={fmtCurrency(payload.total_reviewed)} />
                  <MetricCard label="Range Floor" value={fmtCurrency(payload.range_floor ?? payload.selected_floor)} />
                  <MetricCard label="Range Stretch" value={fmtCurrency(payload.range_stretch ?? payload.selected_stretch)} />
                </div>

                {payload.authority_recommendation != null && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-accent/50 border border-border">
                    <span className="text-[10px] font-medium text-muted-foreground">Authority Recommendation: </span>
                    <span className="text-[12px] font-semibold text-foreground">{fmtCurrency(payload.authority_recommendation)}</span>
                  </div>
                )}

                {/* Value drivers summary */}
                {payload.driver_summaries && payload.driver_summaries.length > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Key Drivers</p>
                    {payload.driver_summaries.slice(0, 6).map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11px]">
                        {d.impact === "expander" ? (
                          <TrendingUp className="h-3 w-3 text-[hsl(var(--status-approved))]" />
                        ) : d.impact === "reducer" ? (
                          <TrendingDown className="h-3 w-3 text-destructive" />
                        ) : (
                          <Info className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-foreground font-medium">{d.label}</span>
                        <span className="text-muted-foreground truncate flex-1">{d.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Negotiation Strategy Panel — Placeholder */}
              <PlaceholderPanel
                icon={DollarSign}
                title="Negotiation Strategy"
                description="Opening position, target range, and concession strategy will be configured here."
              />

              {/* Negotiation History Panel — Placeholder */}
              <PlaceholderPanel
                icon={History}
                title="Negotiation History"
                description="All offers, counteroffers, and position changes will be tracked chronologically."
              />

              {/* Drafting Panel — Placeholder */}
              <PlaceholderPanel
                icon={FileEdit}
                title="Drafting"
                description="Generate and edit negotiation correspondence, demand responses, and settlement proposals."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-accent/30 px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-[14px] font-bold text-foreground">{value}</p>
    </div>
  );
}

function PlaceholderPanel({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
          Coming Soon
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

export default NegotiateWorkspacePage;
