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
    <div className="flex rounded-lg border border-mq-border overflow-hidden text-xs">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`px-2.5 py-1 transition-colors ${
            opt.value === value
              ? "bg-mq-primary text-white font-medium"
              : "text-mq-text-muted hover:bg-mq-surface"
          }`}
          onClick={() => onChange(opt.value)}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}
