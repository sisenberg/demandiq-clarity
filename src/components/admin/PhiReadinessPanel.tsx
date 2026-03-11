import { ShieldAlert, ShieldCheck, Shield, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { usePhiReadiness, useUpsertPhiReadiness, type PhiReadinessStatus, type EnvironmentDesignation } from "@/hooks/usePhiReadiness";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useAuth } from "@/contexts/AuthContext";
import { hasPermission } from "@/lib/permissions";

const STATUS_CONFIG: Record<PhiReadinessStatus, { label: string; description: string; badge: string; icon: typeof ShieldCheck }> = {
  development_test_allowed: {
    label: "Development / Test Allowed",
    description: "This environment is designated for development and controlled testing only. Not approved for production PHI.",
    badge: "bg-[hsl(var(--status-attention)/0.12)] text-[hsl(var(--status-attention-foreground))] border border-[hsl(var(--status-attention)/0.2)]",
    icon: Shield,
  },
  production_phi_blocked: {
    label: "Production PHI Blocked",
    description: "Some readiness controls are confirmed but contractual or technical prerequisites remain incomplete. Production PHI use is blocked.",
    badge: "bg-destructive/10 text-destructive border border-destructive/20",
    icon: ShieldAlert,
  },
  production_phi_ready: {
    label: "Production PHI Ready",
    description: "All readiness controls are confirmed. This environment is approved for production use with live PHI data.",
    badge: "bg-[hsl(var(--status-approved)/0.12)] text-[hsl(var(--status-approved-foreground))] border border-[hsl(var(--status-approved)/0.2)]",
    icon: ShieldCheck,
  },
};

const ENV_LABELS: Record<EnvironmentDesignation, string> = {
  development: "Development",
  staging: "Staging",
  production: "Production",
};

