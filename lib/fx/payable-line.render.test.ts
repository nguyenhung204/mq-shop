import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PayableLine } from "@/components/orders/PayableLine";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import type { OrderMoneyFields } from "@/lib/fx/formatOrderMoney";

const render = (order: OrderMoneyFields) =>
  renderToStaticMarkup(createElement(LanguageProvider, null, createElement(PayableLine, { order, locale: "en-US" })));

describe("PayableLine (rendered, R4)", () => {
  it("shows the payable amount in its own currency with the locked rate and the TWD ledger hint", () => {
    const html = render({
      total: 1000,
      currency: "TWD",
      displayCurrency: "USD",
      fxRate: 0.9,
      displayTotal: 900,
      payableAmount: 31.5,
      payableCurrency: "USD",
      fxRateLocked: 0.0315,
    });
    expect(html).toContain("$31.50");
    expect(html).toContain("orders.payable.amountDue");
    expect(html).toContain("orders.payable.rateLocked");
    expect(html).toContain("orders.payable.ledgerNote");
    expect(html).not.toContain("$900");
    expect(html).not.toContain("1,000");
  });
  it("TWD order: amount only, no rate or ledger lines", () => {
    const html = render({ total: 500, currency: "TWD", payableAmount: 500, payableCurrency: "TWD", fxRateLocked: null });
    expect(html).toContain("500");
    expect(html).not.toContain("orders.payable.rateLocked");
    expect(html).not.toContain("orders.payable.ledgerNote");
  });
});
