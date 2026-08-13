/** Suppress SSE notification toasts briefly after a local success toast. */
let suppressUntilMs = 0;

export function suppressNotificationToasts(ms = 2500): void {
  suppressUntilMs = Math.max(suppressUntilMs, Date.now() + ms);
}

export function shouldSuppressNotificationToast(type?: string | null): boolean {
  if (Date.now() >= suppressUntilMs) return false;
  const t = (type || "").toUpperCase();
  // Only mute echoes of action flows we already toasted (RMA / order).
  return t.startsWith("RMA_") || t.startsWith("ORDER_");
}
