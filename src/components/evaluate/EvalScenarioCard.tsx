/**
 * EvaluateIQ — Scenario Modeling Card
 *
 * Displays representation-aware resolution scenarios with
 * probability and range breakdowns.
 */

import type { RepresentationAwareValuation, RepresentationScenario } from '@/types/representation-valuation';
import {
  GitBranch,
  TrendingUp,
  Users,
  Zap,
  Briefcase,
} from 'lucide-react';

interface Props {
  valuation: RepresentationAwareValuation;
}

const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `$${n}`;

const EvalScenarioCard = ({ valuation }: Props) => {
  const { scenarios } = valuation;

  const activeScenarios: (RepresentationScenario & { icon: React.ElementType })[] = [];

  if (scenarios.direct_resolution_range_unrepresented) {
    activeScenarios.push({ ...scenarios.direct_resolution_range_unrepresented, icon: Users });
  }
  if (scenarios.early_resolution_opportunity_range) {
    activeScenarios.push({ ...scenarios.early_resolution_opportunity_range, icon: Zap });
  }
  if (scenarios.likely_range_if_counsel_retained) {
    activeScenarios.push({ ...scenarios.likely_range_if_counsel_retained, icon: Briefcase });
  }
  if (scenarios.current_represented_posture_range) {
    activeScenarios.push({ ...scenarios.current_represented_posture_range, icon: TrendingUp });
  }

  if (activeScenarios.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Resolution Scenarios</h3>
          <span className="text-[9px] font-semibold bg-accent/60 text-muted-foreground px-1.5 py-0.5 rounded-md">
            {activeScenarios.length}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-3">
        {activeScenarios.map((scenario) => {
          const ScenIcon = scenario.icon;
          return (
            <div key={scenario.scenario_id} className="rounded-lg border border-border p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ScenIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[12px] font-semibold text-foreground">{scenario.label}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  scenario.probability > 60 ? 'bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]'
                  : scenario.probability > 30 ? 'bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention))]'
                  : 'bg-accent text-muted-foreground'
                }`}>
                  {scenario.probability}% likely
                </span>
              </div>

              <p className="text-[10px] text-muted-foreground">{scenario.description}</p>

              {/* Range display */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] text-muted-foreground">{fmt(scenario.range.low)}</span>
                <span className="text-[8px] text-muted-foreground/40">—</span>
                <span className="text-[14px] font-bold text-foreground">{fmt(scenario.range.mid)}</span>
                <span className="text-[8px] text-muted-foreground/40">—</span>
                <span className="text-[10px] text-muted-foreground">{fmt(scenario.range.high)}</span>
              </div>

              {/* Assumptions */}
              <div className="space-y-0.5">
                {scenario.assumptions.map((a, i) => (
                  <p key={i} className="text-[9px] text-muted-foreground flex items-start gap-1.5">
                    <span className="text-muted-foreground/40 mt-0.5">•</span>
                    {a}
                  </p>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EvalScenarioCard;
