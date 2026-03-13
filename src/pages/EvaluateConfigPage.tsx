/**
 * EvaluateIQ — Configuration / Logic Version View
 * Displays the active engine version, calibration parameters, and audit history.
 */

import { Link } from "react-router-dom";
import EmptyState from "@/components/ui/EmptyState";
import {
  ArrowLeft,
  Settings,
  Calculator,
  Cpu,
  Shield,
  Clock,
  CheckCircle2,
} from "lucide-react";

const ENGINE_VERSION = "1.0.0";

const LOGIC_MODULES = [
  { name: "Valuation Driver Engine", version: "1.0.0", status: "active" as const },
  { name: "Settlement Range Engine", version: "1.0.0", status: "active" as const },
  { name: "Explanation Ledger Builder", version: "1.0.0", status: "active" as const },
  { name: "Intake Snapshot Builder", version: "1.0.0", status: "active" as const },
  { name: "Assumption Override Manager", version: "1.0.0", status: "active" as const },
];

const CALIBRATION_PARAMS = [
  { param: "Severity Multiplier Range", value: "1.0x – 5.0x" },
  { param: "Liability Factor Range", value: "0.0 – 1.0" },
  { param: "Treatment Reliability Floor", value: "0.70" },
  { param: "Confidence Threshold (High)", value: "≥ 75%" },
  { param: "Confidence Threshold (Moderate)", value: "≥ 50%" },
  { param: "Policy Cap Behavior", value: "Clamp at max coverage" },
  { param: "Venue Multiplier Support", value: "Jurisdiction-specific" },
  { param: "Override Limit", value: "No maximum (audit-logged)" },
];

const EvaluateConfigPage = () => {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/cases" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings className="h-4.5 w-4.5 text-primary" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">EvaluateIQ — Configuration</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">Engine versions, calibration parameters, and logic modules</p>
        </div>
      </div>

      {/* Engine Version */}
      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-semibold text-foreground">Engine Version</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[24px] font-bold text-foreground font-mono tracking-tight">{ENGINE_VERSION}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved))]">
            Active
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Corridor-based settlement range engine with evidence-linked drivers, human-override assumptions, and full explanation ledger support.
        </p>
      </section>

      {/* Logic Modules */}
      <section className="rounded-xl border border-border bg-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Calculator className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-semibold text-foreground">Logic Modules</h2>
        </div>
        <div className="space-y-2">
          {LOGIC_MODULES.map((mod) => (
            <div key={mod.name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-colors">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
                <span className="text-[11px] font-medium text-foreground">{mod.name}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">v{mod.version}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Calibration Parameters */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-[13px] font-semibold text-foreground">Calibration Parameters</h2>
        </div>
        <div className="space-y-1">
          {CALIBRATION_PARAMS.map((cp) => (
            <div key={cp.param} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-[11px] text-muted-foreground">{cp.param}</span>
              <span className="text-[11px] font-semibold text-foreground">{cp.value}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default EvaluateConfigPage;
