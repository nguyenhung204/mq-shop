import type { OrderView } from "@/lib/api/orders";

/** Elapsed-hour unpaid-bill cancel — must match BE ORDER_UNPAID_NO_BILL_EXPIRE_HOURS. */
export const UNPAID_PROOF_HOURS = 72;

const CURRENCY_TZ: Record<string, string> = {
  VND: "Asia/Ho_Chi_Minh",
  TWD: "Asia/Taipei",
  MYR: "Asia/Kuala_Lumpur",
  SGD: "Asia/Singapore",
  USD: "America/New_York",
};

const COUNTRY_TZ: Record<string, string> = {
  VN: "Asia/Ho_Chi_Minh",
  TW: "Asia/Taipei",
  MY: "Asia/Kuala_Lumpur",
  SG: "Asia/Singapore",
  US: "America/New_York",
};

/** Frozen shopper-gate TZ: displayCurrency snapshot, then shipping country, else Taipei. */
export function shopperIanaTimeZone(order: {
  displayCurrency?: string | null;
  shippingAddress?: { country?: string | null };
}): string {
  const cur = (order.displayCurrency ?? "").toUpperCase();
  if (CURRENCY_TZ[cur]) return CURRENCY_TZ[cur];
  const country = (order.shippingAddress?.country ?? "").toUpperCase();
  if (COUNTRY_TZ[country]) return COUNTRY_TZ[country];
  return "Asia/Taipei";
}

export function shopperGmtLabel(iana: string): string {
  if (iana === "Asia/Ho_Chi_Minh") return "GMT+7";
  if (iana === "America/New_York") return "ET";
  return "GMT+8";
}

export function isAwaitingUnpaidProof(order: Pick<
  OrderView,
  "status" | "paymentProofUrl" | "paymentFirstProofAt" | "paymentProofPurgedAt"
>): boolean {
  return (
    order.status === "PENDING" &&
    !order.paymentProofUrl &&
    !order.paymentFirstProofAt &&
    !order.paymentProofPurgedAt
  );
}

export function unpaidProofDueAtFromCreated(createdAt: string): Date {
  return new Date(new Date(createdAt).getTime() + UNPAID_PROOF_HOURS * 3600_000);
}

export function resolveUnpaidProofDueAt(
  order: Pick<OrderView, "createdAt" | "unpaidProofDueAt">,
): Date {
  if (order.unpaidProofDueAt) return new Date(order.unpaidProofDueAt);
  return unpaidProofDueAtFromCreated(order.createdAt);
}

/** Remaining whole hours (ceil). 0 when overdue. */
export function unpaidProofHoursLeft(dueAt: Date, now = Date.now()): number {
  const leftMs = dueAt.getTime() - now;
  if (leftMs <= 0) return 0;
  return Math.max(1, Math.ceil(leftMs / 3600_000));
}

export function formatShopperDeadline(
  dueAt: Date,
  iana: string,
  locale: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: iana,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dueAt);
}
