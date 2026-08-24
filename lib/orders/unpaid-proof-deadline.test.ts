import { describe, expect, it } from "vitest";
import {
  formatShopperDeadline,
  isAwaitingUnpaidProof,
  shopperGmtLabel,
  shopperIanaTimeZone,
  unpaidProofDueAtFromCreated,
  unpaidProofHoursLeft,
} from "./unpaid-proof-deadline";

describe("unpaid-proof-deadline", () => {
  it("due instant is createdAt + 72 elapsed hours", () => {
    expect(
      unpaidProofDueAtFromCreated("2026-08-21T10:00:00.000Z").toISOString(),
    ).toBe("2026-08-24T10:00:00.000Z");
  });

  it("hours left uses ceil and is TZ-independent", () => {
    const due = new Date("2026-08-24T10:00:00.000Z");
    expect(unpaidProofHoursLeft(due, Date.parse("2026-08-22T22:00:00.000Z"))).toBe(
      36,
    );
    expect(unpaidProofHoursLeft(due, Date.parse("2026-08-24T09:30:00.000Z"))).toBe(
      1,
    );
    expect(unpaidProofHoursLeft(due, Date.parse("2026-08-24T10:00:00.000Z"))).toBe(
      0,
    );
  });

  it("maps gate displayCurrency to shopper wall TZ (VN GMT+7, TW GMT+8)", () => {
    expect(shopperIanaTimeZone({ displayCurrency: "VND" })).toBe(
      "Asia/Ho_Chi_Minh",
    );
    expect(shopperIanaTimeZone({ displayCurrency: "TWD" })).toBe("Asia/Taipei");
    expect(shopperGmtLabel("Asia/Ho_Chi_Minh")).toBe("GMT+7");
    expect(shopperGmtLabel("Asia/Taipei")).toBe("GMT+8");
  });

  it("falls back to shipping country then Taipei", () => {
    expect(
      shopperIanaTimeZone({
        displayCurrency: null,
        shippingAddress: { country: "VN" },
      }),
    ).toBe("Asia/Ho_Chi_Minh");
    expect(shopperIanaTimeZone({})).toBe("Asia/Taipei");
  });

  it("same due instant shows 1h apart on VN vs TW walls", () => {
    const due = new Date("2026-08-24T10:00:00.000Z");
    const vn = formatShopperDeadline(due, "Asia/Ho_Chi_Minh", "en-US");
    const tw = formatShopperDeadline(due, "Asia/Taipei", "en-US");
    expect(vn).not.toBe(tw);
    expect(vn).toMatch(/5:00/);
    expect(tw).toMatch(/6:00/);
  });

  it("does not treat a purged bill as unpaid / never uploaded", () => {
    expect(
      isAwaitingUnpaidProof({
        status: "PENDING",
        paymentProofUrl: null,
        paymentFirstProofAt: "2026-08-01T00:00:00.000Z",
        paymentProofPurgedAt: "2026-09-30T00:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      isAwaitingUnpaidProof({
        status: "PENDING",
        paymentProofUrl: null,
      }),
    ).toBe(true);
  });
});
