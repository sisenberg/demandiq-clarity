import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { AppRole } from "@/lib/permissions";
import { ModuleId } from "@/types";

interface Profile {
  display_name: string;
  email: string;
  tenant_id: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  tenantId: string | null;
  /** Module IDs the tenant has licensed (DemandIQ always included) */
  tenantModules: string[];
  profile: Profile | null;
  needsOnboarding: boolean;
  completeSignup: (displayName: string, orgName: string, orgCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  role: null,
  tenantId: null,
  profile: null,
  needsOnboarding: false,
  completeSignup: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("display_name, email, tenant_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profileData) {
      setNeedsOnboarding(true);
      setProfile(null);
      setRole(null);
      setTenantId(null);
      return;
    }

    setProfile(profileData);
    setTenantId(profileData.tenant_id);
    setNeedsOnboarding(false);

    // Fetch role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    setRole((roleData?.role as AppRole) ?? null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          // Defer to avoid Supabase auth deadlock
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
          setRole(null);
          setTenantId(null);
          setNeedsOnboarding(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const completeSignup = useCallback(async (displayName: string, orgName: string, orgCode?: string) => {
    const { error } = await supabase.rpc("complete_signup", {
      _display_name: displayName,
      _org_name: orgName,
      _org_code: orgCode || null,
    });
    if (error) throw error;
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, role, tenantId, profile, needsOnboarding, completeSignup, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
