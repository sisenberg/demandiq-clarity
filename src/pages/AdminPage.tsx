import { useState, useEffect } from "react";
import { Settings, Users, ShieldCheck, Check, X, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/ui/RoleBadge";
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

const AdminPage = () => {
  const { role, tenantId } = useAuth();
  const [tab, setTab] = useState<"users" | "permissions" | "settings">("users");
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [tenant, setTenant] = useState<{ name: string; slug: string } | null>(null);

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
    // Fetch profiles in same tenant
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, tenant_id");

    if (!profiles) { setLoadingUsers(false); return; }

    // Fetch roles
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

  const tabs = [
    { key: "users" as const, label: "Users", icon: Users },
    { key: "permissions" as const, label: "Permissions Matrix", icon: ShieldCheck },
    { key: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tenant administration and system settings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {tab === "users" && (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          {tenant && (
            <div className="px-4 py-3 border-b border-border bg-muted/50 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{tenant.name}</span>
              <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground ml-2">
                {tenant.slug}
              </code>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loadingUsers ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-accent/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{u.display_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      {hasPermission(role, "manage_users") ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as AppRole)}
                          className="text-xs border border-input rounded-md bg-background text-foreground px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
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

      {/* Permissions Matrix Tab */}
      {tab === "permissions" && (
        <div className="border border-border rounded-lg bg-card overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider sticky left-0 bg-card z-10">
                  Permission
                </th>
                {ALL_ROLES.map((r) => (
                  <th key={r} className="px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider text-center whitespace-nowrap">
                    {ROLE_LABELS[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {MATRIX_PERMISSIONS.map((perm) => (
                <tr key={perm} className="hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card whitespace-nowrap">
                    {PERMISSION_LABELS[perm]}
                  </td>
                  {ALL_ROLES.map((r) => {
                    const allowed = ROLE_PERMISSIONS[r].has(perm);
                    return (
                      <td key={r} className="px-4 py-2.5 text-center">
                        {allowed ? (
                          <Check className="h-4 w-4 text-[hsl(var(--status-approved))] mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
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

      {/* Settings Tab */}
      {tab === "settings" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: "Tenant Settings", description: "Organization name, slug, and configuration", icon: Building2 },
            { label: "System Settings", description: "Extraction defaults, export formats, integrations", icon: Settings },
          ].map((section) => (
            <div
              key={section.label}
              className="border border-border rounded-lg bg-card px-4 py-4 hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <section.icon className="h-5 w-5 text-primary mt-0.5 shrink-0" />
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
