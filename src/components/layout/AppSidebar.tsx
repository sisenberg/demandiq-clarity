import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  ClipboardCheck,
  Download,
  Settings,
  ScrollText,
  Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessRoute } from "@/lib/permissions";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Cases", path: "/cases", icon: Briefcase },
  { label: "Documents", path: "/documents", icon: FileText },
  { label: "Review Queue", path: "/review", icon: ClipboardCheck },
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

  const visibleItems = navItems.filter((item) => canAccessRoute(role, item.path));

  return (
    <aside className="w-[var(--sidebar-width)] h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
          <Shield className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate">DemandIQ</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {profile?.display_name || "—"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
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
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-muted-foreground">DemandIQ v1.0 · Multi-Tenant</p>
      </div>
    </aside>
  );
};

export default AppSidebar;
