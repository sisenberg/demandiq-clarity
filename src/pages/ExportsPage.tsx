import { useCases } from "@/hooks/useCases";
import { Download } from "lucide-react";

const CASE_STATUS_BADGE: Record<string, string> = {
  complete: "status-badge-approved",
  exported: "status-badge-draft",
};

const CASE_STATUS_LABEL: Record<string, string> = {
  complete: "Complete",
  exported: "Exported",
};

const ExportsPage = () => {
  const { data: cases = [] } = useCases();

  const exportable = cases.filter(
    (c) => c.case_status === "complete" || c.case_status === "exported"
  );

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Exports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cases ready for export</p>
      </div>

      {exportable.length === 0 ? (
        <div className="card-elevated px-6 py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-accent mx-auto flex items-center justify-center mb-3">
            <Download className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No cases ready for export.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exportable.map((c) => (
            <div key={c.id} className="card-elevated-hover px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{c.title || `${c.claimant} v. ${c.insured}`}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.case_number} · {c.claimant}
                </p>
              </div>
              <span className={CASE_STATUS_BADGE[c.case_status] ?? "status-badge-draft"}>
                {CASE_STATUS_LABEL[c.case_status] ?? c.case_status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportsPage;
