/**
 * EvaluateIQ — Published Package View
 * Shows the published EvaluatePackage details for a given case.
 */

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  Clock,
  Calculator,
  FileText,
} from "lucide-react";

const EvaluatePackageViewPage = () => {
  const { caseId } = useParams<{ caseId: string }>();

  const { data: packages, isLoading } = useQuery({
    queryKey: ["evaluate-packages-view", caseId],
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

  if (isLoading) return <PageLoading message="Loading package…" />;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/cases/${caseId}/evaluate`} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">EvaluatePackage — Published Output</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Versioned valuation packages for downstream modules</p>
        </div>
      </div>

      {(!packages || packages.length === 0) ? (
        <EmptyState
          icon={Package}
          title="No Package Published"
          description="Complete the evaluation workflow to publish an EvaluatePackage."
        />
      ) : (
        <div className="space-y-4">
          {packages.map((pkg: any) => {
            const payload = pkg.package_payload as Record<string, unknown> | undefined;
            return (
              <div key={pkg.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))]" />
                    <span className="text-[13px] font-semibold text-foreground">Version {pkg.version}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {pkg.completed_at ? new Date(pkg.completed_at).toLocaleString() : "—"}
                  </div>
                </div>
                {payload && (
                  <div className="grid grid-cols-2 gap-3 text-[11px]">
                    <PackageField label="Source" value={`${(payload.source_module as string) === "revieweriq" ? "ReviewerIQ" : "DemandIQ"} v${payload.source_package_version ?? 1}`} />
                    <PackageField label="Engine Version" value={(payload.engine_version as string) ?? "—"} />
                    <PackageField label="Range Floor" value={payload.range_floor ? `$${(payload.range_floor as number).toLocaleString()}` : "—"} />
                    <PackageField label="Range Likely" value={payload.range_likely ? `$${(payload.range_likely as number).toLocaleString()}` : "—"} />
                    <PackageField label="Range Stretch" value={payload.range_stretch ? `$${(payload.range_stretch as number).toLocaleString()}` : "—"} />
                    <PackageField label="Confidence" value={payload.confidence ? `${((payload.confidence as number) * 100).toFixed(0)}%` : "—"} />
                    <PackageField label="Assumptions" value={`${(payload.assumptions as unknown[])?.length ?? 0} adopted`} />
                    <PackageField label="Explanation Ledger" value={payload.explanation_ledger ? "Included" : "Not available"} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

function PackageField({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5">
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <p className="text-[11px] font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

export default EvaluatePackageViewPage;
