import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";
import type { UserRole } from "@/types";

interface RoleGuardProps {
  minRole: UserRole;
  children: React.ReactNode;
}

export function RoleGuard({ minRole, children }: RoleGuardProps) {
  const isAtLeast = useAuthStore((s) => s.isAtLeast);

  if (!isAtLeast(minRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
