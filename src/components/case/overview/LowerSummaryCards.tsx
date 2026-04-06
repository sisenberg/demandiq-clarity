import {
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import type { DocumentRow } from "@/hooks/useDocuments";
import { isDocumentReady } from "@/lib/statuses";

export function BillingSummaryCard({
  totalBilled,
  totalAdjusted,
  totalPaid,
  billCount,
  providerCount,
}: {
  totalBilled: number;
  totalAdjusted: number;
  totalPaid: number;
  billCount: number;
  providerCount: number;
}) {
  return (
    <div className="border border-border/40 rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <DollarSign className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Billing</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Row label="Total Billed" value={totalBilled > 0 ? `$${totalBilled.toLocaleString()}` : "—"} bold />
        {totalAdjusted > 0 && <Row label="Adjusted" value={`$${totalAdjusted.toLocaleString()}`} />}
        {totalPaid > 0 && <Row label="Paid" value={`$${totalPaid.toLocaleString()}`} />}
        <div className="border-t border-border/20 pt-1.5 mt-0.5 flex justify-between text-[9px] text-muted-foreground/60">
          <span>{billCount > 0 ? `${billCount} items` : "—"}</span>
          <span>{providerCount} provider{providerCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

export function DocumentsCard({ documents }: { documents: DocumentRow[] }) {
  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;
  const failed = documents.filter((d) => d.document_status === "failed").length;

  return (
    <div className="border border-border/40 rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <FileText className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Documents</span>
        <span className="text-[9px] text-muted-foreground/50 ml-auto">{documents.length}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Row label="Processed" value={`${completeDocs} / ${documents.length}`} />
        {failed > 0 && <Row label="Failed" value={`${failed}`} alert />}
      </div>
    </div>
  );
}

export function ReviewFlagsCard({
  validation,
  issueFlags,
  hasData,
}: {
  validation: any;
  issueFlags: any[];
  hasData: boolean;
}) {
  const allFlags: { label: string; severity: "blocker" | "warning" | "flag" }[] = [];

  (validation.blockers ?? []).forEach((b: any) => {
    allFlags.push({ label: typeof b === "string" ? b : b.message, severity: "blocker" });
  });
  (validation.warnings ?? []).forEach((w: any) => {
    allFlags.push({ label: typeof w === "string" ? w : w.message, severity: "warning" });
  });
  if (hasData) {
    issueFlags.forEach((f: any) => {
      allFlags.push({
        label: `${f.flag_type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${f.description}`,
        severity: "flag",
      });
    });
  }

  const icons: Record<string, { icon: React.ElementType; color: string }> = {
    blocker: { icon: XCircle, color: "text-destructive" },
    warning: { icon: AlertTriangle, color: "text-[hsl(var(--status-attention))]" },
    flag: { icon: Info, color: "text-primary" },
  };

  return (
    <div className="border border-border/40 rounded-lg p-3.5">
      <div className="flex items-center gap-1.5 mb-2.5">
        <AlertTriangle className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Review Flags</span>
        {allFlags.length > 0 && (
          <span className="text-[9px] text-destructive/70 font-medium ml-auto">{allFlags.length}</span>
        )}
      </div>
      {allFlags.length === 0 ? (
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3 w-3 text-[hsl(var(--status-approved))]/60" />
          <span className="text-[11px] text-muted-foreground/60">No flags.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 max-h-[140px] overflow-y-auto">
          {allFlags.map((f, i) => {
            const { icon: FlagIcon, color } = icons[f.severity];
            return (
              <div key={i} className="flex items-start gap-1.5">
                <FlagIcon className={`h-2.5 w-2.5 ${color} shrink-0 mt-[3px]`} />
                <span className="text-[11px] text-foreground/70 leading-snug">{f.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold, alert }: { label: string; value: string; bold?: boolean; alert?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
      <span className={`text-[11px] ${bold ? "font-semibold" : "font-medium"} ${alert ? "text-destructive" : "text-foreground/80"}`}>
        {value}
      </span>
    </div>
  );
}
