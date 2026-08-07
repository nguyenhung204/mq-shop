"use client";

import { Globe } from "lucide-react";
import { GATE_REGIONS } from "@/lib/i18n/regions";
import { useRegion } from "@/components/providers/RegionProvider";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Compact region indicator + button shown in the header.
 * Clicking it opens the RegionSelectionModal.
 */
export function RegionSwitcher({ className = "" }: { className?: string }) {
  const { region, currentRegion, showRegionPicker } = useRegion();
  const { t } = useLanguage();

  const label = currentRegion?.localLabel ?? t("region.select");

  return (
    <button
      type="button"
      onClick={showRegionPicker}
      className={`mq-icon-btn inline-flex items-center gap-1.5 text-mq-text hover:text-mq-gold transition-colors ${className}`}
      aria-label={t("region.switchRegion")}
      title={t("region.switchRegion")}
    >
      <Globe size={16} strokeWidth={1.5} />
      <span className="text-xs font-medium max-w-[4rem] truncate">
        {region ? label : "—"}
      </span>
    </button>
  );
}
