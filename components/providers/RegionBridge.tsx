"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { createIdempotencyKeyStore } from "@/lib/api/idempotency";
import { useAuth } from "@/components/providers/AuthProvider";
import { RegionProvider } from "@/components/providers/RegionProvider";
import { DisplayMoneyProvider } from "@/components/providers/DisplayMoneyProvider";
import { RegionSelectionModal } from "@/components/i18n/RegionSelectionModal";

/**
 * Bridge between AuthProvider and RegionProvider.
 * Reads isAuthenticated from auth context and passes it to RegionProvider,
 * also renders the RegionSelectionModal at this level.
 */
export function RegionBridge({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, setUser } = useAuth();
  const idempotency = useMemo(() => createIdempotencyKeyStore(), []);

  // PATCH /users/me/region; the same switch retried reuses its Idempotency-Key, a success starts a new one.
  const persistRegion = useCallback(
    async (code: string) => {
      try {
        const me = await authApi.updateRegion(code, idempotency.keyFor({ regionCode: code }));
        idempotency.invalidate();
        if (user) setUser({ ...user, ...me });
      } catch (e) {
        if (e instanceof ApiError && e.code === "IDEMPOTENCY_KEY_REUSE_MISMATCH") idempotency.invalidate();
        throw e;
      }
    },
    [idempotency, setUser, user],
  );

  return (
    <RegionProvider isAuthenticated={isAuthenticated} serverRegionCode={user?.regionCode ?? null} persistRegion={persistRegion}>
      <DisplayMoneyProvider>
        {children}
        <RegionSelectionModal />
      </DisplayMoneyProvider>
    </RegionProvider>
  );
}
