import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { LandingCostCalculator } from "@/components/finance/LandingCostCalculator";
import { AdminFxRatesPanel } from "@/components/admin/AdminFxRatesPanel";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import en from "@/lib/i18n/locales/en.json";
import viLocale from "@/lib/i18n/locales/vi.json";
import zhLocale from "@/lib/i18n/locales/zh-TW.json";
import {
  getMoneyInputErrorMessage,
  parseLocaleIntInput,
  parseLocaleMoneyInput,
} from "@/lib/money";
import { api } from "@/lib/api/client";
import { transferApi } from "@/lib/api/inventory";

// AdminFxRatesPanel reads the role (fee config is CONFIG_FEE, not for ADMIN).
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ hasRole: (r: string) => r === "SUPER_ADMIN" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

function withProviders(node: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(LanguageProvider, null, node),
    ),
  );
}

describe("hardened money forms (rendered)", () => {
  it("LandingCostCalculator renders decimal/numeric text inputs without type=number", () => {
    const html = withProviders(createElement(LandingCostCalculator));
    expect(html).not.toContain('type="number"');
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('type="submit"');
  });

  it("AdminFxRatesPanel renders loading skeleton or decimal inputs without type=number", () => {
    const html = withProviders(createElement(AdminFxRatesPanel));
    expect(html).not.toContain('type="number"');
  });

  it("localized error messages include examples for en, vi, and zh-TW", () => {
    const dicts = { en, vi: viLocale, "zh-TW": zhLocale } as const;
    for (const [loc, dict] of Object.entries(dicts)) {
      const t = (key: string, vars?: Record<string, string | number>) => {
        const raw = key
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict);
        let s = typeof raw === "string" ? raw : key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            s = s.replaceAll(`{${k}}`, String(v));
          }
        }
        return s;
      };
      const res = parseLocaleMoneyInput("1.234", { locale: loc, maxDecimals: 0 });
      if (loc === "vi") {
        expect(res.ok).toBe(true);
      } else {
        expect(res.ok).toBe(false);
        if (!res.ok) {
          const msg = getMoneyInputErrorMessage(res.error, t, { locale: loc, maxDecimals: 0 });
          expect(msg).toContain("1,000");
        }
      }
    }
  });

  it("CurrencyInput renders inline error and aria-invalid when error prop is set, and preserves value", () => {
    const html = withProviders(
      createElement(CurrencyInput, {
        value: 1000,
        onChange: () => {},
        currency: "TWD",
        error: "Invalid format",
      }),
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Invalid format");
    expect(html).toContain('value="1,000"');
  });

  it("parseLocaleIntInput parses vi grouped integers like 1.000 and rejects ambiguous en", () => {
    expect(parseLocaleIntInput("1.000", { locale: "vi", min: 1, max: 1000000 })).toEqual({
      ok: true,
      value: 1000,
      canonical: "1000",
    });
    expect(parseLocaleIntInput("1.000", { locale: "en", min: 1, max: 1000000 })).toEqual({
      ok: false,
      error: "AMBIGUOUS_FORMAT",
    });
  });

  it("transferApi.create, approve, and receive attach Idempotency-Key header", async () => {
    const postSpy = vi.spyOn(api, "post").mockResolvedValue({} as never);
    try {
      await transferApi.create(
        { fromWarehouseId: "w1", toWarehouseId: "w2", items: [{ sku: "SKU1", quantity: 2 }] },
        "idem-create-1",
      );
      expect(postSpy).toHaveBeenLastCalledWith(
        "/inventory/transfers",
        { fromWarehouseId: "w1", toWarehouseId: "w2", items: [{ sku: "SKU1", quantity: 2 }] },
        { headers: { "Idempotency-Key": "idem-create-1" } },
      );

      await transferApi.approve("tf-1", "idem-approve-1");
      expect(postSpy).toHaveBeenLastCalledWith(
        "/inventory/transfers/tf-1/approve",
        {},
        { headers: { "Idempotency-Key": "idem-approve-1" } },
      );

      await transferApi.receive(
        "tf-1",
        { items: [{ sku: "SKU1", receivedQuantity: 2 }] },
        "idem-receive-1",
      );
      expect(postSpy).toHaveBeenLastCalledWith(
        "/inventory/transfers/tf-1/receive",
        { items: [{ sku: "SKU1", receivedQuantity: 2 }] },
        { headers: { "Idempotency-Key": "idem-receive-1" } },
      );
    } finally {
      postSpy.mockRestore();
    }
  });
});
