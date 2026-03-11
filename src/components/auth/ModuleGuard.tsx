import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isEntitlementActive } from "@/hooks/useModuleEntitlements";

interface ModuleGuardProps {
  moduleId: string;
  children: ReactNode;
  /** Where to redirect when module is not entitled. Defaults to "/" */
  fallbackPath?: string;
}

/**
 * Route guard that checks if the current tenant has an active entitlement
 * (enabled or valid trial) for the given module. Redirects otherwise.
 */
const ModuleGuard = ({ moduleId, children, fallbackPath = "/" }: ModuleGuardProps) => {
  const { entitlements, loading } = useAuth();

  // Don't redirect while auth is still loading
  if (loading) return null;

  if (!isEntitlementActive(entitlements, moduleId)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ModuleGuard;
