import { useNavigate, useParams } from "react-router-dom";
import {
  useIntakeReadiness,
  READINESS_BADGE,
  type IntakeReadinessResult,
  type AttentionItem,
} from "@/hooks/useIntakeReadiness";
import type { DocumentRow } from "@/hooks/useDocuments";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Eye,
  Users,
  Scale,
  Calendar,
  Loader2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface IntakeReadinessPanelProps {
  documents: DocumentRow[];
  caseId: string;
  onNavigate?: (section: string) => void;
}

const IntakeReadinessPanel = ({ documents, caseId, onNavigate }: IntakeReadinessPanelProps) => {
  const readiness = useIntakeReadiness(caseId, documents);
  const { state, stats, blockers, warnings, isLoading } = readiness;
  const badge = READINESS_BADGE[state];

  if (isLoading) {
    return (
      <div className="card-elevated p-5">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Computing readiness…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Intake Readiness</h3>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ml-auto ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <StatCell icon={FileText} label="Total Docs" value={stats.totalDocuments} />
          <StatCell icon={CheckCircle2} label="Processed" value={stats.processedDocuments} color="text-[hsl(var(--status-approved-foreground))]" />
          <StatCell icon={Loader2} label="Processing" value={stats.processingDocuments} spin={stats.processingDocuments > 0} color="text-[hsl(var(--status-processing-foreground))]" />
          <StatCell icon={XCircle} label="Failed" value={stats.failedDocuments} color={stats.failedDocuments > 0 ? "text-destructive" : undefined} />
          <StatCell icon={Copy} label="Duplicates" value={stats.duplicateFlags} color={stats.duplicateFlags > 0 ? "text-[hsl(var(--status-attention-foreground))]" : undefined} />
          <StatCell icon={Eye} label="Low Confidence" value={stats.lowConfidenceFlags} color={stats.lowConfidenceFlags > 0 ? "text-[hsl(var(--status-attention-foreground))]" : undefined} />
          <StatCell icon={Users} label="Providers" value={stats.detectedProviders} />
          <StatCell icon={Scale} label="Attorneys" value={stats.detectedAttorneys} />
          <StatCell icon={Calendar} label="Chronology" value={stats.chronologyCandidateCount} />
        </div>

        {/* Blockers / Attention */}
        {blockers.length > 0 && (
          <AttentionSection
            title="Blockers"
            icon={XCircle}
            iconColor="text-destructive"
            items={blockers}
            onNavigate={onNavigate}
          />
        )}

        {warnings.length > 0 && (
          <AttentionSection
            title="Needs Attention"
            icon={AlertTriangle}
            iconColor="text-[hsl(var(--status-attention-foreground))]"
            items={warnings}
            onNavigate={onNavigate}
          />
        )}

        {/* Ready for next step */}
        {blockers.length === 0 && stats.processedDocuments > 0 && (
          <div className="rounded-lg border border-[hsl(var(--status-approved))]/20 bg-[hsl(var(--status-approved-bg))] p-3">
            <div className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 text-[hsl(var(--status-approved-foreground))] mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground">
                  {state === "reviewer_prep_ready"
                    ? "Ready for ReviewerIQ Handoff"
                    : "Intake Data Available"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {state === "reviewer_prep_ready"
                    ? `${stats.processedDocuments} documents processed, ${stats.chronologyCandidateCount} chronology events, ${stats.detectedProviders} providers detected.`
                    : `${stats.processedDocuments} of ${stats.totalDocuments} documents processed. ${warnings.length > 0 ? `${warnings.length} item${warnings.length > 1 ? "s" : ""} need attention.` : "No issues detected."}`}
                </p>
                {state === "reviewer_prep_ready" && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1 italic">
                    Future: Complete Demand handoff will be available here.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────

function StatCell({
  icon: Icon,
  label,
  value,
  color,
  spin,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
  spin?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-accent/40">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color ?? "text-muted-foreground"} ${spin ? "animate-spin" : ""}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-foreground leading-tight tabular-nums">{value}</p>
        <p className="text-[8px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      </div>
    </div>
  );
}

function AttentionSection({
  title,
  icon: Icon,
  iconColor,
  items,
  onNavigate,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  items: AttentionItem[];
  onNavigate?: (section: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${iconColor}`} />
        <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">{title}</span>
        <span className="text-[9px] font-semibold bg-accent text-muted-foreground px-1.5 py-0.5 rounded-md ml-1">
          {items.length}
        </span>
      </div>
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-2 px-3 py-2 rounded-lg bg-accent/40 group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground">{item.label}</p>
              <p className="text-[10px] text-muted-foreground">{item.detail}</p>
            </div>
            {item.documentId && onNavigate && (
              <button
                onClick={() => onNavigate("documents")}
                className="text-[10px] text-primary font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5"
              >
                View <ExternalLink className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default IntakeReadinessPanel;
