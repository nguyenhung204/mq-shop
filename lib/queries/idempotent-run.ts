import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";

/**
 * Idempotency-Key lifecycle for one write hook (UI6):
 * - a retry with the same body reuses the key (safe replay),
 * - a changed body gets a new key,
 * - success rotates the key (an identical later submit is a new operation),
 * - IDEMPOTENCY_KEY_REUSE_MISMATCH rotates it so the user is not stuck.
 */
export function createIdempotentRunner(store = createIdempotencyKeyStore()) {
  return {
    run<V, R>(vars: V, send: (vars: V, key: string) => Promise<R>): Promise<R> {
      return send(vars, store.keyFor(vars));
    },
    onSuccess() {
      store.invalidate();
    },
    onError(e: unknown) {
      if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") store.invalidate();
    },
  };
}
