"use client";

import { useMemo } from "react";
import {
  getDialCountryOptions,
  phonePlaceholder,
  toNationalDigits,
} from "@/lib/data/phone";
import { useLanguage } from "@/components/providers/LanguageProvider";

type PhoneInputProps = {
  id?: string;
  /** ISO country whose dial code is used (independent of shipping country). */
  dialCountry: string;
  onDialCountryChange: (code: string) => void;
  /** National significant number only (no dial code / trunk 0). */
  value: string;
  onChange: (nationalDigits: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
  name?: string;
};

export function PhoneInput({
  id = "phone",
  dialCountry,
  onDialCountryChange,
  value,
  onChange,
  disabled,
  required,
  className = "",
  name,
  "aria-invalid": ariaInvalid,
}: PhoneInputProps) {
  const { locale, t } = useLanguage();
  const options = useMemo(() => getDialCountryOptions(locale ?? "vi"), [locale]);
  const placeholder = useMemo(() => phonePlaceholder(dialCountry), [dialCountry]);

  return (
    <div className={`mq-phone-field ${className}`.trim()}>
      <label className="sr-only" htmlFor={`${id}-dial`}>
        {t("checkout.phoneDial")}
      </label>
      <select
        id={`${id}-dial`}
        className="mq-phone-dial-select"
        value={dialCountry}
        disabled={disabled}
        aria-label={t("checkout.phoneDial")}
        onChange={(e) => onDialCountryChange(e.target.value.toUpperCase())}
      >
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            +{opt.dial} {opt.code}
          </option>
        ))}
      </select>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="mq-input mq-phone-national"
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        onChange={(e) => onChange(toNationalDigits(e.target.value))}
      />
    </div>
  );
}
