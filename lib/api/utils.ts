export function asArray<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && data !== null && "items" in data) {
    const items = (data as { items?: unknown }).items;
    return Array.isArray(items) ? (items as T[]) : [];
  }
  if (typeof data === "object" && data !== null && "data" in data) {
    return asArray<T>((data as { data: unknown }).data);
  }
  return [];
}

/** Normalize list GET responses that may include envelope meta or flat Paginated shape. */
export function parsePage<T>(
  res: unknown,
): { items: T[]; meta?: import("./types").PageMeta } {
  if (Array.isArray(res)) {
    return { items: res as T[], meta: undefined };
  }
  if (!res || typeof res !== "object") {
    return { items: [], meta: undefined };
  }

  const o = res as {
    data?: unknown;
    items?: unknown;
    meta?: import("./types").PageMeta;
    page?: number;
    pageSize?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };

  // Nested page payload: { data: { items, total, page, pageSize } } (e.g. audit-logs)
  if (
    o.data &&
    typeof o.data === "object" &&
    !Array.isArray(o.data) &&
    ("items" in (o.data as object) ||
      "total" in (o.data as object) ||
      "page" in (o.data as object))
  ) {
    const nested = parsePage<T>(o.data);
    if (nested.meta || nested.items.length || o.meta) {
      return {
        items: nested.items,
        meta: nested.meta ?? o.meta,
      };
    }
  }

  const items = asArray<T>(o.data ?? o.items ?? o);
  if (o.meta && typeof o.meta.totalPages === "number") {
    return { items, meta: o.meta };
  }

  if (typeof o.totalPages === "number" || typeof o.total === "number") {
    const pageSize = Number(o.pageSize ?? o.limit ?? items.length) || 20;
    const total = Number(o.total ?? items.length);
    const totalPages =
      typeof o.totalPages === "number"
        ? o.totalPages
        : Math.max(1, Math.ceil(total / pageSize) || 1);
    return {
      items,
      meta: {
        page: Number(o.page) || 1,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  return { items, meta: o.meta };
}

export function getErrorCode(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export function formatMoney(value: string | number | undefined | null): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Format BE percent strings (e.g. `"5.0000"`) as `5%` / `6.5%`. */
export function formatPercent(value: string | number | undefined | null): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return "—";
  const trimmed = Number(n.toFixed(4));
  return `${trimmed}%`;
}

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);
}

export function statusMessage(status?: string): string {
  switch (status) {
    case "PENDING_VERIFY":
      return "Please verify your email before signing in.";
    case "PENDING_APPROVAL":
    case "ACCOUNT_PENDING":
    case "PENDING":
      return "Your staff account is waiting for Super Admin approval.";
    case "LOCKED":
      return "This account is locked.";
    case "DELETED":
      return "This account has been deleted.";
    default:
      return "Unable to sign in.";
  }
}
