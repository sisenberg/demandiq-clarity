/**
 * ReviewerIQ — Policy Overlay Admin Page
 * Admin UI for managing policy profiles, overlay rules, calibration runs,
 * QA dashboard, and simulation mode.
 */

import { useState, useMemo, useCallback } from "react";
import {
  Settings, Shield, Play, BarChart3, Layers, Plus, Eye,
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Beaker,
  ChevronDown, ChevronRight, FileText, ArrowLeftRight,
} from "lucide-react";
import type {
  PolicyProfile, OverlayRule, CalibrationRun,
  CalibrationRunResult, CalibrationResultType, OverlayScope,
} from "@/types/policy-overlay";
import {
  OVERLAY_SCOPE_LABEL, RULE_ACTION_TYPE_LABEL, CALIBRATION_RESULT_LABEL,
  OVERLAY_ENGINE_VERSION,
} from "@/types/policy-overlay";
import { SPECIALTY_LABEL, SUPPORT_LEVEL_LABEL, SPECIALTY_REVIEW_ENGINE_VERSION } from "@/types/specialty-review";
import type { SupportLevel, SpecialtyType } from "@/types/specialty-review";
import { runCalibration } from "@/lib/calibrationRunner";
import { runSimulation, type SimulationComparison } from "@/lib/policyOverlayEngine";
import { runSpecialtyReview } from "@/lib/specialtyReviewEngine";
import {
  CALIBRATION_BENCHMARKS,
  SAMPLE_POLICY_PROFILES,
  SAMPLE_OVERLAY_RULES,
} from "@/data/mock/calibrationBenchmarks";
import { MOCK_TREATMENT_RECORDS } from "@/data/mock/treatmentRecords";
import { MOCK_BILL_LINES } from "@/data/mock/reviewerBillLines";

type AdminTab = "profiles" | "rules" | "calibration" | "qa" | "simulation";

const TABS: { key: AdminTab; label: string; icon: React.ElementType }[] = [
  { key: "profiles", label: "Policy Profiles", icon: Layers },
  { key: "rules", label: "Overlay Rules", icon: Settings },
  { key: "calibration", label: "Calibration Runs", icon: Beaker },
  { key: "qa", label: "Rule Performance", icon: BarChart3 },
  { key: "simulation", label: "Simulation", icon: ArrowLeftRight },
];

const RESULT_STYLE: Record<CalibrationResultType, string> = {
  match: "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]",
  partial_match: "bg-[hsl(var(--status-review-bg))] text-[hsl(var(--status-review-foreground))]",
  false_positive: "bg-[hsl(var(--status-attention-bg))] text-[hsl(var(--status-attention-foreground))]",
  false_negative: "bg-[hsl(var(--status-failed-bg))] text-[hsl(var(--status-failed-foreground))]",
  needs_review: "bg-[hsl(var(--status-processing-bg))] text-[hsl(var(--status-processing-foreground))]",
};

