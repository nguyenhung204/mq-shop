import type { ApiNotification } from "@/lib/api/types";

/** Coerce BE meta values to string map (ids / status / amounts). */
export function normalizeNotificationMeta(
  raw: unknown,
): Record<string, string> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    if (typeof v === "string") {
      if (v.trim()) out[k] = v.trim();
    } else if (typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function normalizeNotification(raw: unknown): ApiNotification | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Record<string, unknown>;
  if (typeof n.id !== "string" || !n.id) return null;

  const meta =
    normalizeNotificationMeta(n.meta) ??
    normalizeNotificationMeta(n.payload) ??
    null;

  const toIso = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "number") return new Date(v).toISOString();
    return String(v);
  };

  return {
    id: n.id,
    userId: typeof n.userId === "string" ? n.userId : undefined,
    type: typeof n.type === "string" ? n.type : "GENERIC",
    title: typeof n.title === "string" ? n.title : "",
    body: typeof n.body === "string" ? n.body : "",
    meta,
    metaNames: normalizeNotificationMeta(n.metaNames) ?? null,
    readAt: toIso(n.readAt),
    createdAt: toIso(n.createdAt) || new Date().toISOString(),
  };
}
