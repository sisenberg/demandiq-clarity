import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useModuleCompletion } from "@/hooks/useModuleCompletion";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";
import { ModuleId, ModuleCompletionStatus } from "@/types";
import type { EvaluateIntakeSnapshot } from "@/types/evaluate-intake";
import {
  Package,
  CheckCircle2,
  Clock,
  Lock,
  ArrowRight,
  AlertTriangle,
  FileText,
} from "lucide-react";

interface Props {
  snapshot: EvaluateIntakeSnapshot;
}

const EvalHandoffTab = ({ snapshot }: Props) => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");

  const hasNegotiateIQ = isEntitlementActive(entitlements, ModuleId.NegotiateIQ);
  const isCompleted = evalCompletion?.status === ModuleCompletionStatus.Completed;

  // Fetch published packages
  const { data: packages = [] } = useQuery({
    queryKey: ["evaluation-packages", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("evaluation_packages") as any)
        .select("id, version, completed_at, completed_by, package_payload")
        .eq("case_id", caseId!)
        .order("version", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const latestPkg = packages[0];
  const payload = latestPkg?.package_payload as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      {/* Package Status */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">EvaluatePackage Status</h3>
        </div>

        {isCompleted && latestPkg ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[hsl(var(--status-approved))]">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Published — v{latestPkg.version}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Published At</span>
                <p>{latestPkg.completed_at ? new Date(latestPkg.completed_at).toLocaleString() : "—"}</p>
              </div>
              <div>
                <span className="font-medium text-foreground">Source</span>
                <p>{(payload?.source_module as string) === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v{payload?.source_package_version as number ?? 1}</p>
              </div>
              <div>
                <span className="font-medium text-foreground">Engine Version</span>
                <p>{payload?.engine_version as string ?? "1.0.0"}</p>
              </div>
              <div>
                <span className="font-medium text-foreground">Completeness</span>
                <p>{(payload?.completeness_score as number ?? 0).toFixed(0)}%</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">No package published yet. Complete the evaluation to publish.</span>
          </div>
        )}
      </section>

      {/* Package Preview */}
      {isCompleted && payload && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Package Contents</h3>
          </div>
          <div className="space-y-2 text-xs">
            <PackageRow label="Total Billed" value={formatCurrency(payload.total_billed as number)} />
            <PackageRow label="Total Reviewed" value={payload.total_reviewed ? formatCurrency(payload.total_reviewed as number) : "N/A"} />
            <PackageRow label="Range Floor" value={payload.range_floor ? formatCurrency(payload.range_floor as number) : "Pending"} />
            <PackageRow label="Range Likely" value={payload.range_likely ? formatCurrency(payload.range_likely as number) : "Pending"} />
            <PackageRow label="Range Stretch" value={payload.range_stretch ? formatCurrency(payload.range_stretch as number) : "Pending"} />
            <PackageRow label="Authority Recommendation" value={payload.authority_recommendation ? formatCurrency(payload.authority_recommendation as number) : "Not set"} />
            <PackageRow label="Confidence" value={payload.confidence ? `${((payload.confidence as number) * 100).toFixed(0)}%` : "—"} />
            <PackageRow label="Driver Summaries" value={`${(payload.driver_summaries as unknown[])?.length ?? 0} entries`} />
            <PackageRow label="Assumptions" value={`${(payload.assumptions as unknown[])?.length ?? 0} adopted`} />
            <PackageRow label="Explanation Ledger" value={payload.explanation_ledger ? "Included" : "Not available"} />
          </div>
        </section>
      )}

      {/* Downstream Readiness */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Downstream Modules</h3>
        </div>

        <div className="space-y-3">
          {/* NegotiateIQ */}
          <DownstreamRow
            name="NegotiateIQ"
            licensed={hasNegotiateIQ}
            ready={isCompleted}
            packageVersion={latestPkg?.version ?? null}
          />
          {/* LitIQ — always shown as future */}
          <DownstreamRow
            name="LitIQ"
            licensed={isEntitlementActive(entitlements, ModuleId.LitIQ)}
            ready={false}
            packageVersion={null}
          />
        </div>
      </section>

      {/* Version History */}
      {packages.length > 1 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Package History</h3>
          <div className="space-y-2">
            {packages.map((pkg: any) => (
              <div key={pkg.id} className="flex items-center justify-between text-xs text-muted-foreground py-1.5 border-b border-border last:border-0">
                <span className="font-medium text-foreground">v{pkg.version}</span>
                <span>{pkg.completed_at ? new Date(pkg.completed_at).toLocaleString() : "—"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────

function PackageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function DownstreamRow({
  name,
  licensed,
  ready,
  packageVersion,
}: {
  name: string;
  licensed: boolean;
  ready: boolean;
  packageVersion: number | null;
}) {
  if (!licensed) {
    return (
      <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">{name}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Not licensed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {ready ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
        )}
        <span className="text-xs font-medium text-foreground">{name}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">
        {ready ? `Ready — will receive v${packageVersion}` : "Awaiting EvaluateIQ completion"}
      </span>
    </div>
  );
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export default EvalHandoffTab;
