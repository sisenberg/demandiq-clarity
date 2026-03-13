/**
 * NegotiateIQ inline workspace — shown inside the case detail page nav rail.
 * Resolves the EvaluatePackage and shows blocked or summary state.
 */

import { Link } from "react-router-dom";
import { useNegotiateEvalPackage } from "@/hooks/useNegotiateEvalPackage";
import EmptyState from "@/components/ui/EmptyState";
import { AlertTriangle, Calculator, Handshake, ExternalLink } from "lucide-react";

interface NegotiateInlineWorkspaceProps {
  caseId: string;
}

const NegotiateInlineWorkspace = ({ caseId }: NegotiateInlineWorkspaceProps) => {
  const { data: evalPackage, isLoading } = useNegotiateEvalPackage(caseId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!evalPackage) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Complete Evaluation Required"
        description="NegotiateIQ starts only after EvaluateIQ has been completed. Publish an EvaluatePackage first."
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
    );
  }

  const raw = evalPackage.package_payload;
  // Normalize v1 vs legacy
  const isV1 = "settlement_corridor" in raw;
  const floor = isV1 ? (raw as any).settlement_corridor.range_floor ?? (raw as any).settlement_corridor.selected_floor : (raw as any).range_floor ?? (raw as any).selected_floor;
  const stretch = isV1 ? (raw as any).settlement_corridor.range_stretch ?? (raw as any).settlement_corridor.selected_stretch : (raw as any).range_stretch ?? (raw as any).selected_stretch;
  const totalReviewed = isV1 ? (raw as any).total_reviewed : (raw as any).total_reviewed;
  const completenessScore = isV1 ? (raw as any).completeness_score : (raw as any).completeness_score;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-[hsl(var(--status-attention))]" />
          <h2 className="text-[13px] font-semibold text-foreground">NegotiateIQ</h2>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
            Eval v{evalPackage.version}
          </span>
        </div>
        <Link
          to={`/cases/${caseId}/negotiate`}
          className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
        >
          Open Workspace <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniMetric label="Range Floor" value={fmtCurrency(floor)} />
        <MiniMetric label="Range Stretch" value={fmtCurrency(stretch)} />
        <MiniMetric label="Total Reviewed" value={fmtCurrency(totalReviewed)} />
        <MiniMetric label="Completeness" value={`${Math.round(completenessScore ?? 0)}%`} />
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          Negotiation strategy, history, and drafting tools are available in the{" "}
          <Link to={`/cases/${caseId}/negotiate`} className="text-primary hover:underline font-medium">
            full NegotiateIQ workspace
          </Link>.
        </p>
      </div>
    </div>
  );
};

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-accent/30 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[13px] font-bold text-foreground">{value}</p>
    </div>
  );
}

export default NegotiateInlineWorkspace;
