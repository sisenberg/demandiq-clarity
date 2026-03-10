// ===================================================
// DemandIQ v1 — Role-Based Permissions System
// ===================================================

export type AppRole = "admin" | "manager" | "reviewer" | "adjuster" | "readonly";

export const ALL_ROLES: AppRole[] = ["admin", "manager", "reviewer", "adjuster", "readonly"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  reviewer: "Reviewer",
  adjuster: "Adjuster",
  readonly: "Read Only",
};

export type Permission =
  | "create_case"
  | "upload_document"
  | "trigger_processing"
  | "edit_extraction"
  | "export_package"
  | "manage_users"
  | "view_audit_log"
  | "assign_case"
  | "edit_case"
  | "view_all_cases"
  | "view_assigned_cases"
  | "view_admin";

export const ALL_PERMISSIONS: Permission[] = [
  "create_case",
  "upload_document",
  "trigger_processing",
  "edit_extraction",
  "export_package",
  "manage_users",
  "view_audit_log",
  "assign_case",
  "edit_case",
  "view_all_cases",
  "view_assigned_cases",
  "view_admin",
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  create_case: "Create Case",
  upload_document: "Upload Document",
  trigger_processing: "Trigger Processing",
  edit_extraction: "Edit Extraction",
  export_package: "Export Package",
  manage_users: "Manage Users",
  view_audit_log: "View Audit Log",
  assign_case: "Assign Case",
  edit_case: "Edit Case",
  view_all_cases: "View All Cases",
  view_assigned_cases: "View Assigned Cases",
  view_admin: "View Admin",
};

/** The matrix permissions displayed in the admin panel */
export const MATRIX_PERMISSIONS: Permission[] = [
  "create_case",
  "upload_document",
  "trigger_processing",
  "edit_extraction",
  "export_package",
  "manage_users",
  "view_audit_log",
];

export const ROLE_PERMISSIONS: Record<AppRole, Set<Permission>> = {
  admin: new Set<Permission>([
    "create_case", "upload_document", "trigger_processing", "edit_extraction",
    "export_package", "manage_users", "view_audit_log", "assign_case",
    "edit_case", "view_all_cases", "view_assigned_cases", "view_admin",
  ]),
  manager: new Set<Permission>([
    "create_case", "upload_document", "trigger_processing", "edit_extraction",
    "export_package", "view_audit_log", "assign_case", "edit_case",
    "view_all_cases", "view_assigned_cases",
  ]),
  reviewer: new Set<Permission>([
    "edit_extraction", "view_all_cases", "view_assigned_cases",
  ]),
  adjuster: new Set<Permission>([
    "create_case", "upload_document", "edit_case", "view_assigned_cases",
  ]),
  readonly: new Set<Permission>([
    "view_assigned_cases",
  ]),
};

export function hasPermission(role: AppRole | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canAccessRoute(role: AppRole | null, route: string): boolean {
  if (!role) return false;
  switch (route) {
    case "/admin":
      return hasPermission(role, "view_admin");
    case "/audit":
      return hasPermission(role, "view_audit_log");
    case "/exports":
      return hasPermission(role, "export_package");
    default:
      return true;
  }
}
