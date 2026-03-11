import { useMemo } from "react";
import type { DocumentRow } from "@/hooks/useDocuments";
import { INTAKE_STATUS_LABEL } from "@/types/intake";
import {
  FileText,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Clock,
} from "lucide-react";

interface IntakeSummaryPanelProps {
  documents: DocumentRow[];
  loading?: boolean;
}

const IntakeSummaryPanel = ({ documents, loading }: IntakeSummaryPanelProps) => {
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const total = documents.length;
    const totalPages = documents.reduce((s, d) => s + (d.page_count ?? 0), 0);
    const uploadedToday = documents.filter(
      (d) => new Date(d.created_at).toDateString() === today
    ).length;

    const processingStatuses = [
      "queued_for_text_extraction",
      "extracting_text",
      "queued_for_parsing",
      "parsing",
    ];
    const processing = documents.filter((d) =>
      processingStatuses.includes(d.intake_status)
    ).length;
    const failed = documents.filter((d) => d.intake_status === "failed").length;
    const needsReview = documents.filter(
      (d) => d.intake_status === "needs_review"
    ).length;
    const complete = documents.filter(
      (d) => d.intake_status === "parsed" || d.intake_status === "text_extracted"
    ).length;

    return { total, totalPages, uploadedToday, processing, failed, needsReview, complete };
  }, [documents]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="animate-pulse h-[72px] bg-accent rounded-xl" />
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Total Documents",
      value: stats.total,
      icon: FileText,
      color: "text-foreground",
      bgColor: "bg-accent",
    },
    {
      label: "Total Pages",
      value: stats.totalPages,
      icon: FileText,
      color: "text-foreground",
      bgColor: "bg-accent",
    },
    {
      label: "Uploaded Today",
      value: stats.uploadedToday,
      icon: Upload,
      color: "text-[hsl(var(--status-processing-foreground))]",
      bgColor: "bg-[hsl(var(--status-processing-bg))]",
    },
    {
      label: "Processing",
      value: stats.processing,
      icon: Loader2,
      color: "text-[hsl(var(--status-processing-foreground))]",
      bgColor: "bg-[hsl(var(--status-processing-bg))]",
      spin: stats.processing > 0,
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: AlertTriangle,
      color: stats.failed > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: stats.failed > 0 ? "bg-[hsl(var(--status-failed-bg))]" : "bg-accent",
    },
    {
      label: "Needs Review",
      value: stats.needsReview,
      icon: Clock,
      color: stats.needsReview > 0 ? "text-[hsl(var(--status-attention-foreground))]" : "text-muted-foreground",
      bgColor: stats.needsReview > 0 ? "bg-[hsl(var(--status-attention-bg))]" : "bg-accent",
    },
  ];

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="card-elevated px-3.5 py-3 flex items-center gap-3"
          >
            <div className={`h-8 w-8 rounded-lg ${item.bgColor} flex items-center justify-center shrink-0`}>
              <Icon className={`h-4 w-4 ${item.color} ${(item as any).spin ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-foreground leading-tight tabular-nums">
                {item.value}
              </p>
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider truncate">
                {item.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default IntakeSummaryPanel;
