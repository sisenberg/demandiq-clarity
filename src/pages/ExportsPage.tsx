import { mockCases, mockCasePackages } from "@/data/mock/index";
import { CaseStatus, PackageStatus } from "@/types";
import { Download, Package } from "lucide-react";

const packageStatusLabel: Record<PackageStatus, string> = {
  [PackageStatus.Draft]: "Draft",
  [PackageStatus.Approved]: "Ready",
  [PackageStatus.Exported]: "Exported",
};

const ExportsPage = () => {
  const exportable = mockCases.filter(
    (c) => c.case_status === CaseStatus.Approved || c.case_status === CaseStatus.Exported
  );

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Exports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Case packages ready for export</p>
      </div>

      {exportable.length === 0 ? (
        <div className="border border-border rounded-lg bg-card px-6 py-12 text-center">
          <Download className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No cases ready for export.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {exportable.map((c) => {
            const pkg = mockCasePackages.find((p) => p.case_id === c.id);
            return (
              <div key={c.id} className="border border-border rounded-lg bg-card px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="h-5 w-5 text-[hsl(var(--status-approved))]" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.case_number} · {c.claimant}
                      {pkg && ` · v${pkg.package_version} (schema ${pkg.schema_version})`}
                    </p>
                  </div>
                </div>
                <span className="status-badge-approved">
                  {pkg ? packageStatusLabel[pkg.package_status] : "Ready"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExportsPage;
