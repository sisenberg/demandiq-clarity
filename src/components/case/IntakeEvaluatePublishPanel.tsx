import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw,
  FileText, Activity, Bone, DollarSign, Users, Shield, XCircle, Rocket,
} from "lucide-react";
import {
  useIntakeEvaluationPackage,
  useAssembleIntakePackage,
  usePublishIntakePackage,
  PACKAGE_STATUS_LABEL,
  PACKAGE_STATUS_COLOR,
  type IntakeEvaluationPackageRow,
} from "@/hooks/useIntakeEvaluationPackage";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  caseId: string;
  tenantId: string;
}

const IntakeEvaluatePublishPanel = ({ caseId, tenantId }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: pkg, isLoading } = useIntakeEvaluationPackage(caseId);
  const assemblePackage = useAssembleIntakePackage();
  const publishPackage = usePublishIntakePackage();
  const [showDetail, setShowDetail] = useState(false);

  const userId = user?.id ?? "";

  if (isLoading) {
    return (
      <div className="card-elevated p-5 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const isPublished = pkg?.package_status === "published_to_evaluateiq";
  const isReady = pkg?.package_status === "ready_for_review";
  const isDraft = pkg?.package_status === "draft";
  const missingFlags = (pkg?.missing_data_flags ?? []) as Array<{ field: string; message: string }>;
  const criticalMissing = missingFlags.filter((f) => ["demand", "specials", "injuries"].includes(f.field));
  const hasCriticalMissing = criticalMissing.length > 0;

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">EvaluateIQ Intake Package</h3>
          {pkg && (
            <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${PACKAGE_STATUS_COLOR[pkg.package_status] ?? "bg-accent text-muted-foreground border-border"}`}>
              {PACKAGE_STATUS_LABEL[pkg.package_status] ?? pkg.package_status}
            </span>
          )}
          {pkg && (
            <span className="text-[9px] text-muted-foreground">v{pkg.version}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Assemble / Refresh */}
          <button
            onClick={() => assemblePackage.mutate({ caseId, tenantId, userId })}
            disabled={assemblePackage.isPending}
            className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${assemblePackage.isPending ? "animate-spin" : ""}`} />
            {pkg ? "Refresh Package" : "Assemble Package"}
          </button>

          {/* Publish */}
          {pkg && !isPublished && (
            <button
              onClick={() => publishPackage.mutate({ caseId, tenantId, userId })}
              disabled={publishPackage.isPending || hasCriticalMissing}
              title={hasCriticalMissing ? "Resolve missing data before publishing" : "Publish to EvaluateIQ"}
              className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <ArrowRight className="h-3 w-3" />
              {publishPackage.isPending ? "Publishing…" : "Publish to EvaluateIQ"}
            </button>
          )}

          {isPublished && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[hsl(var(--status-approved))]">
                <CheckCircle2 className="h-3.5 w-3.5" /> Published
              </span>
              <button
                onClick={() => navigate(`/cases/${caseId}/evaluate`)}
                className="inline-flex items-center gap-1.5 text-[10px] font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Rocket className="h-3 w-3" />
                Launch EvaluateIQ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* No package yet */}
      {!pkg && (
        <div className="px-5 py-6 text-center">
          <Package className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No intake package assembled yet.</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Click "Assemble Package" to compile OCR extractions into the EvaluateIQ intake contract.
          </p>
        </div>
      )}

      {/* Package summary */}
      {pkg && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 px-5 py-3 border-b border-border bg-accent/30">
            <StatCell icon={Bone} label="Injuries" value={(pkg.injury_summary as any[]).length} />
            <StatCell icon={DollarSign} label="Specials" value={(pkg.specials_summary as any)?.bill_count ?? 0} sub={`$${((pkg.specials_summary as any)?.total_billed ?? 0).toLocaleString()}`} />
            <StatCell icon={Activity} label="Treatments" value={(pkg.treatment_summary as any)?.total_events ?? 0} />
            <StatCell icon={Users} label="Providers" value={(pkg.provider_list as any[]).length} />
            <StatCell icon={Shield} label="Missing" value={missingFlags.length} highlight={missingFlags.length > 0} />
          </div>

          {/* Missing data flags */}
          {missingFlags.length > 0 && (
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--status-attention))]" />
                <span className="text-[11px] font-semibold text-foreground">
                  {hasCriticalMissing ? "Critical data missing — cannot publish" : "Warnings"}
                </span>
              </div>
              <div className="space-y-1">
                {missingFlags.map((f) => (
                  <div key={f.field} className="flex items-center gap-2 text-[10px]">
                    {["demand", "specials", "injuries"].includes(f.field) ? (
                      <XCircle className="h-3 w-3 text-destructive shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))] shrink-0" />
                    )}
                    <span className="text-foreground">{f.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical flags summary */}
          <div className="px-5 py-3 border-b border-border">
            <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Clinical Indicators</p>
            <div className="flex flex-wrap gap-1.5">
              <FlagChip label="Objective Support" count={(pkg.objective_support_flags as any[]).length} />
              <FlagChip label="Invasive Treatment" count={(pkg.invasive_treatment_flags as any[]).length} />
              <FlagChip label="Residual Symptoms" count={(pkg.residual_symptom_flags as any[]).length} />
              <FlagChip label="Functional Impact" count={(pkg.functional_impact_flags as any[]).length} />
            </div>
          </div>

          {/* Expandable detail */}
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="w-full px-5 py-2 text-left text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
          >
            {showDetail ? "▾ Hide package details" : "▸ Show package details"}
          </button>

          {showDetail && (
            <div className="px-5 pb-4 space-y-3">
              {/* Demand fields */}
              <DetailSection title="Demand Context">
                <DetailRow label="Claimant" value={pkg.claimant_name} />
                <DetailRow label="Attorney" value={pkg.attorney_name} />
                <DetailRow label="Firm" value={pkg.law_firm} />
                <DetailRow label="Represented" value={pkg.represented_status} />
                <DetailRow label="Demand Amount" value={pkg.demand_amount ? `$${pkg.demand_amount.toLocaleString()}` : "—"} />
                <DetailRow label="Deadline" value={pkg.demand_deadline || "—"} />
              </DetailSection>

              {/* Treatment context */}
              <DetailSection title="Treatment Context">
                <DetailRow label="Total Events" value={(pkg.treatment_summary as any)?.total_events ?? 0} />
                <DetailRow label="First Treatment" value={(pkg.treatment_summary as any)?.first_treatment_date ?? "—"} />
                <DetailRow label="Last Treatment" value={(pkg.treatment_summary as any)?.last_treatment_date ?? "—"} />
                <DetailRow label="Duration" value={`${(pkg.treatment_summary as any)?.treatment_duration_days ?? 0} days`} />
              </DetailSection>

              {/* Metadata */}
              <DetailSection title="Package Metadata">
                <DetailRow label="Version" value={`v${pkg.version}`} />
                <DetailRow label="Assembled" value={pkg.assembled_at ? new Date(pkg.assembled_at).toLocaleString() : "—"} />
                <DetailRow label="Published" value={pkg.published_at ? new Date(pkg.published_at).toLocaleString() : "—"} />
              </DetailSection>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Primitives ────────────────────────────────────────

function StatCell({ icon: Icon, label, value, sub, highlight }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <p className={`text-[14px] font-bold tabular-nums ${highlight ? "text-[hsl(var(--status-attention))]" : "text-foreground"}`}>{value}</p>
      </div>
      <p className="text-[8px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground font-medium">{sub}</p>}
    </div>
  );
}

function FlagChip({ label, count }: { label: string; count: number }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[8px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${
      count > 0
        ? "bg-[hsl(var(--status-attention))]/10 border-[hsl(var(--status-attention))]/20 text-[hsl(var(--status-attention))]"
        : "bg-accent border-border text-muted-foreground"
    }`}>
      {count > 0 ? <CheckCircle2 className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5" />}
      {label}: {count}
    </span>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{title}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value ?? "—"}</span>
    </div>
  );
}

export default IntakeEvaluatePublishPanel;
