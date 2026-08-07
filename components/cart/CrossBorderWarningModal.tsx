"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, Package, Truck } from "lucide-react";
import { GATE_REGIONS, type GateRegionId } from "@/lib/i18n/regions";
import { useRegion } from "@/components/providers/RegionProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { CartLine } from "@/lib/stores/cart-store";

type RegionAvailability = {
  variantId: string;
  available: boolean;
  warehouseCountry: string | null;
  availableStock: number;
};

export type CrossBorderCheckResult = {
  /** Items that are NOT available in the user's current region warehouse */
  crossBorderItems: CartLine[];
  /** For each cross-border item, regions where stock IS available */
  alternativeRegions: Map<string, string[]>;
};

/**
 * Checks which cart items are cross-border relative to the user's region.
 * Uses the product's countryCodes (which countries it's listed in)
 * and optionally API availability data.
 */
export function detectCrossBorderItems(
  items: CartLine[],
  userRegionCode: string | null,
  availabilityData?: RegionAvailability[],
): CrossBorderCheckResult {
  if (!userRegionCode) {
    return { crossBorderItems: [], alternativeRegions: new Map() };
  }

  const crossBorderItems: CartLine[] = [];
  const alternativeRegions = new Map<string, string[]>();

  for (const item of items) {
    const codes = item.countryCodes;
    if (!codes || codes.length === 0) continue;

    // If the product is NOT listed in the user's current region, it's cross-border
    const isInRegion = codes.includes(userRegionCode);
    if (!isInRegion) {
      crossBorderItems.push(item);
      // The product's countryCodes tell us where it IS available
      alternativeRegions.set(item.variantId, codes);
    }
  }

  // If we have API availability data, enrich with warehouse-level info
  if (availabilityData) {
    for (const avail of availabilityData) {
      if (!avail.available && avail.warehouseCountry) {
        const item = items.find((i) => i.variantId === avail.variantId);
        if (item && !crossBorderItems.includes(item)) {
          crossBorderItems.push(item);
        }
        const existing = alternativeRegions.get(avail.variantId) ?? [];
        if (avail.warehouseCountry && !existing.includes(avail.warehouseCountry)) {
          alternativeRegions.set(avail.variantId, [
            ...existing,
            avail.warehouseCountry,
          ]);
        }
      }
    }
  }

  return { crossBorderItems, alternativeRegions };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onSwitchRegion: (regionId: GateRegionId) => void;
  crossBorderItems: CartLine[];
  alternativeRegions: Map<string, string[]>;
};

function countryCodeToRegionId(code: string): GateRegionId | null {
  const map: Record<string, GateRegionId> = {
    TW: "tw",
    MY: "my",
    VN: "vn",
    SG: "sg",
  };
  return map[code] ?? null;
}

function countryCodeToLabel(code: string): string {
  const region = GATE_REGIONS.find(
    (r) => r.id === countryCodeToRegionId(code),
  );
  return region?.localLabel ?? code;
}

export function CrossBorderWarningModal({
  open,
  onClose,
  onContinue,
  onSwitchRegion,
  crossBorderItems,
  alternativeRegions,
}: Props) {
  const { t } = useLanguage();
  const { regionCode } = useRegion();

  // Find the most common alternative region to suggest
  const suggestedRegion = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const [, codes] of alternativeRegions) {
      for (const code of codes) {
        if (code !== regionCode) {
          countMap.set(code, (countMap.get(code) ?? 0) + 1);
        }
      }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [code, count] of countMap) {
      if (count > bestCount) {
        best = code;
        bestCount = count;
      }
    }
    return best;
  }, [alternativeRegions, regionCode]);

  const suggestedRegionId = suggestedRegion
    ? countryCodeToRegionId(suggestedRegion)
    : null;

  if (!open || crossBorderItems.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-black/5 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 shrink-0">
              <AlertTriangle size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-mq-text">
                {t("crossBorder.title")}
              </h2>
              <p className="text-sm text-mq-text-muted mt-0.5">
                {t("crossBorder.subtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Cross-border items list */}
        <div className="px-6 py-4 max-h-60 overflow-y-auto">
          <ul className="space-y-3">
            {crossBorderItems.map((item) => {
              const altCodes = alternativeRegions.get(item.variantId) ?? [];
              return (
                <li
                  key={item.variantId}
                  className="flex items-start gap-3 p-3 rounded-lg bg-mq-surface-subtle border border-mq-border"
                >
                  <Package size={16} className="text-mq-text-muted shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-mq-text line-clamp-1">
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Truck size={12} className="text-mq-text-muted" />
                      <span className="text-xs text-mq-text-muted">
                        {t("crossBorder.availableIn")}{" "}
                        {altCodes.map(countryCodeToLabel).join(", ")}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Suggestion */}
        {suggestedRegionId && (
          <div className="px-6 py-3 bg-emerald-50/60 border-t border-emerald-100">
            <div className="flex items-start gap-2.5">
              <ArrowRightLeft size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-emerald-800 font-medium">
                  {t("crossBorder.suggestion")}
                </p>
                <p className="text-xs text-emerald-700/80 mt-0.5">
                  {t("crossBorder.suggestionDetail", {
                    region: countryCodeToLabel(suggestedRegion!),
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-mq-border flex flex-col gap-2.5">
          {suggestedRegionId && (
            <button
              type="button"
              onClick={() => onSwitchRegion(suggestedRegionId)}
              className="mq-btn mq-btn-primary w-full"
            >
              {t("crossBorder.switchRegion", {
                region: countryCodeToLabel(suggestedRegion!),
              })}
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className={`mq-btn w-full ${suggestedRegionId ? "mq-btn-outline" : "mq-btn-primary"}`}
          >
            {t("crossBorder.continueAnyway")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-mq-text-muted hover:text-mq-text text-center py-1 transition-colors"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