export default function PolicyOverlayAdmin() {
  const [activeTab, setActiveTab] = useState<AdminTab>("profiles");
  const [profiles] = useState<PolicyProfile[]>(SAMPLE_POLICY_PROFILES);
  const [calibrationRun, setCalibrationRun] = useState<CalibrationRun | null>(null);
  const [simResults, setSimResults] = useState<SimulationComparison[]>([]);
  const [expandedProfiles, setExpandedProfiles] = useState<Set<string>>(new Set());

  const handleRunCalibration = useCallback(() => {
    const run = runCalibration(
      CALIBRATION_BENCHMARKS,
      SAMPLE_POLICY_PROFILES,
      SAMPLE_OVERLAY_RULES,
      { jurisdiction: "FL", client_id: "acme-insurance", claim_type: "WC", program: null, visit_count: 10 },
      "admin-user",
    );
    setCalibrationRun(run);
  }, []);

  const handleRunSimulation = useCallback(() => {
    const { recommendations } = runSpecialtyReview(MOCK_TREATMENT_RECORDS, MOCK_BILL_LINES);
    const context = { jurisdiction: "FL", client_id: "acme-insurance", claim_type: "WC", program: null, visit_count: 10 };
    const results = recommendations.map(rec =>
      runSimulation(rec, SAMPLE_POLICY_PROFILES, SAMPLE_OVERLAY_RULES, context)
    );
    setSimResults(results);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Policy Overlay Management</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Configure review overlays, run calibrations, and monitor rule performance.
            Engine v{SPECIALTY_REVIEW_ENGINE_VERSION} · Overlay v{OVERLAY_ENGINE_VERSION}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-accent/30 rounded-lg p-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-md transition-all ${
              activeTab === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profiles" && <ProfilesTab profiles={profiles} expandedProfiles={expandedProfiles} setExpandedProfiles={setExpandedProfiles} />}
      {activeTab === "rules" && <RulesTab profiles={profiles} />}
      {activeTab === "calibration" && <CalibrationTab run={calibrationRun} onRun={handleRunCalibration} />}
      {activeTab === "qa" && <QADashboard run={calibrationRun} />}
      {activeTab === "simulation" && <SimulationTab results={simResults} onRun={handleRunSimulation} />}
    </div>
  );
}

// ─── Profiles Tab ──────────────────────────────────────

function ProfilesTab({ profiles, expandedProfiles, setExpandedProfiles }: {
  profiles: PolicyProfile[];
  expandedProfiles: Set<string>;
  setExpandedProfiles: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const toggle = (id: string) => {
    setExpandedProfiles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">{profiles.length} profile(s) configured</p>
        <button className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="h-3 w-3" /> New Profile
        </button>
      </div>

      {profiles.map(p => (
        <div key={p.id} className="rounded-lg border border-border bg-card overflow-hidden">
          <button onClick={() => toggle(p.id)} className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-accent/40 text-left">
            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${p.is_active ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]" : "bg-muted text-muted-foreground"}`}>
              {p.is_active ? "ACTIVE" : "INACTIVE"}
            </span>
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-accent text-muted-foreground">
              {OVERLAY_SCOPE_LABEL[p.scope]}
            </span>
            <span className="text-[11px] font-medium text-foreground flex-1">{p.name}</span>
            <span className="text-[9px] text-muted-foreground">v{p.version}</span>
            <span className="text-[9px] text-muted-foreground">{p.scope_value}</span>
            {expandedProfiles.has(p.id) ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </button>

          {expandedProfiles.has(p.id) && (
            <div className="border-t border-border px-3 py-2 space-y-2">
              <p className="text-[9px] text-muted-foreground">{p.description}</p>
              <div className="grid grid-cols-3 gap-2 text-[9px]">
                <div><span className="text-muted-foreground">Effective:</span> <span className="text-foreground">{p.effective_date}</span></div>
                <div><span className="text-muted-foreground">Expires:</span> <span className="text-foreground">{p.expires_at || "Never"}</span></div>
                <div><span className="text-muted-foreground">Created by:</span> <span className="text-foreground">{p.created_by}</span></div>
              </div>
              <div className="flex gap-2">
                <button className="text-[9px] font-medium px-2 py-1 rounded bg-accent text-foreground hover:bg-accent/80">Edit Profile</button>
                <button className="text-[9px] font-medium px-2 py-1 rounded bg-accent text-foreground hover:bg-accent/80">View History</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Rules Tab ─────────────────────────────────────────

function RulesTab({ profiles }: { profiles: PolicyProfile[] }) {
  const allRules = useMemo(() => {
    const rules: (OverlayRule & { profile_name: string })[] = [];
    for (const p of profiles) {
      const pRules = SAMPLE_OVERLAY_RULES.get(p.id) || [];
      for (const r of pRules) {
        rules.push({ ...r, profile_name: p.name });
      }
    }
    return rules;
  }, [profiles]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">{allRules.length} overlay rule(s)</p>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rule</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Profile</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actions</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Priority</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {allRules.map(r => (
              <tr key={r.id} className="hover:bg-accent/30">
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{r.name}</p>
                  <p className="text-muted-foreground mt-0.5">{r.description}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.profile_name}</td>
                <td className="px-3 py-2">
                  {r.actions.map((a, i) => (
                    <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-accent text-muted-foreground mr-1 mb-0.5">
                      {RULE_ACTION_TYPE_LABEL[a.type]}
                    </span>
                  ))}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${r.is_active ? "bg-[hsl(var(--status-approved-bg))] text-[hsl(var(--status-approved-foreground))]" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Calibration Tab ───────────────────────────────────

function CalibrationTab({ run, onRun }: { run: CalibrationRun | null; onRun: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground">{CALIBRATION_BENCHMARKS.length} benchmark cases available</p>
        </div>
        <button
          onClick={onRun}
          className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Play className="h-3 w-3" /> Run Calibration
        </button>
      </div>

      {run && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <MetricCard label="Total Cases" value={run.total_cases} />
            <MetricCard label="Matches" value={run.match_count} good />
            <MetricCard label="Partial" value={run.partial_match_count} />
            <MetricCard label="False Positives" value={run.false_positive_count} bad={run.false_positive_count > 0} />
            <MetricCard label="False Negatives" value={run.false_negative_count} bad={run.false_negative_count > 0} />
          </div>

          <div className="text-[9px] text-muted-foreground">
            Engine v{run.engine_version} · Run at {new Date(run.run_at).toLocaleString()} · By {run.run_by}
          </div>

          {/* Results */}
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Case</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Specialty</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Result</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Expected</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Actual</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Mismatches</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {run.results.map(r => (
                  <tr key={r.calibration_case_id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium text-foreground">{r.calibration_case_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{SPECIALTY_LABEL[r.specialty] || r.specialty}</td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${RESULT_STYLE[r.result_type]}`}>
                        {CALIBRATION_RESULT_LABEL[r.result_type]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.expected_support_level.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-foreground">{r.actual_support_level.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {r.mismatches.length > 0 ? (
                        <span className="text-[hsl(var(--status-attention))]">{r.mismatches.length} issue(s)</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QA Dashboard ──────────────────────────────────────

function QADashboard({ run }: { run: CalibrationRun | null }) {
  const specialtyBreakdown = useMemo(() => {
    if (!run) return new Map();
    const map = new Map<string, { total: number; matches: number; fp: number; fn: number }>();
    for (const r of run.results) {
      if (!map.has(r.specialty)) map.set(r.specialty, { total: 0, matches: 0, fp: 0, fn: 0 });
      const entry = map.get(r.specialty)!;
      entry.total++;
      if (r.result_type === "match") entry.matches++;
      if (r.result_type === "false_positive") entry.fp++;
      if (r.result_type === "false_negative") entry.fn++;
    }
    return map;
  }, [run]);

  if (!run) {
    return (
      <div className="text-center py-12 text-muted-foreground text-[11px]">
        Run a calibration first to view rule performance metrics.
      </div>
    );
  }

  const matchRate = run.total_cases > 0 ? Math.round((run.match_count / run.total_cases) * 100) : 0;
  const partialRate = run.total_cases > 0 ? Math.round((run.partial_match_count / run.total_cases) * 100) : 0;



  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MetricCard label="Match Rate" value={`${matchRate}%`} good={matchRate >= 80} />
        <MetricCard label="Partial Match Rate" value={`${partialRate}%`} />
        <MetricCard label="FP by Rule" value={run.false_positive_count} bad={run.false_positive_count > 0} />
        <MetricCard label="FN by Rule" value={run.false_negative_count} bad={run.false_negative_count > 0} />
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-[10px] font-medium text-foreground mb-2">Specialty Accuracy Breakdown</p>
        <div className="space-y-1.5">
          {Array.from(specialtyBreakdown.entries()).map(([spec, data]) => (
            <div key={spec} className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-foreground w-28">{SPECIALTY_LABEL[spec as SpecialtyType] || spec}</span>
              <div className="flex-1 h-2 rounded-full bg-accent overflow-hidden">
                <div
                  className={`h-full rounded-full ${data.matches === data.total ? "bg-[hsl(var(--status-approved))]" : "bg-[hsl(var(--status-review))]"}`}
                  style={{ width: `${data.total > 0 ? (data.matches / data.total) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[9px] text-muted-foreground w-16 text-right">
                {data.matches}/{data.total}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Simulation Tab ────────────────────────────────────

function SimulationTab({ results, onRun }: { results: SimulationComparison[]; onRun: () => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Compare base engine output vs overlay-adjusted recommendations</p>
        <button
          onClick={onRun}
          className="flex items-center gap-1 text-[10px] font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <ArrowLeftRight className="h-3 w-3" /> Run Simulation
        </button>
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rec ID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Base Level</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Overlay Level</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Doc Δ</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nec Δ</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Esc Changed</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Profiles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {results.map(r => (
                <tr key={r.recommendation_id} className={`hover:bg-accent/30 ${r.deltas.support_level_changed ? "bg-[hsl(var(--status-attention-bg))]/20" : ""}`}>
                  <td className="px-3 py-2 font-mono text-foreground">{r.recommendation_id}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.base.support_level.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2 text-foreground font-medium">{r.overlay.support_level.replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">
                    <DeltaDisplay value={r.deltas.documentation_delta} />
                  </td>
                  <td className="px-3 py-2">
                    <DeltaDisplay value={r.deltas.necessity_delta} />
                  </td>
                  <td className="px-3 py-2">
                    {r.deltas.escalation_changed ? (
                      <span className="text-[hsl(var(--status-attention))]">YES</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{[...new Set(r.applied_profiles)].join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-[11px]">
          Click "Run Simulation" to compare base vs overlay-adjusted outputs.
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ─────────────────────────────────

function MetricCard({ label, value, good, bad }: { label: string; value: string | number; good?: boolean; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[9px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-[14px] font-semibold leading-tight mt-0.5 ${bad ? "text-[hsl(var(--status-failed))]" : good ? "text-[hsl(var(--status-approved))]" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function DeltaDisplay({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted-foreground">—</span>;
  const color = value > 0 ? "text-[hsl(var(--status-approved))]" : "text-[hsl(var(--status-failed))]";
  return <span className={color}>{value > 0 ? "+" : ""}{value}</span>;
}
