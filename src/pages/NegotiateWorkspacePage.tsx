/**
 * NegotiateIQ — Workspace Page
 *
 * Tabbed layout: Strategy & Rounds | Drafting
 * Consuming EvaluatePackage v1 via read-only view model.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCase } from "@/hooks/useCases";
import { useAuth } from "@/contexts/AuthContext";
import { useNegotiateEvalPackage } from "@/hooks/useNegotiateEvalPackage";
import { useNegotiateStaleDetection } from "@/hooks/useNegotiateStaleDetection";
import { useNegotiateStrategy } from "@/hooks/useNegotiateStrategy";
import { useNegotiateSession, useNegotiationRounds } from "@/hooks/useNegotiateSession";
import { useAuditLog } from "@/hooks/useAuditLog";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleId } from "@/types";
import { buildNegotiationViewModel } from "@/lib/negotiateViewModel";
import NegotiateClaimContext from "@/components/negotiate/NegotiateClaimContext";
import NegotiateStrategyPanel from "@/components/negotiate/NegotiateStrategyPanel";
import NegotiateRightPanel from "@/components/negotiate/NegotiateRightPanel";
import NegotiateStaleBanner from "@/components/negotiate/NegotiateStaleBanner";
import NegotiateDraftingWorkspace from "@/components/negotiate/NegotiateDraftingWorkspace";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Handshake,
  Lock,
  Inbox,
  AlertTriangle,
  Calculator,
  Clock,
  Package,
  FileEdit,
  Target,
} from "lucide-react";

type WorkspaceTab = "strategy" | "drafting";

const NegotiateWorkspacePage = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: caseData, isLoading: caseLoading } = useCase(caseId);
  const {
    data: evalPackage,
    isLoading: pkgLoading,
    isError,
    refetch: refetchPackage,
  } = useNegotiateEvalPackage(caseId);
  const audit = useAuditLog();

  const hasModule = isEntitlementActive(entitlements, ModuleId.NegotiateIQ);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>("strategy");

  // Build view model (memoized, never mutates package)
  const viewModel = useMemo(
    () => (evalPackage ? buildNegotiationViewModel(evalPackage) : null),
    [evalPackage]
  );

  // Stale detection
  const { data: staleInfo } = useNegotiateStaleDetection(
    caseId,
    evalPackage?.version
  );

  // Session + strategy + rounds for drafting tab
  const { data: session } = useNegotiateSession(caseId);
  const { data: savedStrategy } = useNegotiateStrategy(caseId);
  const { data: rounds = [] } = useNegotiationRounds(session?.id);

  // Audit: module opened
  useEffect(() => {
    if (!caseId || !caseData) return;
    audit.mutate({
      actionType: "processing_triggered",
      entityType: "negotiate_module",
      entityId: caseId,
      caseId,
      afterValue: {
        action: "module_opened",
        eval_package_version: evalPackage?.version ?? null,
      },
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

            {/* Workspace Tabs */}
            <div className="flex items-center gap-1 ml-6 bg-accent/50 rounded-lg p-0.5">
              <TabButton active={activeTab === "strategy"} onClick={() => setActiveTab("strategy")} icon={Target} label="Strategy & Rounds" />
              <TabButton active={activeTab === "drafting"} onClick={() => setActiveTab("drafting")} icon={FileEdit} label="Drafting" />
            </div>
          </div>

          {/* Provenance badge */}
          {evalPackage && viewModel && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-accent px-2.5 py-1.5 rounded-md border border-border">
                <Package className="h-3 w-3" />
                <span className="font-medium">
                  EvaluatePackage v{viewModel.provenance.packageVersion}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span>
                  {viewModel.provenance.sourceModule === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{viewModel.provenance.sourcePackageVersion}
                </span>
              </div>
              {evalPackage.completed_at && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(evalPackage.completed_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Stale Banner ──────────────────────────── */}
      {staleInfo && (
        <div className="px-6 pt-3">
          <NegotiateStaleBanner
            staleInfo={staleInfo}
            onRefresh={() => refetchPackage()}
          />
        </div>
      )}

      {/* ── Body ──────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {/* Blocked state */}
        {!evalPackage && !isError && (
          <div className="flex items-center justify-center h-full">
            <div className="max-w-md">
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
          </div>
        )}

        {isError && (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={AlertTriangle}
              title="Failed to Load Evaluation"
              description="An error occurred resolving the upstream EvaluatePackage. Please try again."
            />
          </div>
        )}

        {/* Strategy & Rounds Tab */}
        {viewModel && activeTab === "strategy" && (
          <div className="flex h-full">
            {/* Left: Claim Context */}
            <div className="w-[320px] shrink-0 border-r border-border bg-card/50 p-4 overflow-hidden">
              <NegotiateClaimContext vm={viewModel} />
            </div>

            {/* Center: Strategy */}
            <div className="flex-1 min-w-0 p-5 overflow-y-auto">
              <NegotiateStrategyPanel vm={viewModel} caseId={caseId!} evalPackageId={evalPackage!.id} />
            </div>

            {/* Right: Notes / Timeline */}
            <div className="w-[300px] shrink-0 border-l border-border bg-card/50 p-4 overflow-hidden">
              <NegotiateRightPanel caseId={caseId} />
            </div>
          </div>
        )}

        {/* Drafting Tab */}
        {viewModel && activeTab === "drafting" && session && (
          <NegotiateDraftingWorkspace
            vm={viewModel}
            strategy={savedStrategy?.generated_strategy ?? null}
            rounds={rounds}
            sessionId={session.id}
            caseId={caseId!}
          />
        )}

        {/* Drafting tab but no session yet */}
        {viewModel && activeTab === "drafting" && !session && (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={FileEdit}
              title="Start Negotiation First"
              description="Generate a strategy on the Strategy & Rounds tab to create a negotiation session before drafting."
              action={
                <button
                  onClick={() => setActiveTab("strategy")}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Target className="h-3.5 w-3.5" />
                  Go to Strategy
                </button>
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-md transition-colors ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export default NegotiateWorkspacePage;
