import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Search, Bell } from "lucide-react";
import RoleBadge from "@/components/ui/RoleBadge";

const AppTopHeader = () => {
  const { profile, role, signOut } = useAuth();

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="search-input w-64">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input type="text" placeholder="Search cases, documents…" />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <RoleBadge role={role} />
        <div className="h-4 w-px bg-border mx-1" />
        <button className="btn-ghost p-2" title="Notifications">
          <Bell className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={signOut}
          className="btn-ghost"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default AppTopHeader;
