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

  const visibleItems = coreNavItems.filter((item) => canAccessRoute(role, item.path));

  const comingSoonModules = MODULES.filter((m) => m.comingSoon);

  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Platform brand */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">CasualtyIQ</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {profile?.display_name || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Active module indicator */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-accent/70">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-sidebar-foreground">DemandIQ</span>
          <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">Active</span>
        </div>
      </div>

      {/* Core navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        <p className="px-3 mb-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Platform</p>
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/"}
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
              isActive(item.path)
                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* Coming soon modules */}
        {comingSoonModules.length > 0 && (
          <>
            <p className="px-3 mt-4 mb-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">Modules</p>
            {comingSoonModules.map((mod) => {
              const Icon = MODULE_ICONS[mod.icon] ?? FileText;
              return (
                <div
                  key={mod.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/50 cursor-default"
                  title={mod.description}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{mod.label}</span>
                  <span className="ml-auto text-[9px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Soon</span>
                </div>
              );
            })}
          </>
        )}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground">CasualtyIQ v1.0 · Multi-Tenant</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
