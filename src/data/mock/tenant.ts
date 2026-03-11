import type { Tenant } from "@/types";
import { ModuleId } from "@/types";

export const mockTenant: Tenant = {
  id: "tenant-001",
  name: "Burke & Associates",
  slug: "burke-associates",
  enabled_modules: [ModuleId.DemandIQ],
  created_at: "2024-01-15T00:00:00Z",
};