const PhiReadinessPanel = () => {
  const { role, user } = useAuth();
  const { data: config, isLoading } = usePhiReadiness();
  const upsert = useUpsertPhiReadiness();
  const auditLog = useAuditLog();
  const isAdmin = hasPermission(role, "manage_users");

  if (isLoading) {
    return (
      <div className="card-elevated p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-48" />
          <div className="h-3 bg-muted rounded w-96" />
        </div>
      </div>
    );
  }

  // Derive effective status from controls
  const baa = config?.baa_executed ?? false;
  const aiRetention = config?.ai_retention_terms_finalized ?? false;
  const loggingHardened = config?.logging_masking_hardened ?? false;
  const env = config?.environment_designation ?? "development";
  const currentStatus = config?.overall_status ?? "development_test_allowed";

  const allControlsMet = baa && aiRetention && loggingHardened;
  const derivedStatus: PhiReadinessStatus = 
    env === "production" && allControlsMet ? "production_phi_ready" :
    (baa || aiRetention || loggingHardened) ? "production_phi_blocked" :
    "development_test_allowed";

  const statusInfo = STATUS_CONFIG[currentStatus];
  const StatusIcon = statusInfo.icon;

  const handleToggle = async (field: string, value: boolean) => {
    if (!isAdmin) return;
    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { [field]: value };
    
    // Set confirmation timestamps
    if (field === "baa_executed") {
      updates.baa_confirmed_at = value ? now : null;
      updates.baa_confirmed_by = value ? user?.id : null;
    } else if (field === "ai_retention_terms_finalized") {
      updates.ai_retention_confirmed_at = value ? now : null;
      updates.ai_retention_confirmed_by = value ? user?.id : null;
    } else if (field === "logging_masking_hardened") {
      updates.logging_masking_confirmed_at = value ? now : null;
      updates.logging_masking_confirmed_by = value ? user?.id : null;
    }

    await upsert.mutateAsync(updates as any);

    auditLog.mutate({
      actionType: "entitlement_changed",
      entityType: "phi_readiness_config",
      entityId: config?.id ?? "new",
      beforeValue: { [field]: !value },
      afterValue: { [field]: value },
    });
  };

  const handleEnvChange = async (newEnv: EnvironmentDesignation) => {
    if (!isAdmin) return;
    const oldEnv = env;
    await upsert.mutateAsync({ environment_designation: newEnv } as any);
    auditLog.mutate({
      actionType: "entitlement_changed",
      entityType: "phi_readiness_config",
      entityId: config?.id ?? "new",
      beforeValue: { environment_designation: oldEnv },
      afterValue: { environment_designation: newEnv },
    });
  };

  const handleStatusOverride = async (newStatus: PhiReadinessStatus) => {
    if (!isAdmin) return;
    const oldStatus = currentStatus;
    await upsert.mutateAsync({
      overall_status: newStatus,
      last_status_change_at: new Date().toISOString(),
      last_status_change_by: user?.id,
    } as any);
    auditLog.mutate({
      actionType: "entitlement_changed",
      entityType: "phi_readiness_config",
      entityId: config?.id ?? "new",
      beforeValue: { overall_status: oldStatus },
      afterValue: { overall_status: newStatus },
    });
  };

  const controls = [
    {
      key: "baa_executed",
      label: "BAA Executed",
      description: "Business Associate Agreement executed with all required vendors (AI gateway, hosting, subprocessors).",
      checked: baa,
      confirmedAt: config?.baa_confirmed_at,
    },
    {
      key: "ai_retention_terms_finalized",
      label: "AI Data Handling Terms",
      description: "AI vendor retention policy confirmed (zero-retention or documented retention with acceptable terms).",
      checked: aiRetention,
      confirmedAt: config?.ai_retention_confirmed_at,
    },
    {
      key: "logging_masking_hardened",
      label: "Logging & Masking Hardened",
      description: "PHI/PII log sanitization deployed. Masking applied to list views. No raw medical text in structured logs.",
      checked: loggingHardened,
      confirmedAt: config?.logging_masking_confirmed_at,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="card-elevated overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
            currentStatus === "production_phi_ready" ? "bg-[hsl(var(--status-approved)/0.12)]" :
            currentStatus === "production_phi_blocked" ? "bg-destructive/10" :
            "bg-[hsl(var(--status-attention)/0.12)]"
          }`}>
            <StatusIcon className={`h-5 w-5 ${
              currentStatus === "production_phi_ready" ? "text-[hsl(var(--status-approved-foreground))]" :
              currentStatus === "production_phi_blocked" ? "text-destructive" :
              "text-[hsl(var(--status-attention-foreground))]"
            }`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">PHI Production Readiness</h3>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusInfo.badge}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{statusInfo.description}</p>
          </div>
        </div>

        {/* Environment Designation */}
        <div className="px-5 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Environment</span>
              <p className="text-xs text-foreground mt-0.5">{ENV_LABELS[env]}</p>
            </div>
            {isAdmin && (
              <select
                value={env}
                onChange={(e) => handleEnvChange(e.target.value as EnvironmentDesignation)}
                className="text-xs border border-input rounded-lg bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {(Object.keys(ENV_LABELS) as EnvironmentDesignation[]).map((e) => (
                  <option key={e} value={e}>{ENV_LABELS[e]}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Readiness Controls */}
        <div className="divide-y divide-border">
          {controls.map((ctrl) => (
            <div key={ctrl.key} className="px-5 py-3.5 flex items-start gap-3">
              <div className="mt-0.5">
                {ctrl.checked ? (
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-approved))]" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{ctrl.label}</span>
                  {ctrl.confirmedAt && (
                    <span className="text-[9px] text-muted-foreground">
                      confirmed {new Date(ctrl.confirmedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{ctrl.description}</p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleToggle(ctrl.key, !ctrl.checked)}
                  disabled={upsert.isPending}
                  className={`shrink-0 text-[10px] font-medium px-3 py-1.5 rounded-md border transition-all ${
                    ctrl.checked
                      ? "bg-[hsl(var(--status-approved)/0.08)] text-[hsl(var(--status-approved-foreground))] border-[hsl(var(--status-approved)/0.2)] hover:bg-[hsl(var(--status-approved)/0.15)]"
                      : "bg-accent text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {ctrl.checked ? "Confirmed ✓" : "Mark Complete"}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Overall Status Override */}
        {isAdmin && (
          <div className="px-5 py-3.5 border-t border-border bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Overall Status</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Derived: <strong className="text-foreground">{STATUS_CONFIG[derivedStatus].label}</strong>
                  {derivedStatus !== currentStatus && " — manually overridden"}
                </p>
              </div>
              <select
                value={currentStatus}
                onChange={(e) => handleStatusOverride(e.target.value as PhiReadinessStatus)}
                disabled={upsert.isPending}
                className="text-xs border border-input rounded-lg bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
              >
                <option value="development_test_allowed">Development / Test Allowed</option>
                <option value="production_phi_blocked">Production PHI Blocked</option>
                <option value="production_phi_ready">Production PHI Ready</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-border bg-accent/30">
        <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          This panel tracks internal readiness controls only. It does not constitute legal compliance certification.
          All status changes are recorded in the audit log. Contact your compliance team before changing the environment to Production.
        </p>
      </div>
    </div>
  );
};

export default PhiReadinessPanel;
