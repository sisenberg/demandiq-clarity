/**
 * EvaluateIQ — Case List
 * Shows all cases eligible for or actively being evaluated.
 * Includes demo seed browser for deep UI testing.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { useCases } from "@/hooks/useCases";
import { useEvaluateDemoSeeds } from "@/hooks/useEvaluateDemoSeeds";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { PROFILE_META } from "@/lib/claimProfileClassifier";
import {
  Calculator,
  ChevronRight,
  ArrowLeft,
  FlaskConical,
  BarChart3,
  FileCheck,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Package,
} from "lucide-react";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  not_started: { label: "Not Started", className: "text-muted-foreground bg-muted" },
  in_progress: { label: "In Progress", className: "text-[hsl(var(--status-processing))] bg-[hsl(var(--status-processing-bg))]" },
  valued: { label: "Valued", className: "text-[hsl(var(--status-attention))] bg-[hsl(var(--status-attention-bg))]" },
  completed: { label: "Completed", className: "text-[hsl(var(--status-approved))] bg-[hsl(var(--status-approved-bg))]" },
  published: { label: "Published", className: "text-primary bg-primary/10" },
};

const DOC_TIER_ICON: Record<string, React.ReactNode> = {
  strong: <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]" />,
  moderate: <AlertTriangle className="h-3 w-3 text-[hsl(var(--status-attention))]" />,
  weak: <AlertTriangle className="h-3 w-3 text-destructive" />,
};

const EvaluateCaseListPage = () => {
  const { data: cases, isLoading } = useCases();
  const seeds = useEvaluateDemoSeeds();
  const [showSeeds, setShowSeeds] = useState(true);

  if (isLoading) return <PageLoading message="Loading cases…" />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/cases" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-foreground">EvaluateIQ — Cases</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Cases with active or pending valuation workflows</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/evaluate/analytics"
            className="text-[11px] text-primary hover:underline flex items-center gap-1"
          >
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </Link>
        </div>
      </div>

      {/* Live Cases */}
      {(!cases || cases.length === 0) ? (
        <EmptyState
          icon={Calculator}
          title="No Cases Available"
          description="Create a case and complete upstream modules to begin evaluation."
        />
      ) : (
        <div className="space-y-2 mb-8">
          {cases.map((c) => (
            <Link
              key={c.id}
              to={`/cases/${c.id}/evaluate`}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 hover:shadow-sm hover:border-primary/20 transition-all group"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-foreground truncate">
                  {c.title || `${c.claimant} v. ${c.insured}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {c.case_number} · {c.jurisdiction_state || "—"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {/* Demo Seed Browser */}
      <div className="rounded-xl border border-border bg-card">
        <button
          onClick={() => setShowSeeds(!showSeeds)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors rounded-t-xl"
        >
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-semibold text-foreground">Demo Seed Cases</span>
            <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded">{seeds.length} archetypes</span>
          </div>
          <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showSeeds ? "rotate-90" : ""}`} />
        </button>

        {showSeeds && (
          <div className="border-t border-border">
            <div className="px-5 py-2 bg-[hsl(var(--status-processing-bg))] border-b border-border">
              <p className="text-[10px] text-[hsl(var(--status-processing-foreground))]">
                <strong>Testing aid:</strong> These seeded cases demonstrate EvaluateIQ across 7 claim archetypes with pre-computed scoring, corridors, and documentation states.
              </p>
            </div>
            <div className="divide-y divide-border">
              {seeds.map((seed) => {
                const statusBadge = STATUS_BADGE[seed.module_status] ?? STATUS_BADGE.not_started;
                const profileMeta = PROFILE_META[seed.expected_profile];

                return (
                  <Link
                    key={seed.id}
                    to={`/cases/${seed.snapshot.case_id}/evaluate?demo=${seed.id}`}
                    className="block px-5 py-3.5 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[12px] font-semibold text-foreground truncate">{seed.label}</p>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mb-1.5">{seed.archetype}</p>

                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                          <span className="font-mono">{seed.case_number}</span>
                          <span>{seed.claimant}</span>
                          <span>{seed.jurisdiction}</span>
                        </div>

                        {/* Pre-computed outputs summary */}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {/* Profile */}
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent text-foreground">
                            Profile {seed.expected_profile}: {profileMeta?.label}
                          </span>

                          {/* Corridor */}
                          {seed.corridor.mid > 0 && (
                            <span className="text-[9px] text-muted-foreground">
                              Corridor: ${seed.corridor.floor.toLocaleString()} – ${seed.corridor.high.toLocaleString()}
                            </span>
                          )}

                          {/* Doc sufficiency */}
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            {DOC_TIER_ICON[seed.doc_sufficiency.tier]}
                            Doc: {seed.doc_sufficiency.overall_score}%
                          </span>

                          {/* Benchmark */}
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Shield className="h-2.5 w-2.5" />
                            Bench: {seed.benchmark_support.tier}
                          </span>

                          {/* Override indicator */}
                          {seed.override && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]">
                              Override: {seed.override.reason_label}
                            </span>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluateCaseListPage;
