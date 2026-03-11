import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Zap } from "lucide-react";

const SignIn = () => {
  const navigate = useNavigate();
  const { user, needsOnboarding, completeSignup, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [step, setStep] = useState<"auth" | "onboarding">("auth");

  useEffect(() => {
    if (!authLoading && user && !needsOnboarding) {
      navigate("/", { replace: true });
    }
    if (!authLoading && user && needsOnboarding) {
      setStep("onboarding");
    }
  }, [user, needsOnboarding, authLoading, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completeSignup(displayName, orgName || "My Organization", orgCode);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Setup failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 text-sm border border-input rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-primary transition-colors";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-5 shadow-lg shadow-primary/20">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">CasualtyIQ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {step === "onboarding" ? "Complete your profile" : "Casualty Claims Intelligence Platform"}
          </p>
        </div>

        <div className="card-elevated p-6">
          {step === "onboarding" ? (
            <form onSubmit={handleOnboarding} className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-xs font-medium text-foreground mb-1.5">
                  Your Name
                </label>
                <input id="displayName" type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} placeholder="Jane Smith" />
              </div>
              <div>
                <label htmlFor="orgName" className="block text-xs font-medium text-foreground mb-1.5">
                  Organization Name
                </label>
                <input id="orgName" type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} placeholder="Burke & Associates" />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank if joining an existing org</p>
              </div>
              <div>
                <label htmlFor="orgCode" className="block text-xs font-medium text-foreground mb-1.5">
                  Organization Code <span className="text-muted-foreground">(optional)</span>
                </label>
                <input id="orgCode" type="text" value={orgCode} onChange={(e) => setOrgCode(e.target.value)} className={inputClass} placeholder="Enter code to join an existing org" />
              </div>

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>
              )}

              <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm">
                {loading ? "Setting up…" : "Complete Setup"}
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-foreground mb-1.5">Email</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.com" />
                </div>
                <div>
                  <label htmlFor="password" className="block text-xs font-medium text-foreground mb-1.5">Password</label>
                  <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                </div>

                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2.5">{error}</div>
                )}

                <button type="submit" disabled={loading} className="w-full py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm">
                  {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
                </button>
              </form>

              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  {mode === "signin" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SignIn;
