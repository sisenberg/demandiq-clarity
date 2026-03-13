import { useState } from "react";
import { Shield, ChevronDown, ChevronRight, Eye, Cpu } from "lucide-react";

type AuditRow = {
  id: string;
  timestamp: string;
  actor: string;
  caseNumber: string;
  action: string;
  logicVersion: string;
  detail: string;
};

const MOCK_AUDIT: AuditRow[] = [
  { id: "1", timestamp: "2026-03-12 14:22", actor: "J. Rivera", caseNumber: "CF-2026-00081", action: "corridor_override", logicVersion: "1.0.0", detail: "Override: Medical Evidence Update — corridor raised 12% above system recommendation" },
  { id: "2", timestamp: "2026-03-12 11:05", actor: "S. Chen", caseNumber: "CF-2026-00079", action: "package_published", logicVersion: "1.0.0", detail: "Published EvaluatePackage v1 — accepted system corridor" },
  { id: "3", timestamp: "2026-03-11 16:40", actor: "M. Okonkwo", caseNumber: "CF-2026-00077", action: "supervisor_review_triggered", logicVersion: "1.0.0", detail: "Override flagged for supervisory review — deviation exceeds 25% threshold" },
  { id: "4", timestamp: "2026-03-11 09:15", actor: "J. Rivera", caseNumber: "CF-2026-00075", action: "corridor_override", logicVersion: "1.0.0", detail: "Override: Documentation Gap — corridor lowered 8% pending missing IME" },
  { id: "5", timestamp: "2026-03-10 15:32", actor: "A. Patel", caseNumber: "CF-2026-00073", action: "package_published", logicVersion: "1.0.0", detail: "Published EvaluatePackage v2 — superseded v1 after medical update" },
  { id: "6", timestamp: "2026-03-10 10:00", actor: "S. Chen", caseNumber: "CF-2026-00071", action: "package_published", logicVersion: "1.0.0", detail: "Published EvaluatePackage v1 — override: Comparative Fault Revision" },
];

const ACTION_BADGE: Record<string, { label: string; className: string }> = {
  corridor_override: { label: "Override", className: "bg-[hsl(var(--status-attention))]/10 text-[hsl(var(--status-attention-foreground))] border-[hsl(var(--status-attention))]/20" },
  package_published: { label: "Published", className: "bg-[hsl(var(--status-approved))]/10 text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved))]/20" },
  supervisor_review_triggered: { label: "Review Flagged", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const EvalAnalyticsAuditLog = () => {
  const [showVersions, setShowVersions] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-primary" /> Audit & QA Review Log
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Override history, publication events, and logic version tracking
          </p>
        </div>
        <button
          onClick={() => setShowVersions(!showVersions)}
          className="text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          <Cpu className="h-3 w-3" />
          {showVersions ? "Hide" : "Show"} Logic Versions
        </button>
      </div>

      {showVersions && (
        <div className="px-5 py-3 border-b border-border bg-muted/20 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Scoring Engine", version: "1.0.0" },
            { label: "Corridor Engine", version: "1.0.0" },
            { label: "Benchmark Engine", version: "1.0.0" },
            { label: "Governance Policy", version: "1.0.0" },
          ].map(lv => (
            <div key={lv.label} className="text-center">
              <p className="font-mono text-[11px] font-medium text-foreground bg-accent px-2 py-1 rounded">v{lv.version}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{lv.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Timestamp</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Actor</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Case</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Action</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Engine</th>
              <th className="text-left px-4 py-2 font-semibold text-muted-foreground">Detail</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_AUDIT.map(row => {
              const badge = ACTION_BADGE[row.action] ?? { label: row.action, className: "bg-muted text-muted-foreground border-border" };
              return (
                <tr key={row.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{row.timestamp}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{row.actor}</td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{row.caseNumber}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">v{row.logicVersion}</td>
                  <td className="px-4 py-2.5 text-muted-foreground max-w-xs truncate">{row.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-2.5 border-t border-border bg-muted/20 rounded-b-xl">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>All override and publish events are immutable and audit-logged with logic version metadata.</span>
        </div>
      </div>
    </div>
  );
};

export default EvalAnalyticsAuditLog;
