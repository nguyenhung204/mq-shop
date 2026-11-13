import { describe, expect, it } from "vitest";
import {
  canResolvePayoutStatus,
  processResultKind,
  validateResolveForm,
} from "./payout-resolve";

describe("payout resolve helpers", () => {
  it("only PROCESSING and PAID_UNRECONCILED are resolvable", () => {
    expect(canResolvePayoutStatus("PROCESSING")).toBe(true);
    expect(canResolvePayoutStatus("PAID_UNRECONCILED")).toBe(true);
    expect(canResolvePayoutStatus("COMPLETED")).toBe(false);
    expect(canResolvePayoutStatus("APPROVED")).toBe(false);
  });

  it("requires gatewayRef to complete a PROCESSING payout", () => {
    const base = { status: "PROCESSING", outcome: "COMPLETED", gatewayRef: " ", note: "bank confirmed" } as const;
    expect(validateResolveForm(base)).toBe("gatewayRefRequired");
    expect(validateResolveForm({ ...base, gatewayRef: "TX1" })).toBeNull();
    expect(validateResolveForm({ ...base, outcome: "FAILED" })).toBeNull();
    expect(validateResolveForm({ ...base, status: "PAID_UNRECONCILED" })).toBeNull();
  });

  it("validates note length and gatewayRef length", () => {
    const base = { status: "PROCESSING", outcome: "FAILED", gatewayRef: "", note: "ok!" } as const;
    expect(validateResolveForm(base)).toBeNull();
    expect(validateResolveForm({ ...base, note: " ab " })).toBe("noteInvalid");
    expect(validateResolveForm({ ...base, note: "x".repeat(501) })).toBe("noteInvalid");
    expect(validateResolveForm({ ...base, gatewayRef: "g".repeat(129) })).toBe("gatewayRefTooLong");
  });

  it("flags process results that are not a plain success", () => {
    expect(processResultKind("PAID_UNRECONCILED")).toBe("unreconciled");
    expect(processResultKind("PROCESSING")).toBe("processing");
    expect(processResultKind("PAY_FAILED")).toBe("failed");
    expect(processResultKind("COMPLETED")).toBe("success");
    expect(processResultKind(undefined)).toBe("success");
  });

  it("race guard (already resolved manually) is never a success, whatever the status", () => {
    const msg =
      "Payout was paid by the gateway but had already been resolved manually; flagged for manual reconcile";
    expect(processResultKind("COMPLETED", msg)).toBe("resolvedElsewhere");
    expect(processResultKind("PAY_FAILED", msg)).toBe("resolvedElsewhere");
  });
});
