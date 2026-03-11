import { useState, useEffect } from "react";
import { Settings, Users, ShieldCheck, Check, X, Building2, Blocks, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/ui/RoleBadge";
import { MODULES } from "@/lib/modules";
import { EntitlementStatus } from "@/types";
import type { TenantModuleEntitlement } from "@/types";
import { useModuleEntitlements, useUpsertEntitlement } from "@/hooks/useModuleEntitlements";
import PhiReadinessPanel from "@/components/admin/PhiReadinessPanel";
import {
  type AppRole,
  ALL_ROLES,
  ROLE_LABELS,
  MATRIX_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_PERMISSIONS,
  hasPermission,
} from "@/lib/permissions";

interface TenantUser {
  id: string;
  email: string;
  display_name: string;
  role: AppRole;
}

const ENTITLEMENT_LABELS: Record<EntitlementStatus, string> = {
  [EntitlementStatus.Enabled]: "Enabled",
  [EntitlementStatus.Disabled]: "Disabled",
  [EntitlementStatus.Trial]: "Trial",
  [EntitlementStatus.Suspended]: "Suspended",
};

const ENTITLEMENT_BADGE: Record<EntitlementStatus, string> = {
  [EntitlementStatus.Enabled]: "bg-[hsl(var(--status-approved)/0.12)] text-[hsl(var(--status-approved-foreground))]",
  [EntitlementStatus.Disabled]: "bg-muted text-muted-foreground",
  [EntitlementStatus.Trial]: "bg-[hsl(var(--status-attention)/0.12)] text-[hsl(var(--status-attention-foreground))]",
  [EntitlementStatus.Suspended]: "bg-destructive/10 text-destructive",
};

const AdminPage = () => {
  const { role, tenantId } = useAuth();
  const [tab, setTab] = useState<"users" | "permissions" | "modules" | "compliance" | "settings">("users");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(null);

  const { data: entitlements = [], isLoading: entLoading } = useModuleEntitlements();
  const upsertEntitlement = useUpsertEntitlement();

  useEffect(() => {
    loadUsers();
    loadTenant();
  }, [tenantId]);

  const loadTenant = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("tenants")
      .select("name, slug")
      .eq("id", tenantId)
      .maybeSingle();
    if (data) setTenant(data);
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, tenant_id");

    if (!profiles) { setLoadingUsers(false); return; }

    const userIds = profiles.map((p) => p.id);
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    const roleMap = new Map<string, AppRole>();
    roles?.forEach((r) => roleMap.set(r.user_id, r.role as AppRole));

    setUsers(
      profiles.map((p) => ({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        role: roleMap.get(p.id) ?? "readonly",
      }))
    );
    setLoadingUsers(false);
  };

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    if (!hasPermission(role, "manage_users")) return;
    const { error } = await supabase.rpc("admin_update_user_role", {
      _target_user_id: userId,
      _new_role: newRole,
    });
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    }
  };

  const handleEntitlementChange = (moduleId: string, newStatus: EntitlementStatus) => {
    if (!tenantId) return;
    upsertEntitlement.mutate({
      tenantId,
      moduleId,
      status: newStatus,
      trialEndsAt: newStatus === EntitlementStatus.Trial
        ? new Date(Date.now() + 30 * 86400000).toISOString()
        : null,
    });
  };

  const getModuleStatus = (moduleId: string): EntitlementStatus => {
    const e = entitlements.find((x) => x.module_id === moduleId);
    return (e?.status as EntitlementStatus) ?? EntitlementStatus.Disabled;
  };

  const tabs = [
    { key: "users" as const, label: "Users", icon: Users },
    { key: "permissions" as const, label: "Permissions", icon: ShieldCheck },
    { key: "modules" as const, label: "Modules", icon: Blocks },
    { key: "compliance" as const, label: "Compliance", icon: ShieldAlert },
    { key: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="p-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          CasualtyIQ platform administration
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 bg-muted rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-all ${
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="card-elevated overflow-hidden">
          {tenant && (
            <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{tenant.name}</span>
              <code className="text-[10px] bg-accent px-2 py-0.5 rounded-full text-muted-foreground ml-2">
                {tenant.slug}
              </code>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingUsers ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{u.display_name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3.5">
                      {hasPermission(role, "manage_users") ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                          className="text-xs border border-input rounded-lg bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Permissions Matrix */}
      {tab === "permissions" && (
        <div className="card-elevated overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left bg-muted/30">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-muted/30 z-10">
                  Permission
                </th>
                {ALL_ROLES.map((r) => (
                  <th key={r} className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MATRIX_PERMISSIONS.map((perm) => (
                <tr key={perm} className="hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3 font-medium text-foreground sticky left-0 bg-card whitespace-nowrap">
                    {PERMISSION_LABELS[perm]}
                  </td>
                  {ALL_ROLES.map((r) => {
                    const allowed = ROLE_PERMISSIONS[r].has(perm);
                    return (
                      <td key={r} className="px-5 py-3 text-center">
                        {allowed ? (
                          <Check className="h-4 w-4 text-[hsl(var(--status-approved))] mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/20 mx-auto" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modules Tab */}
      {tab === "modules" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Manage which CasualtyIQ modules are active for your organization. DemandIQ is included as the base module.
          </p>
          <div className="card-elevated overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left bg-muted/30">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Module</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entLoading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Loading modules…
                    </td>
                  </tr>
                ) : (
                  MODULES.map((mod) => {
                    const status = getModuleStatus(mod.id);
                    const isBase = mod.isBase;
                    return (
                      <tr key={mod.id} className="hover:bg-accent/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{mod.label}</span>
                            {isBase && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                Base
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground text-xs max-w-xs">
                          {mod.description}
                        </td>
                        <td className="px-5 py-3.5">
                          {isBase ? (
                            <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${ENTITLEMENT_BADGE[EntitlementStatus.Enabled]}`}>
                              {ENTITLEMENT_LABELS[EntitlementStatus.Enabled]}
                            </span>
                          ) : hasPermission(role, "manage_users") ? (
                            <select
                              value={status}
                              onChange={(e) => handleEntitlementChange(mod.id, e.target.value as EntitlementStatus)}
                              className="text-xs border border-input rounded-lg bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/40"
                            >
                              {Object.values(EntitlementStatus).map((s) => (
                                <option key={s} value={s}>{ENTITLEMENT_LABELS[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${ENTITLEMENT_BADGE[status]}`}>
                              {ENTITLEMENT_LABELS[status]}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compliance Tab */}
      {tab === "compliance" && (
        <PhiReadinessPanel />
      )}

      {/* Settings */}
      {tab === "settings" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Tenant Settings", description: "Organization name, slug, and configuration", icon: Building2 },
            { label: "System Settings", description: "Extraction defaults, export formats, integrations", icon: Settings },
          ].map((section) => (
            <div key={section.label} className="card-elevated-hover px-5 py-5 cursor-pointer">
              <div className="flex items-start gap-3.5">
                <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                  <section.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{section.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
