import { ShieldAlert } from "lucide-react";
import { usePhiReadiness } from "@/hooks/usePhiReadiness";

/**
 * Environment warning banner shown when the workspace is NOT cleared
 * for production PHI use. Renders at the top of the main layout.
 *
 * Does not block any workflows — informational only.
 */
const PhiEnvironmentBanner = () => {
  const { data: config, isLoading } = usePhiReadiness();

  // Don't show while loading or if production-ready
  if (isLoading) return null;
  if (config?.overall_status === "production_phi_ready") return null;

  const isBlocked = config?.overall_status === "production_phi_blocked";
  const env = config?.environment_designation ?? "development";

  return (
    <div className={`shrink-0 px-4 py-2 flex items-center gap-2.5 text-[11px] font-medium border-b ${
      isBlocked
        ? "bg-destructive/5 border-destructive/10 text-destructive"
        : "bg-[hsl(var(--status-attention)/0.06)] border-[hsl(var(--status-attention)/0.12)] text-[hsl(var(--status-attention-foreground))]"
    }`}>
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
      <span>
        {isBlocked ? (
          <>
            <strong>Production PHI Blocked</strong> — Contractual controls pending. ReviewerIQ may be used for development and controlled testing only.
          </>
        ) : (
          <>
            <strong>{env === "staging" ? "Staging" : "Development"} Environment</strong> — Not approved for production PHI. ReviewerIQ may be used for development and controlled testing. Production use with live PHI is blocked pending contractual controls.
          </>
        )}
      </span>
    </div>
  );
};

export default PhiEnvironmentBanner;
