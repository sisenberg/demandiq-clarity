/**
 * NegotiateIQ — Left Panel: Evaluation-backed claim context (read-only)
 */

import type { NegotiationViewModel } from "@/lib/negotiateViewModel";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  DollarSign,
  Activity,
  Scale,
  Info,
  Lock,
} from "lucide-react";

interface NegotiateClaimContextProps {
  vm: NegotiationViewModel;
}

const RISK_CATEGORY_LABEL: Record<string, string> = {
  gap: "Treatment Gap",
  credibility: "Credibility",
  venue: "Venue / Jurisdiction",
  causation: "Causation",
  treatment: "Treatment",
  witness: "Witness",
  liability: "Liability",
  other: "Other",
};

const NegotiateClaimContext = ({ vm }: NegotiateClaimContextProps) => {
  const range = vm.valuationRange;

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      {/* Read-only badge */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent/60 border border-border">
        <Lock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Read-only · From EvaluatePackage
        </span>
      </div>

      {/* Valuation Range */}
      <Section title="Valuation Range" icon={DollarSign}>
        <div className="grid grid-cols-3 gap-2">
          <RangeBand label="Floor" value={fmtCurrency(range.selectedFloor ?? range.floor)} />
          <RangeBand label="Likely" value={fmtCurrency(range.selectedLikely ?? range.likely)} accent />
          <RangeBand label="Stretch" value={fmtCurrency(range.selectedStretch ?? range.stretch)} />
        </div>
        {range.authorityRecommendation != null && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-primary/5 border border-primary/10">
            <Shield className="h-3 w-3 text-primary" />
            <span className="text-[10px] text-muted-foreground">Authority:</span>
            <span className="text-[11px] font-semibold text-foreground">{fmtCurrency(range.authorityRecommendation)}</span>
          </div>
        )}
        {range.confidence != null && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Confidence: {Math.round(range.confidence * 100)}%
          </p>
        )}
      </Section>

      {/* Specials Summary */}
      <Section title="Specials Summary" icon={Activity}>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Total Billed" value={fmtCurrency(vm.specials.totalBilled)} />
          <MiniMetric label="Total Reviewed" value={fmtCurrency(vm.specials.totalReviewed)} />
        </div>
        {vm.specials.reductionPercent != null && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Reduction: <span className="font-semibold text-destructive">{vm.specials.reductionPercent}%</span> from billed
          </p>
        )}
      </Section>

      {/* Value Expanders */}
      {vm.expanders.length > 0 && (
        <Section title="Value Expanders" icon={TrendingUp} iconColor="text-[hsl(var(--status-approved))]">
          <div className="space-y-1.5">
            {vm.expanders.map((d) => (
              <DriverRow key={d.key} label={d.label} description={d.description} />
            ))}
          </div>
        </Section>
      )}

      {/* Value Reducers */}
      {vm.reducers.length > 0 && (
        <Section title="Value Reducers" icon={TrendingDown} iconColor="text-destructive">
          <div className="space-y-1.5">
            {vm.reducers.map((d) => (
              <DriverRow key={d.key} label={d.label} description={d.description} />
            ))}
          </div>
        </Section>
      )}

      {/* Notable Risks */}
      {vm.risks.length > 0 && (
        <Section title="Notable Risks & Concerns" icon={AlertTriangle} iconColor="text-[hsl(var(--status-attention))]">
          <div className="space-y-1.5">
            {vm.risks.map((r) => (
              <div key={r.key} className="flex items-start gap-2">
                <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground bg-accent px-1.5 py-0.5 rounded mt-0.5 shrink-0">
                  {RISK_CATEGORY_LABEL[r.category] ?? r.category}
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground">{r.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Assumptions */}
      {vm.assumptions.length > 0 && (
        <Section title="Adopted Assumptions" icon={Scale}>
          <div className="space-y-1.5">
            {vm.assumptions.map((a) => (
              <div key={a.key} className="text-[10px]">
                <span className="font-medium text-foreground">{a.key}:</span>{" "}
                <span className="text-muted-foreground">{a.value}</span>
                {a.reason && (
                  <span className="text-muted-foreground/60 italic"> — {a.reason}</span>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Completeness */}
      <div className="mt-auto pt-3 border-t border-border">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Completeness at publish</span>
          <span className="font-semibold text-foreground">{Math.round(vm.completenessScore)}%</span>
        </div>
        <div className="mt-1 h-1 rounded-full bg-accent overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(vm.completenessScore, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────

function Section({
  title,
  icon: Icon,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={`h-3 w-3 ${iconColor ?? "text-muted-foreground"}`} />
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function RangeBand({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 text-center ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-accent/30"}`}>
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-[13px] font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-accent/30 px-2.5 py-2">
      <p className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[12px] font-bold text-foreground">{value}</p>
    </div>
  );
}

function DriverRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="text-[10px]">
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground ml-1">— {description}</span>
    </div>
  );
}

function fmtCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default NegotiateClaimContext;
