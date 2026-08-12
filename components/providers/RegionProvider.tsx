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
  type GateRegionId,
  GATE_REGIONS,
  isValidRegion,
  REGION_TO_COUNTRY,
} from "@/lib/i18n/regions";

const REGION_STORAGE_KEY = "mq-region";

export type RegionContextValue = {
  region: GateRegionId | null;
  regionCode: string | null;
  /** Display currency for current region gate */
  currency: string | null;
  needsRegionSelection: boolean;
  regionPickerOpen: boolean;
  setRegion: (id: GateRegionId) => void;
  showRegionPicker: () => void;
  hideRegionPicker: () => void;
  currentRegion: (typeof GATE_REGIONS)[number] | null;
};

const RegionContext = createContext<RegionContextValue | null>(null);

export function RegionProvider({
  children,
  isAuthenticated = false,
}: {
  children: ReactNode;
  isAuthenticated?: boolean;
}) {
  const [region, setRegionState] = useState<GateRegionId | null>(null);
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

  useEffect(() => {
    if (ready && isAuthenticated && region === null) {
      setRegionPickerOpen(true);
    }
  }, [ready, isAuthenticated, region]);

  const setRegion = useCallback((id: GateRegionId) => {
    localStorage.setItem(REGION_STORAGE_KEY, id);
    setRegionState(id);
    setRegionPickerOpen(false);
  }, []);

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
