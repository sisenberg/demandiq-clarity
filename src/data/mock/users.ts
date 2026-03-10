import type { User } from "@/types";
import { UserRole } from "@/types";

export const mockUsers: User[] = [
  {
    id: "user-001",
    tenant_id: "tenant-001",
    email: "sarah.burke@burkelaw.com",
    display_name: "Sarah Burke",
    role: UserRole.Admin,
    created_at: "2024-01-15T00:00:00Z",
  },
  {
    id: "user-002",
    tenant_id: "tenant-001",
    email: "james.chen@burkelaw.com",
    display_name: "James Chen",
    role: UserRole.Reviewer,
    created_at: "2024-02-01T00:00:00Z",
  },
  {
    id: "user-003",
    tenant_id: "tenant-001",
    email: "maria.santos@burkelaw.com",
    display_name: "Maria Santos",
    role: UserRole.Adjuster,
    created_at: "2024-03-01T00:00:00Z",
  },
];
