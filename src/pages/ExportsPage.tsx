import { useCases } from "@/hooks/useCases";
import { PageLoading } from "@/components/ui/LoadingSkeleton";
import EmptyState from "@/components/ui/EmptyState";
import ComingSoonBadge from "@/components/ui/ComingSoonBadge";
import { Download, FileText, FileDown, Package } from "lucide-react";
import { useState } from "react";

const CASE_STATUS_BADGE: Record<string, string> = {
  complete: "status-badge-approved",
  exported: "status-badge-draft",
};

const CASE_STATUS_LABEL: Record<string, string> = {
  complete: "Complete",
  exported: "Exported",
};

const ExportsPage = () => {
  const { data: cases = [], isLoading } = useCases();
  const [exporting, setExporting] = useState<string | null>(null);

  const exportable = cases.filter(
    (c) => c.case_status === "complete" || c.case_status === "exported"
  );

  const handleExport = (caseId: string, format: string) => {
    setExporting(caseId);
    console.log(`[Export] Generating ${format} for case ${caseId}`);
    setTimeout(() => setExporting(null), 2000);
  };

  if (isLoading) return <PageLoading message="Loading exports…" />;

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Exports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cases ready for export</p>
        </div>
        <ComingSoonBadge label="Batch Export" />
      </div>

      {exportable.length === 0 ? (
        <div className="card-elevated">
          <EmptyState icon={Download} title="No cases ready for export" description="Complete case processing to enable exports." />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {exportable.map((c) => (
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
                {exporting === c.id ? (
                  <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    Exporting…
                  </span>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleExport(c.id, "pdf")}
                      className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-accent transition-colors"
                    >
                      <FileText className="h-3 w-3" /> PDF
                    </button>
                    <button
                      onClick={() => handleExport(c.id, "docx")}
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
