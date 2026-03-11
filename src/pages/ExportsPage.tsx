import { useCases } from "@/hooks/useCases";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import ComingSoonBadge from "@/components/ui/ComingSoonBadge";
import { Download, FileText, FileDown, Package } from "lucide-react";
import { useState } from "react";

const CASE_STATUS_BADGE: Record<string, string> = {
  complete: "status-badge-approved",
  exported: "status-badge-approved",
};

const CASE_STATUS_LABEL: Record<string, string> = {
  complete: "Ready to Complete",
  exported: "Demand Completed",
};

const ExportsPage = () => {
  const { data: cases = [], isLoading } = useCases();
  const [downloading, setDownloading] = useState<string | null>(null);

  const completedCases = cases.filter(
    (c) => c.case_status === "complete" || c.case_status === "exported"
  );

  // COMPLIANCE: Export generation handles DERIVED WORKING ZONE data that
  // contains assembled PHI/PII (L4 restricted_phi). Generated artifacts
  // should be treated as sensitive documents. Export filenames must not
  // leak claimant names or case details beyond the case number.
  // See docs/compliance/data-classification.md.
  const handleDownload = (caseId: string, format: string) => {
    setDownloading(caseId);
    // TODO: When real export is implemented, use audit action "artifact_exported"
    // and generate filenames using case_number only (no claimant name).
    // COMPLIANCE: Do not log case ID or format in production — may correlate to PII.
    console.log(`[Download] Export requested`);
    setTimeout(() => setDownloading(null), 2000);
  };

  if (isLoading) return <PageLoading message="Loading downloads…" />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Downloads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Download completed case artifacts</p>
        </div>
        <ComingSoonBadge label="Batch Download" />
      </div>

      {completedCases.length === 0 ? (
        <div className="card-elevated">
          <EmptyState icon={Download} title="No cases ready for download" description="Complete a module workflow to generate downloadable artifacts." />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {completedCases.map((c) => (
            <div key={c.id} className="card-elevated px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.title || `${c.claimant} v. ${c.insured}`}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.case_number} · {c.claimant}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={CASE_STATUS_BADGE[c.case_status] ?? "status-badge-draft"}>
                  {CASE_STATUS_LABEL[c.case_status] ?? c.case_status}
                </span>
                {downloading === c.id ? (
                  <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Downloading…
                  </span>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleDownload(c.id, "pdf")}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                    >
                      <FileText className="h-3 w-3" /> PDF
                    </button>
                    <button
                      onClick={() => handleDownload(c.id, "docx")}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                    >
                      <FileDown className="h-3 w-3" /> DOCX
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportsPage;
