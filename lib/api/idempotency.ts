/** Client UUID for idempotent POST (checkout, etc.). */

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Stable key per request body fingerprint:
 * - same body (retry / timeout) → same key
 * - cart / address / payment / note change → new key
 */
export function createIdempotencyKeyStore() {
  let fingerprint = "";
  let key = newIdempotencyKey();

  return {
    keyFor(body: unknown): string {
      const next = stableFingerprint(body);
      if (next !== fingerprint) {
        fingerprint = next;
        key = newIdempotencyKey();
      }
      return key;
    },
    /** Force a new key on next keyFor (e.g. after IDEMPOTENCY_KEY_REUSE_MISMATCH). */
    invalidate() {
      fingerprint = "";
      key = newIdempotencyKey();
    },
  };
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys(obj[k]);
        return acc;
      }, {});
  }
  return value;
}
