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

// ─── Billing ──────────────────────────────────────────
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
    <div className="border border-border/50 rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-foreground">Billing Summary</h3>
      </div>
      <div className="flex flex-col gap-2">
        <Row label="Total Billed" value={totalBilled > 0 ? `$${totalBilled.toLocaleString()}` : "—"} bold />
        {totalAdjusted > 0 && <Row label="Adjusted" value={`$${totalAdjusted.toLocaleString()}`} />}
        {totalPaid > 0 && <Row label="Paid" value={`$${totalPaid.toLocaleString()}`} />}
        <div className="border-t border-border/40 pt-2 mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>{billCount > 0 ? `${billCount} line items` : "—"}</span>
          <span>{providerCount} provider{providerCount !== 1 ? "s" : ""}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Documents ────────────────────────────────────────
export function DocumentsCard({ documents }: { documents: DocumentRow[] }) {
  const completeDocs = documents.filter((d) => isDocumentReady(d.document_status)).length;
  const failed = documents.filter((d) => d.document_status === "failed").length;

  return (
    <div className="border border-border/50 rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-foreground">Documents</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{documents.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        <Row label="Processed" value={`${completeDocs} / ${documents.length}`} />
        {failed > 0 && <Row label="Failed" value={`${failed}`} alert />}
      </div>
    </div>
  );
}

// ─── Review Flags ─────────────────────────────────────
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
    <div className="border border-border/50 rounded-lg bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-foreground">Review Flags</h3>
        {allFlags.length > 0 && (
          <span className="text-[10px] text-destructive font-medium ml-auto">{allFlags.length}</span>
        )}
      </div>
      {allFlags.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--status-approved))]" />
          <span className="text-[12px] text-muted-foreground">No flags identified.</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
          {allFlags.map((f, i) => {
            const { icon: FlagIcon, color } = icons[f.severity];
            return (
              <div key={i} className="flex items-start gap-2">
                <FlagIcon className={`h-3 w-3 ${color} shrink-0 mt-0.5`} />
                <span className="text-[12px] text-foreground/80 leading-relaxed">{f.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shared row helper ────────────────────────────────
function Row({ label, value, bold, alert }: { label: string; value: string; bold?: boolean; alert?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] ${bold ? "font-semibold" : "font-medium"} ${alert ? "text-destructive" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
