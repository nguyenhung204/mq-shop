"use client";

import { useEffect, useState } from "react";
import {
  fetchCities,
  fetchStates,
  findStateByName,
  type ICity,
  type IState,
} from "@/lib/geo/locations";
import { useLanguage } from "@/components/providers/LanguageProvider";

type AddressRegionFieldsProps = {
  countryCode: string;
  city: string;
  district?: string;
  onCityChange: (city: string) => void;
  onDistrictChange: (district: string) => void;
  cityError?: string;
  cityId?: string;
  districtId?: string;
};

/**
 * Cascading province/state → city/district selects.
 * Writes human-readable names into `city` / `district` (BE shippingAddress shape).
 * Falls back to text inputs when a country has no region data.
 */
export function AddressRegionFields({
  countryCode,
  city,
  district = "",
  onCityChange,
  onDistrictChange,
  cityError,
  cityId = "city",
  districtId = "district",
}: AddressRegionFieldsProps) {
  const { t } = useLanguage();
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const [stateIso2, setStateIso2] = useState("");
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const code = countryCode?.toUpperCase() || "";
    if (!code) {
      setStates([]);
      setCities([]);
      setStateIso2("");
      setUseFallback(true);
      return;
    }

    setLoadingStates(true);
    setUseFallback(false);
    void fetchStates(code)
      .then((list) => {
        if (cancelled) return;
        setStates(list);
        setUseFallback(list.length === 0);
        const matched = findStateByName(list, city);
        setStateIso2(matched?.iso2 ?? "");
        if (!matched) {
          setCities([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStates([]);
        setCities([]);
        setStateIso2("");
        setUseFallback(true);
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-load when country changes; city match runs after states load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: country-driven
  }, [countryCode]);

  useEffect(() => {
    let cancelled = false;
    const code = countryCode?.toUpperCase() || "";
    if (!code || !stateIso2) {
      setCities([]);
      return;
    }

    setLoadingCities(true);
    void fetchCities(code, stateIso2)
      .then((list) => {
        if (cancelled) return;
        setCities(list);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [countryCode, stateIso2]);

  if (useFallback) {
    return (
      <>
        <div>
          <label className="block text-sm mb-1.5" htmlFor={cityId}>
            {t("checkout.city")}
          </label>
          <input
            id={cityId}
            className="mq-input"
            autoComplete="address-level1"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
          />
          {cityError ? (
            <p className="text-xs text-mq-accent-orange mt-1.5">{cityError}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-sm mb-1.5" htmlFor={districtId}>
            {t("checkout.district")}
          </label>
          <input
            id={districtId}
            className="mq-input"
            autoComplete="address-level2"
            value={district}
            onChange={(e) => onDistrictChange(e.target.value)}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div>
        <label className="block text-sm mb-1.5" htmlFor={cityId}>
          {t("checkout.city")}
        </label>
        <select
          id={cityId}
          className="mq-input"
          disabled={loadingStates || states.length === 0}
          value={stateIso2}
          onChange={(e) => {
            const iso2 = e.target.value;
            setStateIso2(iso2);
            const state = states.find((s) => s.iso2 === iso2);
            onCityChange(state?.name ?? "");
            onDistrictChange("");
          }}
        >
          <option value="">
            {loadingStates ? t("checkout.loadingRegions") : t("checkout.selectCity")}
          </option>
          {states.map((s) => (
            <option key={`${s.country_code}-${s.iso2}`} value={s.iso2}>
              {s.native || s.name}
            </option>
          ))}
        </select>
        {cityError ? (
          <p className="text-xs text-mq-accent-orange mt-1.5">{cityError}</p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm mb-1.5" htmlFor={districtId}>
          {t("checkout.district")}
        </label>
        <select
          id={districtId}
          className="mq-input"
          disabled={!stateIso2 || loadingCities}
          value={district}
          onChange={(e) => onDistrictChange(e.target.value)}
        >
          <option value="">
            {!stateIso2
              ? t("checkout.selectCityFirst")
              : loadingCities
                ? t("checkout.loadingRegions")
                : cities.length === 0
                  ? t("checkout.noDistricts")
                  : t("checkout.selectDistrict")}
          </option>
          {cities.map((c) => (
            <option key={c.id} value={c.name}>
              {c.native || c.name}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}
