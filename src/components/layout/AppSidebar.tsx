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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessRoute } from "@/lib/permissions";
import { MODULES } from "@/lib/modules";

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
  { label: "Exports", path: "/exports", icon: Download },
];

const adminNavItems = [
  { label: "Admin", path: "/admin", icon: Settings },
  { label: "Audit Log", path: "/audit", icon: ScrollText },
];

const AppSidebar = () => {
  const location = useLocation();
  const { role, profile } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const visibleCore = coreNavItems.filter((item) => canAccessRoute(role, item.path));
  const visibleAdmin = adminNavItems.filter((item) => canAccessRoute(role, item.path));
  const comingSoonModules = MODULES.filter((m) => m.comingSoon);

  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-sidebar flex flex-col shrink-0">
      {/* Platform brand */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-sidebar-foreground tracking-tight truncate">CasualtyIQ</p>
        </div>
      </div>

      {/* Active module indicator */}
      <div className="px-3 pb-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-sidebar-accent">
          <FileText className="h-3.5 w-3.5 text-sidebar-primary shrink-0" />
          <span className="text-xs font-medium text-sidebar-accent-foreground flex-1">DemandIQ</span>
          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sidebar-primary/20 text-sidebar-primary uppercase tracking-wider">Active</span>
        </div>
      </div>

      {/* Core navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-6">
        <div>
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
            Workspace
          </p>
          <div className="flex flex-col gap-0.5">
            {visibleCore.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
                  isActive(item.path)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {isActive(item.path) && <ChevronRight className="h-3 w-3 ml-auto opacity-50" />}
              </NavLink>
            ))}
          </div>
        </div>

        {/* Admin section */}
        {visibleAdmin.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
              Administration
            </p>
            <div className="flex flex-col gap-0.5">
              {visibleAdmin.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all ${
                    isActive(item.path)
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        )}

        {/* Coming soon modules */}
        {comingSoonModules.length > 0 && (
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "hsl(var(--sidebar-muted))" }}>
              Modules
            </p>
            <div className="flex flex-col gap-0.5">
              {comingSoonModules.map((mod) => {
                const Icon = MODULE_ICONS[mod.icon] ?? FileText;
                return (
                  <div
                    key={mod.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] cursor-default"
                    style={{ color: "hsl(var(--sidebar-muted))" }}
                    title={mod.description}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{mod.label}</span>
                    <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-sidebar-accent uppercase tracking-wider" style={{ color: "hsl(var(--sidebar-muted))" }}>
                      Soon
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <span className="text-[10px] font-semibold text-sidebar-foreground">
              {(profile?.display_name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{profile?.display_name || "—"}</p>
            <p className="text-[10px] truncate" style={{ color: "hsl(var(--sidebar-muted))" }}>{profile?.email || ""}</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default AppSidebar;
