import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Search } from "lucide-react";
import RoleBadge from "@/components/ui/RoleBadge";

const AppTopHeader = () => {
  const { profile, role, signOut } = useAuth();

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
      {/* Search */}
      <div className="flex items-center gap-2 text-muted-foreground bg-background rounded-lg border border-border px-3 py-1.5 w-72">
        <Search className="h-3.5 w-3.5 shrink-0" />
        <input
          type="text"
          placeholder="Search cases, documents…"
          className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-full"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <RoleBadge role={role} />
        <div className="h-5 w-px bg-border" />
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-lg hover:bg-accent"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};

export default AppTopHeader;
