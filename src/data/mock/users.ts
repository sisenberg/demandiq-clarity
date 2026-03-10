import type { User } from "@/types";
import { UserRole } from "@/types";

export const mockUsers: User[] = [
  {
    id: "user-001",
    tenantId: "tenant-001",
    email: "sarah.burke@burkelaw.com",
    displayName: "Sarah Burke",
    role: UserRole.Admin,
    createdAt: "2024-01-15T00:00:00Z",
  },
  {
    id: "user-002",
    tenantId: "tenant-001",
    email: "james.chen@burkelaw.com",
    displayName: "James Chen",
    role: UserRole.Reviewer,
    createdAt: "2024-02-01T00:00:00Z",
  },
  {
    id: "user-003",
    tenantId: "tenant-001",
    email: "maria.santos@burkelaw.com",
    displayName: "Maria Santos",
    role: UserRole.Analyst,
    createdAt: "2024-03-01T00:00:00Z",
  },
];
