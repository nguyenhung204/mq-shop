import { ok } from "./api";
import type { Api } from "./api";
import type { TestSeller, TestUser } from "./factory";

/** Helpers for the display-currency flow (5). Same arithmetic as the oracle in 05-order-currency.spec.ts. */
export const ADDRESS = { fullName: "E2E Buyer", phone: "0900000000", line1: "1 Test Road", city: "Taipei", country: "TW" };
export const DECIMALS: Record<string, number> = { USD: 2, MYR: 2, SGD: 2, VND: 0 };

/** Independent oracle: round-half-up of totalCents x rate (decimal text) -> display cents. */
export function displayCents(totalCents: bigint, rate: string): bigint {
  const [w, f = ""] = rate.split(".");
  const num = BigInt(w + f);
  const den = 10n ** BigInt(f.length);
  return (totalCents * num * 2n + den) / (den * 2n);
}

export const fmt = (cents: bigint, cur: string, locale = "en-US") =>
  new Intl.NumberFormat(locale, { style: "currency", currency: cur, minimumFractionDigits: DECIMALS[cur], maximumFractionDigits: DECIMALS[cur] }).format(
    Number(cents) / 100,
  );

export async function fxNow(api: Api) {
  const r = await ok<any>(await api.get("fx/rates"));
  return { asOf: r.asOf as string, rates: r.rates as Record<string, number> };
}

/** OFF_PLATFORM order (starts PENDING) in `currency`, locked at the rate that is current now. */
export async function checkoutPending(buyer: TestUser, seller: TestSeller, currency: string) {
  const fx = await fxNow(buyer.api);
  const order = await ok<any>(
    await buyer.api.post("orders/checkout", {
      items: [{ variantId: seller.variantId, quantity: 1 }],
      shippingAddress: ADDRESS,
      paymentMethod: "OFF_PLATFORM",
      displayCurrency: currency,
      ...(currency !== "TWD" ? { fxAsOf: fx.asOf } : {}),
    }),
  );
  return { order: order.order ?? order, fx };
}
