/**
 * EvaluateIQ — Dual Range Display Card
 *
 * Shows both fact-based value range and expected resolution range
 * with clear visual separation and labeling.
 */

import type { RepresentationAwareValuation } from '@/types/representation-valuation';
import {
  Scale,
  Target,
  ArrowRight,
} from 'lucide-react';

interface Props {
  valuation: RepresentationAwareValuation;
}

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `$${n}`;

const EvalDualRangeCard = ({ valuation }: Props) => {
  const { fact_based_value_range: fact, expected_resolution_range: expected } = valuation;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Scale className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Dual-Range Valuation</h3>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Fact-Based Value Range */}
          <RangeColumn
            title="Fact-Based Value Range"
            subtitle="Grounded in claim facts only"
            icon={Scale}
            low={fact.low}
            mid={fact.mid}
            high={fact.high}
            color="text-foreground"
            barColor="bg-muted-foreground/40"
          />

          {/* Arrow separator */}
          <div className="hidden lg:flex flex-col items-center gap-1 text-muted-foreground/40">
            <ArrowRight className="h-4 w-4" />
            <span className="text-[8px] font-mono">context</span>
          </div>

          {/* Expected Resolution Range */}
          <RangeColumn
            title="Expected Resolution Range"
            subtitle="Practical settlement expectation"
            icon={Target}
            low={expected.low}
            mid={expected.mid}
            high={expected.high}
            color="text-primary"
            barColor="bg-primary"
            highlight
          />
        </div>

        {/* Delta indicator */}
        {fact.mid > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Resolution expectation is</span>
            <span className="font-semibold text-foreground">
              {Math.round((expected.mid / fact.mid) * 100)}%
            </span>
            <span>of fact-based mid-point</span>
            {expected.mid < fact.mid && (
              <span className="text-[9px] italic">
                (reflects negotiation context, not merit reduction)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function RangeColumn({
  title, subtitle, icon: Icon, low, mid, high, color, barColor, highlight,
}: {
  title: string; subtitle: string; icon: React.ElementType;
  low: number; mid: number; high: number;
  color: string; barColor: string; highlight?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
      </div>
      <p className="text-[9px] text-muted-foreground">{subtitle}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] text-muted-foreground">{fmt(low)}</span>
        <span className="text-[8px] text-muted-foreground/40">—</span>
        <span className={`text-lg font-bold ${highlight ? 'text-primary' : color}`}>{fmt(mid)}</span>
        <span className="text-[8px] text-muted-foreground/40">—</span>
        <span className="text-[11px] text-muted-foreground">{fmt(high)}</span>
      </div>
      <RangeMiniBar low={low} mid={mid} high={high} color={barColor} />
    </div>
  );
}

function RangeMiniBar({ low, mid, high, color }: { low: number; mid: number; high: number; color: string }) {
  const maxVal = high > 0 ? high * 1.2 : 100;
  const pctLow = Math.min((low / maxVal) * 100, 100);
  const pctMid = Math.min((mid / maxVal) * 100, 100);
  const pctHigh = Math.min((high / maxVal) * 100, 100);

  return (
    <div className="relative h-1.5 rounded-full bg-accent overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 ${color} opacity-30 rounded-full`}
        style={{ left: `${pctLow}%`, width: `${Math.max(1, pctHigh - pctLow)}%` }}
      />
      <div
        className={`absolute top-0 bottom-0 w-0.5 ${color}`}
        style={{ left: `${pctMid}%` }}
      />
    </div>
  );
}

export default EvalDualRangeCard;
