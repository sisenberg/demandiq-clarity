import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Permission } from "@/lib/permissions";
import { hasPermission } from "@/lib/permissions";

interface RoleGuardProps {
  children: React.ReactNode;
  permission: Permission;
  fallback?: string;
}

const RoleGuard = ({ children, permission, fallback = "/" }: RoleGuardProps) => {
  const { role, loading } = useAuth();

  if (loading) return null;

  if (!hasPermission(role, permission)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default RoleGuard;
