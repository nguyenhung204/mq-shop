"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { RegionProvider } from "@/components/providers/RegionProvider";
import { RegionSelectionModal } from "@/components/i18n/RegionSelectionModal";

/**
 * Bridge between AuthProvider and RegionProvider.
 * Reads isAuthenticated from auth context and passes it to RegionProvider,
 * also renders the RegionSelectionModal at this level.
 */
export function RegionBridge({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <RegionProvider isAuthenticated={isAuthenticated}>
      {children}
      <RegionSelectionModal />
    </RegionProvider>
  );
}
