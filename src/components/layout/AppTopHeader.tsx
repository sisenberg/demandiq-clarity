import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User } from "lucide-react";
import RoleBadge from "@/components/ui/RoleBadge";

const AppTopHeader = () => {
  const { profile, role, signOut } = useAuth();

  return (
    <header className="h-12 border-b border-border bg-background flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <RoleBadge role={role} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="text-xs truncate max-w-[200px]">
            {profile?.display_name || profile?.email || "—"}
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-accent"
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
