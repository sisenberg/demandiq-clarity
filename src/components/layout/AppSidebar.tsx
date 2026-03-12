import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Briefcase,
  Upload,
  Settings,
  ScrollText,
  Stethoscope,
  Calculator,
  Handshake,
  Scale,
  FileText,
  Zap,
  Lock,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Database,
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

const primaryNavItems = [
  { label: "Cases", path: "/cases", icon: Briefcase },
  { label: "New Case Upload", path: "/cases/new", icon: Upload },
];

const adminNavItems = [
  { label: "Admin", path: "/admin", icon: Settings },
  { label: "Calibration", path: "/admin/calibration", icon: Database },
  { label: "Audit Log", path: "/audit", icon: ScrollText },
];

const AppSidebar = () => {
  const location = useLocation();
  const { role, profile, entitlements } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (path: string) => {
    if (path === "/cases/new") return location.pathname === "/cases/new";
    if (path === "/cases") return location.pathname === "/cases" || (location.pathname.startsWith("/cases/") && location.pathname !== "/cases/new");
    return location.pathname.startsWith(path);
  };

  const visibleAdmin = adminNavItems.filter((item) => canAccessRoute(role, item.path));
  const addOnModules = MODULES.filter((m) => !m.isBase);

  return (
    <aside
      className={`h-screen bg-sidebar flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]"
      }`}
    >
      {/* ─── Brand ─────────────────────────────── */}
      <div className={`flex items-center shrink-0 h-14 border-b border-sidebar-border ${collapsed ? "px-4 justify-center" : "px-5"}`}>
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/70 flex items-center justify-center shrink-0 shadow-sm">
          <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-[13px] font-bold text-sidebar-foreground tracking-tight truncate leading-none">CasualtyIQ</p>
            <p className="text-[10px] text-sidebar-muted mt-0.5 truncate">Claims Intelligence</p>
          </div>
        )}
      </div>

      {/* ─── Active module chip ────────────────── */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sidebar-accent/80 border border-sidebar-border">
            <div className="h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse" />
            <span className="text-[11px] font-medium text-sidebar-accent-foreground flex-1">DemandIQ</span>
            <span className="text-[9px] font-bold px-1.5 py-px rounded bg-sidebar-primary/20 text-sidebar-primary uppercase tracking-wider">
              Active
            </span>
          </div>
        </div>
      )}

      {/* ─── Navigation ────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-3 flex flex-col gap-5">
        {/* Primary */}
        <div>
          {!collapsed && <p className="section-label px-3 mb-2 text-sidebar-muted">Workspace</p>}
          <div className="flex flex-col gap-px">
            {primaryNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/cases/new"}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 rounded-lg text-[13px] transition-all duration-100 ${
                  collapsed ? "justify-center px-2 py-2.5" : "px-3 py-[7px]"
                } ${
                  isActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-[15px] w-[15px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Admin / Settings */}
        {visibleAdmin.length > 0 && (
          <div>
            {!collapsed && <p className="section-label px-3 mb-2 text-sidebar-muted">Settings</p>}
            <div className="flex flex-col gap-px">
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 rounded-lg text-[13px] transition-all duration-100 ${
                    collapsed ? "justify-center px-2 py-2.5" : "px-3 py-[7px]"
                  } ${
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-[15px] w-[15px] shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* Add-on modules */}
        {addOnModules.length > 0 && (
          <div>
            {!collapsed && <p className="section-label px-3 mb-2 text-sidebar-muted">Modules</p>}
            <div className="flex flex-col gap-px">
              {addOnModules.map((mod) => {
                const Icon = MODULE_ICONS[mod.icon] ?? FileText;
                const status = getEntitlementStatus(entitlements, mod.id);
                const active = status === EntitlementStatus.Enabled || status === EntitlementStatus.Trial;
                const badgeLabel =
                  status === EntitlementStatus.Trial ? "Trial"
                  : status === EntitlementStatus.Suspended ? "Off"
                  : active ? "On" : "—";
                return (
                  <div
                    key={mod.id}
                    className={`flex items-center gap-2.5 rounded-lg text-[13px] cursor-default transition-all ${
                      collapsed ? "justify-center px-2 py-2.5" : "px-3 py-[7px]"
                    } ${active ? "text-sidebar-foreground/65" : "text-sidebar-muted/60"}`}
                    title={collapsed ? `${mod.label} — ${badgeLabel}` : mod.description}
                  >
                    <Icon className="h-[15px] w-[15px] shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="truncate flex-1">{mod.label}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-px rounded uppercase tracking-wider ${
                            active
                              ? "bg-sidebar-primary/15 text-sidebar-primary"
                              : "bg-sidebar-accent text-sidebar-muted"
                          }`}
                        >
                          {!active && <Lock className="h-2 w-2 inline mr-0.5 -mt-px" />}
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

      {/* ─── Footer ────────────────────────────── */}
      <div className="border-t border-sidebar-border">
        {/* Help link */}
        {!collapsed && (
          <div className="px-3 pt-3">
            <button className="flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-all duration-100 w-full">
              <HelpCircle className="h-[15px] w-[15px] shrink-0" />
              <span className="truncate">Help & Support</span>
            </button>
          </div>
        )}

        {/* User */}
        <div className={`flex items-center gap-2.5 py-3 ${collapsed ? "px-4 justify-center" : "px-5"}`}>
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 text-[10px] font-bold text-sidebar-foreground ring-1 ring-sidebar-border">
            {(profile?.display_name || "?").charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-none">{profile?.display_name || "—"}</p>
              <p className="text-[10px] text-sidebar-muted truncate mt-0.5">{profile?.email || ""}</p>
            </div>
          )}
        </div>

        {/* Collapse */}
        <div className="px-3 pb-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`flex items-center gap-2 rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all duration-100 w-full ${
              collapsed ? "justify-center px-2 py-2" : "px-3 py-1.5"
            }`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            {!collapsed && <span className="text-[11px]">Collapse</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
