"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
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
  const { t } = useLanguage();
  const router = useRouter();

  const roleOk = !roles || roles.some((r) => hasRole(r));
  const permOk =
    !permissions ||
    hasAnyPermission(permissions) ||
    hasRole("SUPER_ADMIN") ||
    hasRole("ADMIN");
  // Staff portal pages pass `roles` — matching a role is enough (BE enforces
  // fine-grained perms). Requiring permissions[] AND role broke ACCOUNTANT
  // when /me omits the permissions list. Permissions-only pages still use permOk.
  const allowed = isAuthenticated && (roles ? roleOk : permOk);

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
        {t("admin.common.loading")}
      </div>
    );
  }

  return <>{children}</>;
}
