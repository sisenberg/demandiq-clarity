import { useParams } from "react-router-dom";
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
  History,
  Send,
  User,
} from "lucide-react";

interface PublishedPackage {
  id: string;
  version: number;
  completed_at: string | null;
  completed_by: string | null;
  package_payload: Record<string, unknown>;
  snapshot_id?: string | null;
  valuation_run_id?: string | null;
  selection_id?: string | null;
  created_at: string;
}

interface Props {
  snapshot: EvaluateIntakeSnapshot;
  publishedPackages: PublishedPackage[];
}

const EvalHandoffTab = ({ snapshot, publishedPackages }: Props) => {
  const { caseId } = useParams<{ caseId: string }>();
  const { entitlements } = useAuth();
  const { data: evalCompletion } = useModuleCompletion(caseId, "evaluateiq");

  const hasNegotiateIQ = isEntitlementActive(entitlements, ModuleId.NegotiateIQ);
  const isCompleted = evalCompletion?.status === ModuleCompletionStatus.Completed;

  const latestPkg = publishedPackages[0] ?? null;
  const payload = latestPkg?.package_payload as Record<string, unknown> | undefined;
  const priorPackages = publishedPackages.slice(1);

  return (
    <div className="space-y-6">
      {/* Package Status */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">EvaluatePackage Status</h3>
        </div>

        {latestPkg ? (
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
                <span className="font-medium text-foreground">Published By</span>
                <p className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {(payload?.audit as any)?.published_by
                    ? String((payload?.audit as any).published_by).slice(0, 8) + "…"
                    : (latestPkg.completed_by ? latestPkg.completed_by.slice(0, 8) + "…" : "—")}
                </p>
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
              <div>
                <span className="font-medium text-foreground">Status</span>
                <p className="capitalize">{payload?.evaluation_status as string ?? "published"}</p>
              </div>
            </div>

            {/* Superseded indicator */}
            {priorPackages.length > 0 && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 pt-2 border-t border-border">
                <History className="h-3 w-3" />
                Supersedes v{priorPackages[0].version} · {priorPackages.length} prior version{priorPackages.length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-sm">No package published yet. Complete the evaluation to publish.</span>
          </div>
        )}
      </section>

      {/* Package Preview */}
      {latestPkg && payload && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Package Contents</h3>
          </div>
          <div className="space-y-2 text-xs">
            <PackageRow label="Total Billed" value={formatCurrency(payload.total_billed as number)} />
            <PackageRow label="Total Reviewed" value={payload.total_reviewed ? formatCurrency(payload.total_reviewed as number) : "N/A"} />
            <PackageRow label="Range Floor" value={formatCorridorValue(payload, "range_floor")} />
            <PackageRow label="Range Likely" value={formatCorridorValue(payload, "range_likely")} />
            <PackageRow label="Range Stretch" value={formatCorridorValue(payload, "range_stretch")} />
            <PackageRow label="Authority Recommendation" value={formatCorridorValue(payload, "authority_recommendation")} />
            <PackageRow label="Confidence" value={formatConfidence(payload)} />
            <PackageRow label="Overrides" value={`${(payload.overrides as unknown[])?.length ?? 0} recorded`} />
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
          <DownstreamRow
            name="NegotiateIQ"
            licensed={hasNegotiateIQ}
            ready={!!latestPkg}
            packageVersion={latestPkg?.version ?? null}
          />
          <DownstreamRow
            name="LitIQ"
            licensed={isEntitlementActive(entitlements, ModuleId.LitIQ)}
            ready={false}
            packageVersion={null}
          />
        </div>
      </section>

      {/* Version History */}
      {publishedPackages.length > 1 && (
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <History className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Package History</h3>
          </div>
          <div className="space-y-1">
            {publishedPackages.map((pkg, idx) => {
              const pkgPayload = pkg.package_payload as Record<string, unknown> | undefined;
              const isCurrent = idx === 0;
              const supersededBy = idx > 0 ? publishedPackages[idx - 1].version : null;

              return (
                <div
                  key={pkg.id}
                  className={`flex items-center justify-between text-xs py-2 px-3 rounded-lg ${
                    isCurrent ? "bg-primary/5 border border-primary/15" : "bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCurrent ? (
                      <Send className="h-3 w-3 text-primary" />
                    ) : (
                      <History className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={`font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                      v{pkg.version}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                        Current
                      </span>
                    )}
                    {supersededBy && (
                      <span className="text-[9px] text-muted-foreground">
                        superseded by v{supersededBy}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{pkgPayload?.evaluation_status as string ?? "published"}</span>
                    <span>{pkg.completed_at ? new Date(pkg.completed_at).toLocaleDateString() : "—"}</span>
                  </div>
                </div>
              );
            })}
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
        {ready ? `Ready — will receive v${packageVersion}` : "Awaiting EvaluateIQ publication"}
      </span>
    </div>
  );
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatCorridorValue(payload: Record<string, unknown>, key: string): string {
  const corridor = payload.settlement_corridor as Record<string, unknown> | undefined;
  const val = corridor?.[key] as number | null | undefined;
  if (val == null) return "Pending";
  return formatCurrency(val);
}

function formatConfidence(payload: Record<string, unknown>): string {
  const corridor = payload.settlement_corridor as Record<string, unknown> | undefined;
  const conf = corridor?.confidence as number | null | undefined;
  if (conf == null) return "—";
  return `${(conf * 100).toFixed(0)}%`;
}

export default EvalHandoffTab;
