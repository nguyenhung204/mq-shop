import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/locales/en.json";
import vi from "@/lib/i18n/locales/vi.json";
import zh from "@/lib/i18n/locales/zh-TW.json";
import { REFUND_CASE_STATUSES } from "@/lib/api/refund-cases";
import { EXPORT_KINDS } from "@/lib/api/accounting-export";
import { LEDGER_TYPES, WALLET_REASONS } from "@/lib/accounting-export/model";
import { BUSINESS_REGION_CODES } from "@/lib/i18n/regions";

/** Keys the CR phase C screens build at runtime (template strings): every one must exist in all three locales. */
const lookup = (loc: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], loc);

const KEYS: string[] = [
  ...REFUND_CASE_STATUSES.map((s) => `refundCases.status.${s}`),
  ...["partial", "full"].map((k) => `refundCases.kind.${k}`),
  ...["CANCEL", "RMA"].map((k) => `refundCases.source.${k}`),
  ...["MARK_PAID", "CONFIRM", "DISPUTE", "OVERRIDE"].map((k) => `refundCases.action.${k}`),
  ...["CREATED", "SELLER_MARK_PAID", "BUYER_CONFIRM", "BUYER_DISPUTE", "AUTO_CLOSE", "ADMIN_OVERRIDE", "RMA_SYNC"].map((k) => `refundCases.event.${k}`),
  ...["BUYER", "SELLER", "ADMIN", "SUPER_ADMIN", "STAFF", "SYSTEM"].map((k) => `refundCases.actor.${k}`),
  ...["badFrom", "badTo", "rangeOrder", "rangeTooLong", "badShop"].map((k) => `refundCases.filter.errors.${k}`),
  ...["open", "awaitingBuyer", "disputed", "buyerConfirmed", "closed", "overdue", "total"].map((k) => `refundCases.summary.${k}`),
  ...["markPaid", "confirm", "dispute", "override"].flatMap((k) => [`refundCases.modal.${k}.title`, `refundCases.modal.${k}.desc`, `refundCases.modal.${k}.confirm`]),
  ...["required", "tooShort", "tooLong", "invalid"].map((k) => `refundCases.modal.errors.note.${k}`),
  ...["tooLong", "invalid"].map((k) => `refundCases.modal.errors.reference.${k}`),
  ...["required", "same"].map((k) => `refundCases.modal.errors.toStatus.${k}`),
  ...["selfDealing", "disputeLimit", "invalidTransition", "notFound", "invalid"].map((k) => `refundCases.errors.${k}`),
  ...["buyerPage", "sellerPage"].map((k) => `refundCases.${k}.intro`),
  ...EXPORT_KINDS.map((k) => `accountingExport.kinds.${k}`),
  ...["badFrom", "badTo", "rangeOrder", "rangeTooLong", "badShop", "badRegion", "badReason", "badBeneficiary", "badUser"].map((k) => `accountingExport.formErrors.${k}`),
  ...["tooManyRows", "timeout", "tooMany", "unavailable", "forbidden", "badRequest", "failed", "aborted", "incomplete"].map((k) => `accountingExport.errors.${k}`),
  ...[...LEDGER_TYPES, ...WALLET_REASONS].map((k) => `wallet.reasons.${k}`),
  ...["required", "invalidDate", "future", "beforeCreated", "unchanged", "invalid", "quarterLocked", "forbidden"].map((k) => `orders.paidAt.errors.${k}`),
  ...["notDecimal"].map((k) => `admin.settings.errors.${k}`),
  ...["taxEnabled", "taxRatePercent", "refundOverdueDays"].flatMap((k) => [`admin.settings.keys.${k}.label`, `admin.settings.keys.${k}.description`]),
  ...["CREDIT", "REVERSAL", "PENDING", "VOID"].map((k) => `accountingExport.summary.movement.${k}`),
  ...["IN", "OUT"].map((k) => `accountingExport.summary.direction.${k}`),
  ...["twd", "points"].map((k) => `accountingExport.summary.net.${k}`),
  "accountingExport.summary.held",
  "accountingExport.summary.in",
  "accountingExport.summary.out",
  "accountingExport.summary.netLabel",
  "accountingExport.errors.notCsv",
  "refundCases.errors.rmaProofFirst",
  "refundCases.errors.rmaEscalateFirst",
  "refundCases.rma.hint",
  "refundCases.rma.open",
  "refundCases.modal.override.rmaNote",
  "common.pointUnit",
  "refundCases.updatedBySupport",
  "refundCases.selfDealing.badge",
  "refundCases.selfDealing.note",
  "region.switchFailed",
  "admin.common.region",
  "admin.rmaPage.approveModal.displayEquivalent",
  "seller.nav.refunds",
  "seller.titles.refunds",
  "account.links.refunds",
  "toast.orderPaidAtInvalid",
  "toast.regionInvalid",
];

describe("CR phase C locale keys (en, vi, zh-TW)", () => {
  for (const [name, loc] of [["en", en], ["vi", vi], ["zh-TW", zh]] as const) {
    it(`${name}: all ${KEYS.length} runtime keys exist and are not empty`, () => {
      const bad = KEYS.filter((k) => typeof lookup(loc, k) !== "string" || (lookup(loc, k) as string).trim() === "");
      expect(bad).toEqual([]);
    });
  }
  it("the same {placeholders} appear in every language for the new strings", () => {
    const ph = (s: unknown) => (String(s).match(/\{\w+\}/g) ?? []).sort().join();
    const bad = KEYS.filter((k) => ph(lookup(en, k)) !== ph(lookup(vi, k)) || ph(lookup(en, k)) !== ph(lookup(zh, k)));
    expect(bad).toEqual([]);
  });
  it("business regions are labelled with their codes in the export (no US)", () => {
    expect(BUSINESS_REGION_CODES).not.toContain("US");
  });
});

describe("translated, not copied from English", () => {
  it("the admin actor names differ from English in vi and zh-TW (no half-translated list)", () => {
    for (const loc of [vi, zh]) {
      expect(lookup(loc, "refundCases.actor.ADMIN")).not.toBe(lookup(en, "refundCases.actor.ADMIN"));
      expect(lookup(loc, "refundCases.actor.SUPER_ADMIN")).not.toBe(lookup(en, "refundCases.actor.SUPER_ADMIN"));
    }
  });
});
