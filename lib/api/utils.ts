export function asArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null && "items" in data) {
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  return [];
}

export function formatMoney(value: string | number | undefined | null): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

export function statusMessage(status?: string): string {
  switch (status) {
    case "PENDING_VERIFY":
      return "Please verify your email before signing in.";
    case "PENDING_APPROVAL":
      return "Your staff account is waiting for Super Admin approval.";
    case "LOCKED":
      return "This account is locked.";
    case "DELETED":
      return "This account has been deleted.";
    default:
      return "Unable to sign in.";
  }
}
