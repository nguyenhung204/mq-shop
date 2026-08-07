"use client";

import { useState } from "react";
import { Globe, Check } from "lucide-react";
import { GATE_REGIONS, type GateRegionId } from "@/lib/i18n/regions";
import { RegionFlag } from "@/components/i18n/RegionFlag";
import { useRegion } from "@/components/providers/RegionProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Modal that appears after login when the user hasn't selected a shopping region.
 * Can also be opened manually via the region switcher in the header.
 */
export function RegionSelectionModal() {
  const { regionPickerOpen, hideRegionPicker, setRegion, region } = useRegion();
  const { t } = useLanguage();
  const [picked, setPicked] = useState<GateRegionId | null>(region);

  if (!regionPickerOpen) return null;

  const handleConfirm = () => {
    if (picked) {
      setRegion(picked);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={region ? hideRegionPicker : undefined}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-black/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#0d8f8a]/10">
              <Globe size={20} className="text-[#0d8f8a]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-mq-text">
                {t("region.selectTitle")}
              </h2>
              <p className="text-sm text-mq-text-muted">
                {t("region.selectSubtitle")}
              </p>
            </div>
          </div>
        </div>

        {/* Region cards */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-3">
            {GATE_REGIONS.map((r) => {
              const isSelected = picked === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPicked(r.id)}
                  className={`
                    relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-150
                    ${
                      isSelected
                        ? "border-[#0d8f8a] bg-[#0d8f8a]/5 shadow-md"
                        : "border-mq-border hover:border-[#0d8f8a]/40 hover:bg-mq-surface-subtle"
                    }
                  `}
                >
                  {isSelected && (
                    <span className="absolute top-2 right-2 flex items-center justify-center w-5 h-5 rounded-full bg-[#0d8f8a] text-white">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  )}
                  <RegionFlag regionId={r.id} />
                  <div className="text-center">
                    <p className="text-sm font-medium text-mq-text">
                      {r.localLabel}
                    </p>
                    <p className="text-xs text-mq-text-muted">{r.country}</p>
                    <p className="text-xs text-mq-text-muted mt-0.5">
                      {r.currency}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-xs text-mq-text-muted mt-4 text-center">
            {t("region.selectHint")}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          {region && (
            <button
              type="button"
              onClick={hideRegionPicker}
              className="mq-btn mq-btn-outline flex-1"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!picked}
            className="mq-btn mq-btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("region.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
