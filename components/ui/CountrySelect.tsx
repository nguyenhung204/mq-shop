"use client";

import { forwardRef, useMemo, type SelectHTMLAttributes } from "react";
import { getCountryOptions } from "@/lib/data/countries";
import { useLanguage } from "@/components/providers/LanguageProvider";

type CountrySelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  /** When set with onChange(string), works as a controlled select. */
  onValueChange?: (code: string) => void;
};

export const CountrySelect = forwardRef<HTMLSelectElement, CountrySelectProps>(
  function CountrySelect(
    { className = "mq-input", autoComplete = "country", onChange, onValueChange, ...rest },
    ref,
  ) {
    const { locale } = useLanguage();
    const options = useMemo(() => getCountryOptions(locale ?? "vi"), [locale]);

    return (
      <select
        ref={ref}
        className={className}
        autoComplete={autoComplete}
        onChange={(e) => {
          onChange?.(e);
          onValueChange?.(e.target.value);
        }}
        {...rest}
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label} ({opt.code})
          </option>
        ))}
      </select>
    );
  },
);
