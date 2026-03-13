/**
 * EvaluateIQ — Analytics & Reporting
 *
 * Anti-rigidity design: emphasizes documentation quality, override rationale,
 * and completeness — NOT "within range" as a standalone KPI.
 */

import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock, FileCheck, Shield, AlertTriangle, TrendingUp, Package } from "lucide-react";
import EvalAnalyticsCycleTime from "@/components/evaluate/analytics/EvalAnalyticsCycleTime";
import EvalAnalyticsCompletionRate from "@/components/evaluate/analytics/EvalAnalyticsCompletionRate";
import EvalAnalyticsDocSufficiency from "@/components/evaluate/analytics/EvalAnalyticsDocSufficiency";
import EvalAnalyticsOverrideFrequency from "@/components/evaluate/analytics/EvalAnalyticsOverrideFrequency";
import EvalAnalyticsOverrideReasons from "@/components/evaluate/analytics/EvalAnalyticsOverrideReasons";
import EvalAnalyticsBenchmarkQuality from "@/components/evaluate/analytics/EvalAnalyticsBenchmarkQuality";
import EvalAnalyticsPublishVolume from "@/components/evaluate/analytics/EvalAnalyticsPublishVolume";
import EvalAnalyticsAuditLog from "@/components/evaluate/analytics/EvalAnalyticsAuditLog";
import RepresentationSummaryCard from "@/components/evaluate/analytics/RepresentationSummaryCard";
import RepresentationTransitionCard from "@/components/evaluate/analytics/RepresentationTransitionCard";
import SeverityBandedComparisonCard from "@/components/evaluate/analytics/SeverityBandedComparisonCard";

const EvaluateAnalyticsPage = () => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 bg-card border-b border-border">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/evaluate" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-foreground">EvaluateIQ Analytics</h1>
              <p className="text-[10px] text-muted-foreground">
                Operational visibility · Documentation quality · Override accountability
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
              Mock Data
            </span>
          </div>
        </div>
      </div>

      {/* Anti-rigidity notice */}
      <div className="px-6 py-2 bg-[hsl(var(--status-attention-bg))] border-b border-[hsl(var(--status-attention))]/15">
        <div className="flex items-start gap-2 text-[11px] text-[hsl(var(--status-attention-foreground))]">
          <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>Anti-rigidity safeguard:</strong> These analytics emphasize documentation completeness and override rationale quality.
            "Within recommended range" is shown only as secondary context — never as a standalone adjuster quality KPI.
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto space-y-6">
          {/* Top-level KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <EvalAnalyticsCycleTime />
            <EvalAnalyticsCompletionRate />
            <EvalAnalyticsDocSufficiency />
            <EvalAnalyticsPublishVolume />
          </div>

          {/* Override analytics */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <EvalAnalyticsOverrideFrequency />
            <EvalAnalyticsOverrideReasons />
          </div>

          {/* Benchmark quality */}
          <EvalAnalyticsBenchmarkQuality />

          {/* ─── Representation Analytics ────────────────── */}
          <div className="pt-2">
            <h2 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-primary" />
              Representation Analytics
            </h2>
          </div>

          {/* Summary + Transitions */}
          <RepresentationSummaryCard />
          <div className="grid grid-cols-1 xl:grid-cols-1 gap-4">
            <RepresentationTransitionCard />
          </div>

          {/* Severity-banded comparison */}
          <SeverityBandedComparisonCard />

          {/* Audit / QA review log */}
          <EvalAnalyticsAuditLog />
        </div>
      </div>
    </div>
  );
};

export default EvaluateAnalyticsPage;
