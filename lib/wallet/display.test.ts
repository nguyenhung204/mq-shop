import { describe, expect, it } from "vitest";
import { commissionAmounts, transferPreviewLabel } from "./display";

describe("commissionAmounts (M2)", () => {
  it("shows credited points as main and TWD as secondary, not TWD as points", () => {
    const r = commissionAmounts({ points: 31.5, payoutAmount: "1000.00" }, "pts");
    expect(r.main).toBe("31.5 pts");
    expect(r.twd).toContain("1,000");
    expect(r.main).not.toContain("1,000");
  });
  it("null/undefined points (legacy) -> em dash, still shows TWD", () => {
    expect(commissionAmounts({ points: null, payoutAmount: "50" }, "pts").main).toBe("—");
    expect(commissionAmounts({ payoutAmount: "50" }, "pts").main).toBe("—");
    expect(commissionAmounts({ points: null, payoutAmount: "50" }, "pts").twd).toContain("50");
  });
  it("0 points is a real value, not legacy", () => {
    expect(commissionAmounts({ points: 0, payoutAmount: "0.01" }, "pts").main).toBe("0 pts");
  });
});

describe("transferPreviewLabel (N9)", () => {
  const base = { userId: null, inNetwork: false };
  it("prefers masked name and keeps masked email as secondary", () => {
    expect(transferPreviewLabel({ ...base, maskedName: "N**n", maskedEmail: "a***@x.com" })).toEqual({
      primary: "N**n",
      secondary: "a***@x.com",
    });
  });
  it("falls back to masked email, never the user id", () => {
    const r = transferPreviewLabel({ userId: "u-1", inNetwork: true, maskedName: null, maskedEmail: "a***@x.com" });
    expect(r).toEqual({ primary: "a***@x.com", secondary: null });
  });
});
