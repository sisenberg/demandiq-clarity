import type { CasePackage } from "@/types";
import { PackageStatus } from "@/types";

export const mockCasePackages: CasePackage[] = [
  {
    id: "pkg-001",
    tenant_id: "tenant-001",
    case_id: "case-004",
    package_version: 1,
    schema_version: "1.0",
    package_status: PackageStatus.Approved,
    approved_at: "2024-10-01T15:00:00Z",
    exported_at: null,
    created_at: "2024-10-01T14:00:00Z",
  },
];
