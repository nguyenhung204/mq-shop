"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Role } from "@/lib/api/types";

export function AuthGuard({
  children,
  roles,
  permissions,
  fallback = "/my-account",
}: {
  children: ReactNode;
  roles?: Role[];
  permissions?: string[];
  fallback?: string;
}) {
  const { user, loading, isAuthenticated, hasRole, hasAnyPermission } = useAuth();
  const router = useRouter();

  const allowed =
    isAuthenticated &&
    (!roles || roles.some((r) => hasRole(r))) &&
    (!permissions || hasAnyPermission(permissions) || hasRole("SUPER_ADMIN"));

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      router.replace(fallback);
      return;
    }
    if (!allowed) {
      router.replace("/");
    }
  }, [loading, isAuthenticated, allowed, router, fallback]);

  if (loading || !user || !allowed) {
    return (
      <div className="mq-container py-20 text-center text-mq-text-muted text-sm">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}
