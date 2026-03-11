import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Download,
  Settings,
  ScrollText,
  Stethoscope,
  Calculator,
  Handshake,
  Scale,
  Zap,
  ChevronRight,
  ChevronLeft,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessRoute } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";
import { EntitlementStatus } from "@/types";
import { getEntitlementStatus } from "@/hooks/useModuleEntitlements";

const MODULE_ICONS: Record<string, React.ElementType> = {
  Stethoscope,
  Calculator,
  Handshake,
  Scale,
  FileText,
};

const coreNavItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Cases", path: "/cases", icon: Briefcase },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Downloads", path: "/exports", icon: Download },
];

const adminNavItems = [
  { label: "Admin", path: "/admin", icon: Settings },
  { label: "Audit Log", path: "/audit", icon: ScrollText },
];

const AppSidebar = () => {
  const location = useLocation();
  const { role, profile, tenantModules, entitlements } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const visibleCore = coreNavItems.filter((item) => canAccessRoute(role, item.path));
  const visibleAdmin = adminNavItems.filter((item) => canAccessRoute(role, item.path));
  const addOnModules = MODULES.filter((m) => !m.isBase);

  return (
    <aside className={`h-screen bg-sidebar flex flex-col shrink-0 transition-all duration-200 ${collapsed ? "w-16" : "w-[var(--sidebar-width)]"}`}>
      {/* Platform brand */}
      <div className={`flex items-center gap-3 shrink-0 ${collapsed ? "px-3 py-5 justify-center" : "px-5 py-5"}`}>
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-sidebar-foreground tracking-tight truncate">CasualtyIQ</p>
          </div>
        )}
      </div>

      {/* Active module indicator */}
      {!collapsed && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-accent">
            <FileText className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
            <span className="text-xs font-medium text-sidebar-accent-foreground flex-1">DemandIQ</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary uppercase tracking-wider">Active</span>
          </div>
        </div>
      )}

      {/* Core navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        <div>
          {!collapsed && (
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
              Workspace
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {visibleCore.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg text-[13px] transition-all ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                } ${
                  isActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && isActive(item.path) && <ChevronRight className="h-3 w-3 ml-auto opacity-50" />}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
                Administration
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-3 rounded-lg text-[13px] transition-all ${
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"
                  } ${
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* Add-on modules */}
        {addOnModules.length > 0 && (
          <div>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
                Add-on Modules
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {addOnModules.map((mod) => {
                const Icon = MODULE_ICONS[mod.icon] ?? FileText;
                const status = getEntitlementStatus(entitlements, mod.id);
                const isActive = status === EntitlementStatus.Enabled || status === EntitlementStatus.Trial;
                const badgeLabel = status === EntitlementStatus.Trial ? "Trial"
                  : status === EntitlementStatus.Suspended ? "Suspended"
                  : isActive ? "Active" : "Add-on";
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center gap-3 rounded-lg text-[13px] cursor-default ${
                      isActive ? "" : "opacity-50"
                    } ${collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2"}`}
                    style={{ color: isActive ? undefined : "hsl(var(--sidebar-muted))" }}
                    title={collapsed ? `${mod.label} — ${badgeLabel}` : mod.description}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && (
                      <>
                        <span className={isActive ? "text-sidebar-foreground" : ""}>{mod.label}</span>
                        <span className={`ml-auto inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                          isActive
                            ? "bg-sidebar-primary/20 text-sidebar-primary"
                            : "bg-sidebar-accent"
                        }`} style={isActive ? undefined : { color: "hsl(var(--sidebar-muted))" }}>
                          {!isActive && <Lock className="h-2.5 w-2.5" />}
                          {badgeLabel}
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`flex items-center gap-2 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full ${
            collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
          }`}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>

      {/* Footer */}
      <div className={`py-4 border-t border-sidebar-border ${collapsed ? "px-3" : "px-5"}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-sidebar-foreground">
              {(profile?.display_name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.display_name || "—"}</p>
              <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-muted))" }}>{profile?.email || ""}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
