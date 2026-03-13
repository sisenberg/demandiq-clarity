/**
 * EvaluateIQ — Case List
 * Shows all cases eligible for or actively being evaluated.
 */

import { Link } from "react-router-dom";
import { useCases } from "@/hooks/useCases";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import { Calculator, ChevronRight, ArrowLeft } from "lucide-react";

const EvaluateCaseListPage = () => {
  const { data: cases, isLoading } = useCases();

  if (isLoading) return <PageLoading message="Loading cases…" />;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
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

      {(!cases || cases.length === 0) ? (
        <EmptyState
          icon={Calculator}
          title="No Cases Available"
          description="Create a case and complete upstream modules to begin evaluation."
        />
      ) : (
        <div className="space-y-2">
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
    </div>
  );
};

export default EvaluateCaseListPage;
