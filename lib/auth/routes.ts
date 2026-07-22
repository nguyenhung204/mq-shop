import type { AuthUser, Role } from "@/lib/api/types";

/** Default destination after login / OTP, by role priority. */
export function postAuthPath(user: AuthUser | null | undefined): string {
  const roles = user?.roles ?? [];
  if (roles.includes("SUPER_ADMIN") || roles.includes("ADMIN")) return "/admin";
  if (roles.includes("ACCOUNTANT")) return "/admin/audit-logs";
  if (roles.includes("WAREHOUSE")) return "/seller/inventory";
  if (roles.includes("SELLER")) return "/seller";
  return "/account";
}

export function isStaffRole(role: Role): boolean {
  return (
    role === "ADMIN" ||
    role === "SUPER_ADMIN" ||
    role === "ACCOUNTANT" ||
    role === "WAREHOUSE"
  );
}
