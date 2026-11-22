import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { LandingCostCalculator } from "@/components/finance/LandingCostCalculator";
import { AdminFxRatesPanel } from "@/components/admin/AdminFxRatesPanel";
import en from "@/lib/i18n/locales/en.json";
import viLocale from "@/lib/i18n/locales/vi.json";
import zhLocale from "@/lib/i18n/locales/zh-TW.json";
import { getMoneyInputErrorMessage, parseLocaleMoneyInput } from "@/lib/money";

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
});
