/**
 * EvaluateIQ — Governance Compliance Summary Card
 *
 * Displays the active governance policy, logic versions,
 * forbidden-factor categories, and compliance status.
 */

import { useMemo } from "react";
import {
  FORBIDDEN_FACTOR_CATEGORIES,
  buildGovernanceSummary,
  type GovernanceSummary,
} from "@/lib/evaluateGovernanceEngine";
import { FACTOR_REGISTRY } from "@/lib/factorRegistry";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Cpu,
  Lock,
  Eye,
  ChevronDown,
  ChevronRight,
  Ban,
} from "lucide-react";
import { useState } from "react";

const LOGIC_VERSIONS = {
  scoringEngine: "1.0.0",
  benchmarkEngine: "1.0.0",
  corridorEngine: "1.0.0",
  profileWeighting: "1.0.0",
};

const EvalGovernanceCard = () => {
  const [showForbidden, setShowForbidden] = useState(false);
  const [showLogic, setShowLogic] = useState(false);

  const summary = useMemo<GovernanceSummary>(
    () => buildGovernanceSummary(FACTOR_REGISTRY, LOGIC_VERSIONS),
    [],
  );

  const isCompliant = summary.governanceStatus === "compliant";

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              isCompliant ? "bg-[hsl(var(--status-approved))]/10" : "bg-destructive/10"
            }`}>
              <Shield className={`h-4 w-4 ${isCompliant ? "text-[hsl(var(--status-approved))]" : "text-destructive"}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Governance Compliance</h3>
              <p className="text-[10px] text-muted-foreground">
                Policy v{summary.policyVersion} · Effective {summary.effectiveDate}
              </p>
            </div>
          </div>
          <ComplianceBadge status={summary.governanceStatus} />
        </div>
      </div>

      {/* Summary Grid */}
      <div className="px-5 py-3 grid grid-cols-4 gap-3 border-b border-border">
        <StatCell label="Total Factors" value={summary.totalFactors} />
        <StatCell label="Active" value={summary.activeFactors} variant="approved" />
        <StatCell label="Prohibited" value={summary.prohibitedFactors} variant="muted" />
        <StatCell label="Forbidden Rules" value={summary.forbiddenCategories} variant="attention" />
      </div>

      {/* Violations */}
      {summary.violations.length > 0 && (
        <div className="px-5 py-3 border-b border-border">
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive mb-2">
              <XCircle className="h-3.5 w-3.5" />
              {summary.violations.length} Governance Violation{summary.violations.length > 1 ? "s" : ""}
            </div>
            {summary.violations.map((v, i) => (
              <div key={i} className="text-[11px] text-destructive/80 ml-5 mb-1">
                <span className="font-semibold">{v.factor_name}</span>: {v.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forbidden Categories */}
      <div className="px-5 py-2 border-b border-border">
        <button
          onClick={() => setShowForbidden(!showForbidden)}
          className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-accent/30 rounded-md transition-colors -mx-1 px-1"
        >
          <Ban className="h-3.5 w-3.5 text-destructive/70" />
          <span className="text-[11px] font-semibold text-foreground flex-1">
            Forbidden Factor Categories ({FORBIDDEN_FACTOR_CATEGORIES.length})
          </span>
          {showForbidden ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>

        {showForbidden && (
          <div className="space-y-2 mt-2 mb-1">
            {FORBIDDEN_FACTOR_CATEGORIES.map(cat => (
              <div key={cat.id} className="rounded-lg bg-muted/30 px-3 py-2">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="h-3 w-3 text-destructive/60" />
                  <span className="text-[11px] font-semibold text-foreground">{cat.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground ml-5">{cat.description}</p>
                <div className="flex flex-wrap gap-1 ml-5 mt-1.5">
                  {cat.examples.map((ex, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-destructive/5 text-destructive/70 border border-destructive/10">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logic Versions */}
      <div className="px-5 py-2">
        <button
          onClick={() => setShowLogic(!showLogic)}
          className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-accent/30 rounded-md transition-colors -mx-1 px-1"
        >
          <Cpu className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold text-foreground flex-1">Active Logic Versions</span>
          {showLogic ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </button>

        {showLogic && (
          <div className="space-y-1.5 mt-2 mb-1">
            <LogicRow label="Factor Scoring Engine" version={summary.logicVersions.scoringEngine} />
            <LogicRow label="Benchmark Matching Engine" version={summary.logicVersions.benchmarkEngine} />
            <LogicRow label="Settlement Corridor Engine" version={summary.logicVersions.corridorEngine} />
            <LogicRow label="Profile Weighting Engine" version={summary.logicVersions.profileWeighting} />
            <LogicRow label="Governance Policy" version={summary.policyVersion} />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-border bg-muted/20 rounded-b-xl">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Eye className="h-3 w-3" />
          <span>All scoring logic is auditable. No hidden factors or undocumented suppressions.</span>
        </div>
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────

function ComplianceBadge({ status }: { status: "compliant" | "violation" }) {
  if (status === "compliant") {
    return (
      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))] border border-[hsl(var(--status-approved))]/20">
        <CheckCircle2 className="h-3 w-3" /> Compliant
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
      <AlertTriangle className="h-3 w-3" /> Violation
    </span>
  );
}

function StatCell({ label, value, variant }: { label: string; value: number; variant?: "approved" | "attention" | "muted" }) {
  const colorMap = {
    approved: "text-[hsl(var(--status-approved))]",
    attention: "text-[hsl(var(--status-attention))]",
    muted: "text-muted-foreground",
  };
  const valueColor = variant ? colorMap[variant] : "text-foreground";

  return (
    <div className="text-center">
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function LogicRow({ label, version }: { label: string; version: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/20 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-[10px] font-medium text-foreground bg-accent px-1.5 py-0.5 rounded">v{version}</span>
    </div>
  );
}

export default EvalGovernanceCard;
