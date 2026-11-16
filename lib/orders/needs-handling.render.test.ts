import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NeedsHandlingBadge } from "@/components/orders/NeedsHandlingBadge";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";

const render = (order: Parameters<typeof NeedsHandlingBadge>[0]["order"]) =>
  renderToStaticMarkup(createElement(LanguageProvider, null, createElement(NeedsHandlingBadge, { order })));

describe("NeedsHandlingBadge (rendered)", () => {
  it("shows for an escalated pending bill and hides otherwise", () => {
    expect(render({ status: "PENDING", paymentEscalatedAt: "2026-11-16T00:00:00Z" })).toContain("orders.payment.needsHandling");
    expect(render({ status: "PENDING", paymentEscalatedAt: null })).toBe("");
    expect(render({ status: "PAID", paymentEscalatedAt: "2026-11-16T00:00:00Z" })).toBe("");
  });
  it("the label is 'Cần xử lý' in Vietnamese and translated in the other locales", () => {
    const get = (loc: unknown) =>
      ("orders.payment.needsHandling".split(".") as string[]).reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], loc);
    expect(get(vi)).toBe("Cần xử lý");
    expect(get(en)).toBe("Needs handling");
    expect(typeof get(zh)).toBe("string");
  });
});
