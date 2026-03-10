import { mockCases } from "@/data/mock/index";
import { CaseStatus } from "@/types";
import { CASE_STATUS_LABEL, CASE_STATUS_BADGE } from "@/lib/workflow";
import { Download } from "lucide-react";

const ExportsPage = () => {
  const exportable = mockCases.filter(
    (c) =>
      c.case_status === CaseStatus.Complete ||
      c.case_status === CaseStatus.Exported
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Exports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cases ready for export</p>
      </div>

      {exportable.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center">
          <Download className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No cases ready for export.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exportable.map((c) => (
            <div key={c.id} className="border border-border rounded-lg bg-card px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">
                  {c.case_number} · {c.claimant}
                </p>
              </div>
              <span className={CASE_STATUS_BADGE[c.case_status]}>
                {CASE_STATUS_LABEL[c.case_status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportsPage;
