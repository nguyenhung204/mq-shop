"use client";

import { FormEvent, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { LandingCostItemInput, LandingCostResult } from "@/lib/api/finance";
import { formatMoney } from "@/lib/api/utils";
import { useCalculateLandingCost } from "@/lib/queries/finance";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getErrorMessage } from "@/lib/queries/utils";
import { LedgerTwdNote } from "@/components/finance/LedgerTwdNote";
import {
  getMoneyInputErrorMessage,
  parseLocaleIntInput,
  parseLocaleMoneyInput,
} from "@/lib/money";

type LineForm = {
  key: string;
  unitPrice: string;
  quantity: string;
  discount: string;
};

function newLine(): LineForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unitPrice: "",
    quantity: "1",
    discount: "",
  };
}

export function LandingCostCalculator() {
  const { t, locale } = useLanguage();
  const calculate = useCalculateLandingCost();
  const [lines, setLines] = useState<LineForm[]>([newLine()]);
  const [shippingFee, setShippingFee] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [packagingFee, setPackagingFee] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<LandingCostResult | null>(null);

  const updateLine = (key: string, patch: Partial<LineForm>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const removeLine = (key: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    const moneyOpts = {
      locale,
      maxDecimals: 2,
      allowZero: true,
      allowNegative: false,
      max: 999999999999.99,
    };

    const items: LandingCostItemInput[] = [];
    for (const line of lines) {
      const unitParsed = parseLocaleMoneyInput(line.unitPrice, moneyOpts);
      if (!unitParsed.ok) {
        setFormError(getMoneyInputErrorMessage(unitParsed.error, t, moneyOpts));
        return;
      }
      const qtyParsed = parseLocaleIntInput(line.quantity, {
        locale,
        min: 1,
        max: 1000000,
        allowZero: false,
      });
      if (!qtyParsed.ok) {
        setFormError(
          getMoneyInputErrorMessage(qtyParsed.error, t, {
            locale,
            maxDecimals: 0,
            min: 1,
            max: 1000000,
          }),
        );
        return;
      }
      const item: LandingCostItemInput = {
        unitPrice: unitParsed.canonical,
        quantity: qtyParsed.value,
      };
      if (line.discount.trim()) {
        const discParsed = parseLocaleMoneyInput(line.discount, moneyOpts);
        if (!discParsed.ok) {
          setFormError(getMoneyInputErrorMessage(discParsed.error, t, moneyOpts));
          return;
        }
        item.discount = discParsed.canonical;
      }
      items.push(item);
    }

    const parseOptionalMoney = (raw: string): string | null | undefined => {
      if (!raw.trim()) return undefined;
      const parsed = parseLocaleMoneyInput(raw, moneyOpts);
      if (!parsed.ok) {
        setFormError(getMoneyInputErrorMessage(parsed.error, t, moneyOpts));
        return null;
      }
      return parsed.canonical;
    };

    const shipCanon = parseOptionalMoney(shippingFee);
    if (shipCanon === null) return;
    const vatCanon = parseOptionalMoney(vatAmount);
    if (vatCanon === null) return;
    const pkgCanon = parseOptionalMoney(packagingFee);
    if (pkgCanon === null) return;
    const promoCanon = parseOptionalMoney(promoDiscount);
    if (promoCanon === null) return;

    try {
      const data = await calculate.mutateAsync({
        items,
        ...(shipCanon !== undefined ? { shippingFee: shipCanon } : {}),
        ...(vatCanon !== undefined ? { vatAmount: vatCanon } : {}),
        ...(pkgCanon !== undefined ? { packagingFee: pkgCanon } : {}),
        ...(promoCanon !== undefined ? { promoDiscount: promoCanon } : {}),
      });
      setResult(data);
    } catch (err) {
      setFormError(getErrorMessage(err, t("toast.landingCostFailed"), locale));
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-mq-text-muted">{t("landingCost.intro")}</p>
      <LedgerTwdNote />

      <form className="mq-card p-5 space-y-4" onSubmit={(e) => void onSubmit(e)}>
        {formError ? <div className="mq-alert mq-alert-error">{formError}</div> : null}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-sm">{t("landingCost.itemsHeading")}</h3>
            <button
              type="button"
              className="mq-btn mq-btn-outline text-xs"
              onClick={() => setLines((prev) => [...prev, newLine()])}
            >
              <Plus size={14} aria-hidden />
              {t("landingCost.addLine")}
            </button>
          </div>

          {lines.map((line, index) => (
            <div
              key={line.key}
              className="grid sm:grid-cols-[1fr_6rem_1fr_auto] gap-2 items-end border-b border-mq-border/50 pb-3 last:border-0"
            >
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">
                  {t("landingCost.unitPrice")} #{index + 1}
                </span>
                <input
                  className="mq-input"
                  inputMode="decimal"
                  value={line.unitPrice}
                  required
                  onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("landingCost.quantity")}</span>
                <input
                  className="mq-input"
                  inputMode="numeric"
                  value={line.quantity}
                  required
                  onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-mq-text-muted">{t("landingCost.lineDiscount")}</span>
                <input
                  className="mq-input"
                  inputMode="decimal"
                  value={line.discount}
                  placeholder="0"
                  onChange={(e) => updateLine(line.key, { discount: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="mq-btn mq-btn-outline text-xs mb-0.5"
                disabled={lines.length <= 1}
                aria-label={t("landingCost.removeLine")}
                onClick={() => removeLine(line.key)}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="space-y-1 text-sm">
            <span className="text-mq-text-muted">{t("landingCost.shippingFee")}</span>
            <input
              className="mq-input"
              inputMode="decimal"
              value={shippingFee}
              placeholder="0"
              onChange={(e) => setShippingFee(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-mq-text-muted">{t("landingCost.vatAmount")}</span>
            <input
              className="mq-input"
              inputMode="decimal"
              value={vatAmount}
              placeholder="0"
              onChange={(e) => setVatAmount(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-mq-text-muted">{t("landingCost.packagingFee")}</span>
            <input
              className="mq-input"
              inputMode="decimal"
              value={packagingFee}
              placeholder="0"
              onChange={(e) => setPackagingFee(e.target.value)}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-mq-text-muted">{t("landingCost.promoDiscount")}</span>
            <input
              className="mq-input"
              inputMode="decimal"
              value={promoDiscount}
              placeholder="0"
              onChange={(e) => setPromoDiscount(e.target.value)}
            />
          </label>
        </div>

        <button
          type="submit"
          className="mq-btn mq-btn-primary"
          disabled={calculate.isPending}
        >
          {calculate.isPending ? t("landingCost.calculating") : t("landingCost.calculate")}
        </button>
      </form>

      {result ? (
        <div className="mq-card p-5 space-y-4">
          <h3 className="font-semibold">{t("landingCost.resultHeading")}</h3>

          <ul className="space-y-2 text-sm">
            {result.items.map((item) => (
              <li
                key={item.index}
                className="flex flex-wrap justify-between gap-2 border-b border-mq-border/50 pb-2 last:border-0"
              >
                <span>
                  #{item.index + 1}: {formatMoney(item.unitPrice)} × {item.quantity}
                  {Number(item.discount) > 0
                    ? ` − ${formatMoney(item.discount)}`
                    : ""}
                </span>
                <span className="tabular-nums font-medium">
                  {formatMoney(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>

          <div className="text-sm space-y-1 border-t border-mq-border/60 pt-3">
            <p className="flex justify-between gap-3">
              <span className="text-mq-text-muted">{t("landingCost.itemsSubtotal")}</span>
              <span className="tabular-nums">
                {formatMoney(result.breakdown.itemsSubtotal)}
              </span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-mq-text-muted">{t("landingCost.shippingFee")}</span>
              <span className="tabular-nums">
                {formatMoney(result.breakdown.shippingFee)}
              </span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-mq-text-muted">{t("landingCost.vatAmount")}</span>
              <span className="tabular-nums">{formatMoney(result.breakdown.vatAmount)}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-mq-text-muted">{t("landingCost.packagingFee")}</span>
              <span className="tabular-nums">
                {formatMoney(result.breakdown.packagingFee)}
              </span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-mq-text-muted">{t("landingCost.promoDiscount")}</span>
              <span className="tabular-nums">
                −{formatMoney(result.breakdown.promoDiscount)}
              </span>
            </p>
            <p className="flex justify-between gap-3 text-base font-semibold pt-2">
              <span>{t("landingCost.finalAmount")}</span>
              <span className="tabular-nums">{formatMoney(result.finalAmount)}</span>
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
