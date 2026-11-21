import { describe, expect, it } from "vitest";
import { localizeNotification } from "./localize";

describe("localizeNotification point unit", () => {
  it("formats wallet transfer amount as điểm / points / 點", () => {
    const n = {
      type: "WALLET_TRANSFER_SENT",
      title: "Transfer sent",
      body: "You sent 12.5 PTS to a@b.c.",
      meta: { amount: "12.5" },
      metaNames: null,
    };
    expect(localizeNotification(n, "vi").body).toContain("12.5 điểm");
    expect(localizeNotification(n, "en").body).toContain("12.5 points");
    expect(localizeNotification(n, "zh-TW").body).toContain("12.5 點");
    expect(localizeNotification(n, "vi").body).not.toContain("PTS");
  });

  it("replaces leftover PTS in unknown-type fallback copy", () => {
    const n = {
      type: "GENERIC_UNKNOWN",
      title: "Notice",
      body: "You sent 10 PTS to user@example.com.",
      meta: null,
      metaNames: null,
    };
    expect(localizeNotification(n, "vi").body).toBe(
      "You sent 10 điểm to user@example.com.",
    );
    expect(localizeNotification(n, "zh-TW").body).toBe(
      "You sent 10 點 to user@example.com.",
    );
  });

  it("localizes proof retention warning and purge copy", () => {
    const warning = {
      type: "ORDER_PROOF_RETENTION_WARNING",
      title: "Receipt files will be deleted soon",
      body: "fallback",
      meta: { orderId: "order-1", daysLeft: "30", milestone: "30" },
      metaNames: { orderCode: "ORD-1" },
    };
    expect(localizeNotification(warning, "vi").body).toContain("30 ngày");
    expect(localizeNotification(warning, "en").body).toContain("30 days");
    expect(localizeNotification(warning, "zh-TW").body).toContain("30 天");

    const purged = {
      type: "ORDER_PROOF_PURGED",
      title: "Receipt files deleted",
      body: "fallback",
      meta: { orderId: "order-1" },
      metaNames: { orderCode: "ORD-1" },
    };
    expect(localizeNotification(purged, "vi").body).toContain("hết thời hạn lưu trữ");
    expect(localizeNotification(purged, "en").body).toMatch(/storage period/i);
    expect(localizeNotification(purged, "zh-TW").body).toContain("保存期限");
  });

  it("localizes referral skipped-not-seller copy", () => {
    const n = {
      type: "COMMISSION_REFERRAL_SKIPPED_NOT_SELLER",
      title: "fallback",
      body: "fallback",
      meta: { orderId: "order-1" },
      metaNames: null,
    };
    expect(localizeNotification(n, "vi").title).toBeTruthy();
    expect(localizeNotification(n, "en").body.toLowerCase()).toMatch(/seller/);
  });
});

describe("ORDER_STALE_BILL_REMINDER copy (R5)", () => {
  const n = { type: "ORDER_STALE_BILL_REMINDER", title: "Server", body: "Server body", meta: { orderId: "uuid", orderCode: "ORD-9", shopId: "s" } };
  it("renders the order code in every language, not the server text", () => {
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      const out = localizeNotification(n, loc);
      expect(out.body, loc).toContain("ORD-9");
      expect(out.title, loc).not.toBe("Server");
    }
  });
});

describe("refund case notification copy (C2)", () => {
  for (const type of ["REFUND_CASE_OPENED", "REFUND_CASE_MARKED_PAID", "REFUND_CASE_DISPUTED"]) {
    it(`${type} is rendered from the app copy in every language, with no raw placeholder`, () => {
      const n = { type, title: "Server title", body: "Server body", meta: { refundCaseId: "c1", orderId: "o1", shopId: "s1" } };
      const titles = new Set<string>();
      for (const loc of ["en", "vi", "zh-TW"] as const) {
        const out = localizeNotification(n, loc);
        expect(out.title, loc).not.toBe("Server title");
        expect(out.body, loc).not.toBe("Server body");
        expect(out.body, loc).not.toMatch(/[{}]/);
        titles.add(out.title);
      }
      expect(titles.size).toBe(3);
    });
  }
});

describe("dividend notification copy (C5)", () => {
  it("DIVIDEND_CREDITED shows the quarter, the TWD amount and the points in every language", () => {
    const n = { type: "DIVIDEND_CREDITED", title: "Server title", body: "Server body", meta: { quarter: "2026Q4", amountTwd: "1234.50", points: "39.19", itemId: "11111111-1111-1111-1111-111111111111" } };
    const titles = new Set<string>();
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      const out = localizeNotification(n, loc);
      expect(out.body, loc).toContain("2026Q4");
      expect(out.body, loc).toContain("1234.50");
      expect(out.body, loc).toContain("39.19");
      expect(out.body, loc).not.toMatch(/[{}]/);
      expect(out.title, loc).not.toBe("Server title");
      titles.add(out.title);
    }
    expect(titles.size).toBe(3);
  });
  it("DIVIDEND_SETTLEMENT_FAILED shows the quarter in every language", () => {
    const n = { type: "DIVIDEND_SETTLEMENT_FAILED", title: "Server title", body: "Server body", meta: { quarter: "2026Q3" } };
    const bodies = new Set<string>();
    for (const loc of ["en", "vi", "zh-TW"] as const) {
      const out = localizeNotification(n, loc);
      expect(out.body, loc).toContain("2026Q3");
      expect(out.body, loc).not.toMatch(/[{}]/);
      bodies.add(out.body);
    }
    expect(bodies.size).toBe(3);
  });
});
