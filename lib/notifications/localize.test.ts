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
});
