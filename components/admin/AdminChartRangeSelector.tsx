"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

type RangeOption = { value: string; labelKey: string };

export function AdminChartRangeSelector({
  options,
  value,
  onChange,
}: {
  options: RangeOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="mq-seg" role="group">
      {options.map((opt) => {
        const label = t(opt.labelKey);
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            // Mirrors the label so ::after can reserve the bold width.
            data-label={label}
            aria-pressed={active}
            className={`mq-seg-item${active ? " is-active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
