import type { Role } from "@/lib/api/types";

/**
 * Who may read "my dividend credits" (route-authz GET /dividend/credits): ACCOUNTANT, ADMIN, SUPER_ADMIN,
 * SELLER, BUYER. CS and WAREHOUSE are refused (403), so they get neither the page nor the links.
 */
export const DIVIDEND_CREDIT_ROLES: Role[] = ["ACCOUNTANT", "ADMIN", "SUPER_ADMIN", "SELLER", "BUYER"];

export function canViewDividendCredits(user: { roles?: string[] } | null | undefined): boolean {
  return Boolean(user?.roles?.some((r) => (DIVIDEND_CREDIT_ROLES as string[]).includes(r)));
}

/** The first quarter of a path segment (`2026Q4`), decoded safely: null for a malformed or invalid segment (e.g. `%25`). */
export function quarterFromSegment(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return /^\d{4}Q[1-4]$/.test(decoded) ? decoded : null;
}

/**
 * Turning the automatic dividend credit ON needs an explicit confirmation; turning it off (or saving anything
 * else) does not. `previous` is the stored value.
 */
export function needsEnableConfirm(key: string, next: unknown, previous: unknown): boolean {
  return key === "dividendAutoCreditEnabled" && next === true && previous !== true;
}
