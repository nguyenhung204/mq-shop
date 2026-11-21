"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type BusinessRegionCode,
  type GateRegionId,
  GATE_REGIONS,
  isValidRegion,
  REGION_TO_COUNTRY,
} from "@/lib/i18n/regions";
import { toast } from "sonner";
import { initialRegion, switchRegion } from "@/lib/i18n/region-sync";
import { tt } from "@/lib/i18n/tt";
import { getErrorMessage } from "@/lib/queries/utils";

const REGION_STORAGE_KEY = "mq-region";

export type RegionContextValue = {
  region: GateRegionId | null;
  regionCode: string | null;
  /** Display currency for current region gate */
  currency: string | null;
  needsRegionSelection: boolean;
  regionPickerOpen: boolean;
  /**
   * Signed in: asks the API first (PATCH /users/me/region) and keeps the old region when it refuses.
   * Resolves true when the region is now `id`.
   */
  setRegion: (id: GateRegionId) => Promise<boolean>;
  showRegionPicker: () => void;
  hideRegionPicker: () => void;
  currentRegion: (typeof GATE_REGIONS)[number] | null;
};

const RegionContext = createContext<RegionContextValue | null>(null);

export function RegionProvider({
  children,
  isAuthenticated = false,
  serverRegionCode = null,
  persistRegion,
}: {
  children: ReactNode;
  isAuthenticated?: boolean;
  /** me.regionCode of the signed-in account: initialises (and overrides) the browser's choice. */
  serverRegionCode?: string | null;
  /** Saves a region switch on the account (PATCH /users/me/region); rejects when the API refuses. */
  persistRegion?: (code: BusinessRegionCode) => Promise<unknown>;
}) {
  const [localRegion, setRegionState] = useState<GateRegionId | null>(null);
  const [ready, setReady] = useState(false);
  const [regionPickerOpen, setRegionPickerOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(REGION_STORAGE_KEY);
    if (isValidRegion(saved)) {
      setRegionState(saved);
    }
    setReady(true);

    const onRegionSync = () => {
      const val = localStorage.getItem(REGION_STORAGE_KEY);
      if (isValidRegion(val)) {
        setRegionState(val);
      }
    };
    window.addEventListener("mq:region-sync", onRegionSync);
    return () => window.removeEventListener("mq:region-sync", onRegionSync);
  }, []);

  // The account's region is the authority once the profile is known (login, reload, switch on another device).
  const region = initialRegion(isAuthenticated ? serverRegionCode : null, localRegion);

  useEffect(() => {
    if (!ready || !isAuthenticated) return;
    const fromServer = initialRegion(serverRegionCode, null);
    if (fromServer) localStorage.setItem(REGION_STORAGE_KEY, fromServer);
  }, [ready, isAuthenticated, serverRegionCode]);

  useEffect(() => {
    if (ready && isAuthenticated && region === null) {
      setRegionPickerOpen(true);
    }
  }, [ready, isAuthenticated, region]);

  const setRegion = useCallback(
    async (id: GateRegionId) => {
      const res = await switchRegion({
        id,
        authenticated: isAuthenticated,
        persist: persistRegion,
        commit: (next) => {
          localStorage.setItem(REGION_STORAGE_KEY, next);
          setRegionState(next);
          setRegionPickerOpen(false);
        },
      });
      if (!res.ok) toast.error(getErrorMessage(res.error, tt("region.switchFailed")));
      return res.ok;
    },
    [isAuthenticated, persistRegion],
  );

  const showRegionPicker = useCallback(() => setRegionPickerOpen(true), []);
  const hideRegionPicker = useCallback(() => setRegionPickerOpen(false), []);

  const regionCode = region ? REGION_TO_COUNTRY[region] : null;
  const currentRegion = region
    ? GATE_REGIONS.find((r) => r.id === region) ?? null
    : null;
  const currency = currentRegion?.currency ?? null;

  const value = useMemo<RegionContextValue>(
    () => ({
      region,
      regionCode,
      currency,
      needsRegionSelection: ready && isAuthenticated && region === null,
      regionPickerOpen,
      setRegion,
      showRegionPicker,
      hideRegionPicker,
      currentRegion,
    }),
    [
      region,
      regionCode,
      currency,
      ready,
      isAuthenticated,
      regionPickerOpen,
      setRegion,
      showRegionPicker,
      hideRegionPicker,
      currentRegion,
    ],
  );

  return (
    <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
  );
}

export function useRegion() {
  const ctx = useContext(RegionContext);
  if (!ctx) throw new Error("useRegion must be used within RegionProvider");
  return ctx;
}

export { REGION_TO_COUNTRY, isValidRegion };
